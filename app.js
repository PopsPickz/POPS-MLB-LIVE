const gamesBox = document.getElementById("gamesBox");
const hrPicksBox = document.getElementById("hrPicksBox");
const hitPicksBox = document.getElementById("hitPicksBox");
const moneylineBox = document.getElementById("moneylineBox");

let todayData = {
  date: "",
  games: []
};

let games = [];
let hrPicks = [];
let hitPicks = [];

/*
=========================================================
POPS DAILY PICK LOCK
=========================================================

Locks the displayed Top 20 HR Pickz and Hit Pickz for the
entire day.

The list keeps the same players and order when:

- Stats refresh
- Starting pitchers change
- The page reloads
- Scores recalculate
- Projected lineups change

A player is removed only when that player's team has a
confirmed lineup and the player is not in that lineup.
=========================================================
*/

const DailyPickLock = {
  limits: {
    hr: 20,
    hit: 20
  },

  normalizeName(value = "") {
    return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  },

  normalizeTeam(value = "") {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  },

  getDate() {
    if (
      typeof API !== "undefined" &&
      typeof API.today === "function"
    ) {
      return API.today();
    }

    const now = new Date();

    const year = now.getFullYear();

    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  },

  getStorageKey(type) {
    return (
      `pops-${type}-picks-lock-` +
      this.getDate()
    );
  },

  getPickKey(pick = {}) {
    const playerId = Number(
      pick.id ||
      pick.playerId ||
      0
    );

    if (playerId > 0) {
      return `id-${playerId}`;
    }

    return [
      this.normalizeName(
        pick.player ||
        pick.name
      ),

      this.normalizeTeam(
        pick.team
      )
    ].join("-");
  },

  getLineupPlayerKey(player = {}) {
    const playerId = Number(
      player.id ||
      player.playerId ||
      player.personId ||
      player.batterId ||
      player?.person?.id ||
      0
    );

    if (playerId > 0) {
      return `id-${playerId}`;
    }

    return [
      this.normalizeName(
        player.player ||
        player.name
      ),

      this.normalizeTeam(
        player.team
      )
    ].join("-");
  },

  load(type) {
    try {
      const savedValue =
        localStorage.getItem(
          this.getStorageKey(type)
        );

      if (!savedValue) {
        return [];
      }

      const parsed =
        JSON.parse(savedValue);

      return Array.isArray(parsed)
        ? parsed
        : [];
    } catch (error) {
      console.warn(
        `POPS could not load locked ${type} picks:`,
        error
      );

      return [];
    }
  },

  save(type, picks = []) {
    try {
      localStorage.setItem(
        this.getStorageKey(type),
        JSON.stringify(picks)
      );
    } catch (error) {
      console.warn(
        `POPS could not save locked ${type} picks:`,
        error
      );
    }
  },

  clear(type) {
    try {
      localStorage.removeItem(
        this.getStorageKey(type)
      );
    } catch (error) {
      console.warn(
        `POPS could not clear ${type} pick lock:`,
        error
      );
    }
  },

  isLineupConfirmed(lineup = []) {
    if (!Array.isArray(lineup)) {
      return false;
    }

    if (lineup.length < 7) {
      return false;
    }

    const confirmedPlayers =
      lineup.filter(
        player =>
          player?.confirmed === true
      );

    return (
      confirmedPlayers.length >= 7
    );
  },

  findTeamLineup(teamName = "") {
    const normalizedTeam =
      this.normalizeTeam(teamName);

    for (
      const game of
      todayData?.games || []
    ) {
      const awayTeam =
        this.normalizeTeam(
          game.awayTeam
        );

      const homeTeam =
        this.normalizeTeam(
          game.homeTeam
        );

      if (awayTeam === normalizedTeam) {
        return {
          lineup:
            Array.isArray(game.awayLineup)
              ? game.awayLineup
              : [],

          confirmed:
            this.isLineupConfirmed(
              game.awayLineup || []
            )
        };
      }

      if (homeTeam === normalizedTeam) {
        return {
          lineup:
            Array.isArray(game.homeLineup)
              ? game.homeLineup
              : [],

          confirmed:
            this.isLineupConfirmed(
              game.homeLineup || []
            )
        };
      }
    }

    return {
      lineup: [],
      confirmed: false
    };
  },

  isConfirmedInactive(pick = {}) {
    const teamLineup =
      this.findTeamLineup(
        pick.team
      );

    /*
    Never remove a player while the team's lineup
    is still projected or incomplete.
    */

    if (!teamLineup.confirmed) {
      return false;
    }

    const pickKey =
      this.getPickKey(pick);

    const appearsInLineup =
      teamLineup.lineup.some(
        player =>
          this.getLineupPlayerKey(
            player
          ) === pickKey
      );

    return !appearsInLineup;
  },

  removeDuplicates(picks = []) {
    const uniquePicks = [];
    const usedKeys = new Set();

    for (const pick of picks) {
      if (!pick) continue;

      const key =
        this.getPickKey(pick);

      if (!key || usedKeys.has(key)) {
        continue;
      }

      usedKeys.add(key);
      uniquePicks.push(pick);
    }

    return uniquePicks;
  },

  getLockedPicks(
    type,
    candidates = [],
    requestedLimit = 20
  ) {
    const limit =
      Number(
        requestedLimit ||
        this.limits[type] ||
        20
      );

    const candidatePool =
      this.removeDuplicates(
        candidates
      );

    const candidateMap =
      new Map();

    for (const candidate of candidatePool) {
      candidateMap.set(
        this.getPickKey(candidate),
        candidate
      );
    }

    const savedPicks =
      this.removeDuplicates(
        this.load(type)
      );

    /*
    First generation of the day:
    lock the current ranked Top 20.
    */

    if (!savedPicks.length) {
      const firstLockedList =
        candidatePool.slice(
          0,
          limit
        );

      this.save(
        type,
        firstLockedList
      );

      console.log(
        `🔒 POPS locked today's Top ${firstLockedList.length} ${type} picks.`
      );

      return firstLockedList;
    }

    const lockedPicks = [];
    const usedKeys = new Set();

    for (const savedPick of savedPicks) {
      if (lockedPicks.length >= limit) {
        break;
      }

      const key =
        this.getPickKey(savedPick);

      if (!key || usedKeys.has(key)) {
        continue;
      }

      /*
      Remove the player only when their team has a
      confirmed lineup and they are not in it.
      */

      if (
        this.isConfirmedInactive(
          savedPick
        )
      ) {
        console.log(
          `🚫 POPS removed inactive player: ${savedPick.player}`
        );

        continue;
      }

      /*
      Update the player's current stats without changing
      their position in the locked rankings.
      */

      const currentCandidate =
        candidateMap.get(key);

      const updatedPick =
        currentCandidate
          ? {
              ...savedPick,
              ...currentCandidate
            }
          : savedPick;

      lockedPicks.push(
        updatedPick
      );

      usedKeys.add(key);
    }

    /*
    Replace confirmed inactive players with the next
    highest-ranked eligible candidate.
    */

    for (const candidate of candidatePool) {
      if (lockedPicks.length >= limit) {
        break;
      }

      const key =
        this.getPickKey(candidate);

      if (!key || usedKeys.has(key)) {
        continue;
      }

      if (
        this.isConfirmedInactive(
          candidate
        )
      ) {
        continue;
      }

      lockedPicks.push(candidate);
      usedKeys.add(key);
    }

    this.save(
      type,
      lockedPicks
    );

    return lockedPicks;
  }
};

window.DailyPickLock =
  DailyPickLock;

/*
=========================================================
POPS PICKZ 11.0 REFRESH SETTINGS
=========================================================
*/

const STARTER_REFRESH_INTERVAL = 5 * 60 * 1000;
const DATE_CHECK_INTERVAL = 60 * 1000;

let starterRefreshTimer = null;
let dateCheckTimer = null;

let starterRefreshRunning = false;
let recalculationRunning = false;
let dailyReloadRunning = false;

let loadedScheduleDate = "";

/*
=========================================================
GENERAL HELPERS
=========================================================
*/

function formatTime(dateString) {
  if (!dateString) return "Time TBD";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Time TBD";
  }

  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDecimal(value, places = 3) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return Number(0).toFixed(places);
  }

  return number.toFixed(places);
}

function formatMetric(value, suffix = "", places = 1) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "N/A";
  }

  return `${number.toFixed(places)}${suffix}`;
}

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.warn("POPS safe error:", err);
    return fallback;
  }
}

function normalizePitcherName(name) {
  const value = String(name || "").trim();

  if (
    !value ||
    value.toLowerCase() === "tbd" ||
    value.toLowerCase() === "unknown"
  ) {
    return "TBD";
  }

  return value;
}

function hasNamedStarter(name, id) {
  return (
    normalizePitcherName(name) !== "TBD" &&
    Number(id || 0) > 0
  );
}

function getGameStatusObject(game = {}) {
  if (game.status && typeof game.status === "object") {
    return game.status;
  }

  if (
    game.statusObject &&
    typeof game.statusObject === "object"
  ) {
    return game.statusObject;
  }

  return {};
}

function isGameStarted(status = {}) {
  const abstractState = String(
    status.abstractGameState ||
    status.abstractGameCode ||
    ""
  ).toLowerCase();

  const detailedState = String(
    status.detailedState ||
    status.statusCode ||
    ""
  ).toLowerCase();

  const codedState = String(
    status.codedGameState || ""
  ).toUpperCase();

  if (
    abstractState === "live" ||
    abstractState === "final" ||
    abstractState === "completed"
  ) {
    return true;
  }

  if (
    detailedState.includes("in progress") ||
    detailedState.includes("game over") ||
    detailedState.includes("final") ||
    detailedState.includes("completed") ||
    detailedState.includes("suspended")
  ) {
    return true;
  }

  return ["I", "F", "O"].includes(codedState);
}

function gameHasNotStarted(game = {}) {
  if (isGameStarted(getGameStatusObject(game))) {
    return false;
  }

  const firstPitch = new Date(game.date).getTime();

  if (!Number.isFinite(firstPitch)) {
    return true;
  }

  return Date.now() < firstPitch + 30 * 60 * 1000;
}

function getBatterId(batter = {}) {
  return Number(
    batter.id ||
    batter.playerId ||
    batter.personId ||
    batter.batterId ||
    batter?.person?.id ||
    0
  );
}

function emptyRecentForm() {
  return {
    games: 0,
    avg: 0,
    obp: 0,
    slg: 0,
    ops: 0,
    iso: 0,
    atBats: 0,
    hits: 0,
    doubles: 0,
    triples: 0,
    homeRuns: 0,
    extraBaseHits: 0
  };
}

function emptyStatcast() {
  return {
    available: false,
    hasStatcastData: false,

    barrelRate: 0,
    barrelPct: 0,

    hardHitRate: 0,
    hardHitPct: 0,

    exitVelocity: 0,
    avgExitVelo: 0,
    avgExitVelocity: 0,

    launchAngle: 0,
    avgLaunchAngle: 0,

    sweetSpotRate: 0,
    sweetSpotPct: 0,

    flyBallRate: 0,
    flyBallPct: 0,

    pullRate: 0,
    pullPct: 0
  };
}

function mergeStatcastWithFallback(
  playerName,
  liveStats = {}
) {
  if (
    typeof StatcastData !== "undefined" &&
    typeof StatcastData.mergeWithLive === "function"
  ) {
    return StatcastData.mergeWithLive(
      playerName,
      liveStats
    );
  }

  return {
    ...emptyStatcast(),
    ...(liveStats || {})
  };
}

function clearPageSections() {
  if (gamesBox) {
    gamesBox.innerHTML =
      "<p>Loading today's MLB games...</p>";
  }

  if (hrPicksBox) {
    hrPicksBox.innerHTML =
      "<p>Loading HR Pickz...</p>";
  }

  if (hitPicksBox) {
    hitPicksBox.innerHTML =
      "<p>Loading Hit Pickz...</p>";
  }

  if (moneylineBox) {
    moneylineBox.innerHTML =
      "<p>Loading Moneyline Pickz...</p>";
  }

  const nrfiBox =
  document.getElementById("nrfiBox");

if (nrfiBox) {
  nrfiBox.innerHTML =
    "<p>Loading NRFI predictions...</p>";
}
  
  const pitchersBox =
    document.getElementById("pitchersBox");

  if (pitchersBox) {
    pitchersBox.innerHTML =
      "<p>Loading Pitchers to Target...</p>";
  }
}

/*
=========================================================
REBUILD PUBLIC GAMES ARRAY
=========================================================
*/

function rebuildGamesArray() {
  games = (todayData?.games || []).map(game => ({
    id: Number(game.gamePk || game.id || 0),
    gamePk: Number(game.gamePk || game.id || 0),

    date: game.date,
    venue: game.venue || "TBD",

    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,

    awayTeamId: Number(game.awayTeamId || 0),
    homeTeamId: Number(game.homeTeamId || 0),

    awayPitcher:
      normalizePitcherName(game.awayPitcher),

    homePitcher:
      normalizePitcherName(game.homePitcher),

    awayPitcherId:
      Number(game.awayPitcherId || 0),

    homePitcherId:
      Number(game.homePitcherId || 0),

    awayPitcherHand:
       game.awayPitcherHand || "",

    homePitcherHand:
       game.homePitcherHand || "",

    
    awayPitcherStats:
      game.awayPitcherStats || {},

    homePitcherStats:
      game.homePitcherStats || {},

    awayTeamStats:
      game.awayTeamStats || {},

    homeTeamStats:
      game.homeTeamStats || {},

    awayLineup:
      game.awayLineup || [],

    homeLineup:
      game.homeLineup || [],

    awayRecord:
      game.awayRecord || "0-0",

    homeRecord:
      game.homeRecord || "0-0",

    status:
      getGameStatusObject(game),

    statusObject:
      getGameStatusObject(game)
  }));

  window.games = games;
  window.todayData = todayData;
}

/*
=========================================================
BATTER DATA
=========================================================
*/

async function enrichBatter(
  batter,
  teamName,
  opposingPitcherId,
  confirmed = false
) {
  const batterId = getBatterId(batter);

  if (!batterId) {
    return null;
  }

  const [
    playerInfo,
    hitting,
    hitStreak,
    recentForm,
    liveStatcast,
    bvp
  ] = await Promise.all([
    safe(
      () => API.getPlayerInfo(batterId),
      {}
    ),

    safe(
      () => API.getBatterStats(batterId),
      {}
    ),

    safe(
      () => API.getHitStreak(batterId),
      0
    ),

    safe(
      () => API.getRecentForm(batterId),
      emptyRecentForm()
    ),

    typeof StatcastAPI !== "undefined" &&
    typeof StatcastAPI.getPlayerPowerStats === "function"
      ? safe(
          () =>
            StatcastAPI.getPlayerPowerStats(
              batterId
            ),
          emptyStatcast()
        )
      : Promise.resolve(emptyStatcast()),

    opposingPitcherId
      ? safe(
          () =>
            API.getBvP(
              batterId,
              opposingPitcherId
            ),
          {
            atBats: 0,
            hits: 0,
            avg: ".000",
            homeRuns: 0
          }
        )
      : Promise.resolve({
          atBats: 0,
          hits: 0,
          avg: ".000",
          homeRuns: 0
        })
  ]);

  const playerName =
    batter.name ||
    playerInfo.name ||
    "Unknown";

  const statcast =
    mergeStatcastWithFallback(
      playerName,
      liveStatcast
    );

  return {
    id: batterId,

    name: playerName,

    team: teamName,

    position:
      batter.position || "",

    lineupSpot:
      Number(batter.lineupSpot || 9),

    confirmed:
      Boolean(confirmed || batter.confirmed),

    batSide:
      batter.batSide ||
      playerInfo.batSide ||
      "",

    hitting: hitting || {},

    statcast,

    recentForm:
      recentForm || emptyRecentForm(),

    handednessSplit:
      batter.handednessSplit || {},

    hitStreak:
      Number(hitStreak || 0),

    bvp: {
      atBats:
        Number(bvp?.atBats || 0),

      hits:
        Number(bvp?.hits || 0),

      avg:
        bvp?.avg || ".000",

      homeRuns:
        Number(bvp?.homeRuns || 0)
    }
  };
}

/*
=========================================================
PROJECTED LINEUP FALLBACK
=========================================================
*/

function isLikelyPositionPlayer(player = {}) {
  const position = String(
    player.position || ""
  ).toUpperCase();

  return ![
    "P",
    "SP",
    "RP",
    "CP"
  ].includes(position);
}

async function buildProjectedLineup(
  teamId,
  teamName,
  opposingPitcherId
) {
  const roster = await safe(
    () => API.getRoster(teamId, true),
    []
  );

  const positionPlayers = roster
    .filter(isLikelyPositionPlayer)
    .slice(0, 16);

  const playersWithStats = await Promise.all(
    positionPlayers.map(async player => {
      const stats = await safe(
        () => API.getBatterStats(player.id),
        {}
      );

      return {
        ...player,
        stats,

        projectionScore:
          Number(stats.ops || 0) * 1000 +
          Number(stats.homeRuns || 0) * 8 +
          Number(stats.avg || 0) * 100
      };
    })
  );

  const projectedNine = playersWithStats
    .sort(
      (a, b) =>
        b.projectionScore -
        a.projectionScore
    )
    .slice(0, 9);

  const enriched = [];

  for (
    let index = 0;
    index < projectedNine.length;
    index++
  ) {
    const player = projectedNine[index];

    const batter = await enrichBatter(
      {
        ...player,
        lineupSpot: index + 1,
        confirmed: false
      },
      teamName,
      opposingPitcherId,
      false
    );

    if (batter) {
      enriched.push(batter);
    }
  }

  return enriched;
}

/*
=========================================================
CONFIRMED OR PROJECTED LINEUP
=========================================================
*/

async function loadTeamLineup(
  gamePk,
  teamId,
  teamName,
  opposingPitcherId
) {
  const confirmedLineup = await safe(
    () =>
      API.getLineup(
        gamePk,
        teamId,
        true
      ),
    []
  );

  if (
    Array.isArray(confirmedLineup) &&
    confirmedLineup.length >= 7
  ) {
    const enriched = [];

    for (const batter of confirmedLineup) {
      const result = await enrichBatter(
        batter,
        teamName,
        opposingPitcherId,
        true
      );

      if (result) {
        enriched.push(result);
      }
    }

    return enriched;
  }

  return await buildProjectedLineup(
    teamId,
    teamName,
    opposingPitcherId
  );
}

/*
=========================================================
LOAD CURRENT MLB SCHEDULE
=========================================================
*/

async function loadPrebuiltTodayData() {
  try {
    const response = await fetch(
      `data/today.json?_=${Date.now()}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `today.json returned HTTP ${response.status}`
      );
    }

    const data = await response.json();

    if (
      !data ||
      !Array.isArray(data.games)
    ) {
      throw new Error(
        "today.json does not contain a valid games array."
      );
    }

    const currentDate = API.today();

    if (data.date !== currentDate) {
      console.warn(
        `POPS today.json is for ${data.date}, but today is ${currentDate}.`
      );

      return false;
    }

    todayData = {
  ...data,

  games: data.games.map(game => ({
    ...game,

    awayLineup: (game.awayLineup || []).map(
      batter => ({
        ...batter,
        team:
          batter.team ||
          game.awayTeam ||
          "Away Team"
      })
    ),

    homeLineup: (game.homeLineup || []).map(
      batter => ({
        ...batter,
        team:
          batter.team ||
          game.homeTeam ||
          "Home Team"
      })
    )
  }))
};
    loadedScheduleDate = data.date;

    rebuildGamesArray();

    console.log(
      `⚡ POPS loaded ${data.games.length} games from today.json.`
    );

    return true;
  } catch (error) {
    console.warn(
      "POPS could not load prebuilt today.json:",
      error.message
    );

    return false;
  }
}


async function buildGameData(
  scheduleGame
) {
  const gamePk = Number(
    scheduleGame.gamePk ||
    scheduleGame.id ||
    0
  );

  const awayPitcherId = Number(
    scheduleGame.awayPitcherId || 0
  );

  const homePitcherId = Number(
    scheduleGame.homePitcherId || 0
  );

  const [
    awayPitcherStats,
    homePitcherStats,
    awayTeamStats,
    homeTeamStats
  ] = await Promise.all([
    awayPitcherId
      ? safe(
          () =>
            API.getPitcherStats(
              awayPitcherId,
              true
            ),
          {}
        )
      : Promise.resolve({}),

    homePitcherId
      ? safe(
          () =>
            API.getPitcherStats(
              homePitcherId,
              true
            ),
          {}
        )
      : Promise.resolve({}),

    safe(
      () =>
        API.getTeamStats(
          scheduleGame.awayTeamId,
          true
        ),
      {}
    ),

    safe(
      () =>
        API.getTeamStats(
          scheduleGame.homeTeamId,
          true
        ),
      {}
    )
  ]);

  const game = {
    gamePk,

    date:
      scheduleGame.date,

    venue:
      scheduleGame.venue || "TBD",

    awayTeam:
      scheduleGame.awayTeam,

    homeTeam:
      scheduleGame.homeTeam,

    awayTeamId:
      Number(scheduleGame.awayTeamId || 0),

    homeTeamId:
      Number(scheduleGame.homeTeamId || 0),

    awayRecord:
      scheduleGame.awayRecord || "0-0",

    homeRecord:
      scheduleGame.homeRecord || "0-0",

    awayPitcher:
      normalizePitcherName(
        scheduleGame.awayPitcher
      ),

    homePitcher:
      normalizePitcherName(
        scheduleGame.homePitcher
      ),

    awayPitcherId,
    homePitcherId,

    awayPitcherStats:
      awayPitcherStats || {},

    homePitcherStats:
      homePitcherStats || {},

    awayTeamStats:
      awayTeamStats || {},

    homeTeamStats:
      homeTeamStats || {},

    awayLineup: [],
    homeLineup: [],

    status:
      scheduleGame.statusObject || {}
  };

  const [
    awayLineup,
    homeLineup
  ] = await Promise.all([
    loadTeamLineup(
      gamePk,
      game.awayTeamId,
      game.awayTeam,
      homePitcherId
    ),

    loadTeamLineup(
      gamePk,
      game.homeTeamId,
      game.homeTeam,
      awayPitcherId
    )
  ]);

  game.awayLineup = awayLineup;
  game.homeLineup = homeLineup;

  return game;
}

async function loadTodayData(
  forceRefresh = false
) {
  if (
    typeof API === "undefined" ||
    typeof API.getSchedule !== "function"
  ) {
    throw new Error(
      "API is unavailable. Make sure api.js loads before app.js."
    );
  }

  /*
  First try the prebuilt GitHub data.

  This file already contains:
  - Games
  - Starting pitchers
  - Pitcher stats
  - Lineups
  - Batter stats
  - Recent form
  - Hit streaks
  - BvP
  */
  if (!forceRefresh) {
    const prebuiltLoaded =
      await loadPrebuiltTodayData();

    if (prebuiltLoaded) {
      return;
    }
  }

  /*
  Fall back to live MLB requests only when
  today.json is unavailable or outdated.
  */
  const requestedDate = API.today();

  console.log(
    "📡 POPS loading live MLB schedule:",
    requestedDate
  );

  const schedule = await API.getSchedule(
    true
  );

  if (!Array.isArray(schedule)) {
    throw new Error(
      "MLB schedule response was invalid."
    );
  }

  todayData = {
    date: requestedDate,
    games: []
  };

  loadedScheduleDate = requestedDate;

  /*
  Process multiple games at once instead of
  waiting for every game one by one.
  */
  const GAME_LOAD_LIMIT = 3;

  for (
    let index = 0;
    index < schedule.length;
    index += GAME_LOAD_LIMIT
  ) {
    const batch = schedule.slice(
      index,
      index + GAME_LOAD_LIMIT
    );

    const builtGames = await Promise.all(
      batch.map(scheduleGame =>
        buildGameData(scheduleGame)
      )
    );

    todayData.games.push(
      ...builtGames.filter(Boolean)
    );

    rebuildGamesArray();
    renderGames();
  }

  rebuildGamesArray();

  console.log(
    `✅ POPS loaded ${todayData.games.length} live games for ${loadedScheduleDate}.`
  );
}

/*
=========================================================
DISPLAY TODAY'S GAMES
=========================================================
*/

function renderGames() {
  if (!gamesBox) return;

  if (!games.length) {
    gamesBox.innerHTML = `
      <div class="pick-card">
        <h3>No MLB Games Scheduled</h3>
        <p>
          No MLB games were found for
          ${loadedScheduleDate || API.today()}.
        </p>
      </div>
    `;

    return;
  }

  gamesBox.innerHTML = games
    .map(game => `
      <div class="pick-card game-card">
        <h3>
          ${game.awayTeam} vs
          ${game.homeTeam}
        </h3>

        <p>⏰ ${formatTime(game.date)}</p>
        <p>🏟️ ${game.venue}</p>

        <p>
          <strong>${game.awayTeam}:</strong>
          ${game.awayPitcher}
        </p>

        <p>
          <strong>${game.homeTeam}:</strong>
          ${game.homePitcher}
        </p>
      </div>
    `)
    .join("");
}

/*
=========================================================
LIVE MLB GAME FEED
=========================================================
*/

async function getLiveGameFeed(gamePk) {
  if (!gamePk) return null;

  if (
    typeof API !== "undefined" &&
    typeof API.getLiveGame === "function"
  ) {
    return await API.getLiveGame(
      gamePk,
      true
    );
  }

  const response = await fetch(
    `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live?_=${Date.now()}`,
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(
      `Could not load MLB feed for game ${gamePk}`
    );
  }

  return response.json();
}

function getStarterFromFeed(
  feed,
  side
) {
  const probablePitcher =
    feed?.gameData?.probablePitchers?.[side] ||
    null;

  if (probablePitcher?.id) {
    return {
      id:
        Number(probablePitcher.id),

      name:
        normalizePitcherName(
          probablePitcher.fullName ||
          probablePitcher.name
        )
    };
  }

  const players =
    feed?.liveData?.boxscore
      ?.teams?.[side]?.players || {};

  const starterEntry =
    Object.values(players).find(player => {
      const gameStatus =
        player?.gameStatus || {};

      const stats =
        player?.stats?.pitching || {};

      return (
        gameStatus.isCurrentPitcher === true ||
        gameStatus.isStarter === true ||
        Number(stats.gamesStarted || 0) > 0
      );
    });

  if (starterEntry?.person?.id) {
    return {
      id:
        Number(starterEntry.person.id),

      name:
        normalizePitcherName(
          starterEntry.person.fullName
        )
    };
  }

  return {
    id: 0,
    name: "TBD"
  };
}

/*
=========================================================
PITCHER CACHE MANAGEMENT
=========================================================
*/

async function getUpdatedPitcherStats(
  pitcherId
) {
  if (!pitcherId) return {};

  return safe(
    () =>
      API.getPitcherStats(
        pitcherId,
        true
      ),
    {}
  );
}

function clearPitcherCaches(
  oldPitcherId,
  newPitcherId
) {
  if (typeof API === "undefined") return;

  if (
    typeof API.clearPitcherCache ===
    "function"
  ) {
    API.clearPitcherCache(
      oldPitcherId,
      newPitcherId
    );
  }

  if (
    typeof API.clearBvpCache ===
    "function"
  ) {
    API.clearBvpCache();
  }
}

/*
=========================================================
BVP REFRESH AFTER STARTER CHANGE
=========================================================
*/

async function refreshLineupBvp(
  lineup,
  pitcherId
) {
  if (!Array.isArray(lineup)) return;

  for (const batter of lineup) {
    const batterId = getBatterId(batter);

    batter.bvp = {
      atBats: 0,
      hits: 0,
      avg: ".000",
      homeRuns: 0
    };

    if (!batterId || !pitcherId) {
      continue;
    }

    const newBvp = await safe(
      () =>
        API.getBvP(
          batterId,
          pitcherId,
          true
        ),
      null
    );

    if (newBvp) {
      batter.bvp = {
        atBats:
          Number(newBvp.atBats || 0),

        hits:
          Number(newBvp.hits || 0),

        avg:
          newBvp.avg || ".000",

        homeRuns:
          Number(newBvp.homeRuns || 0)
      };
    }
  }
}

/*
=========================================================
APPLY STARTER CHANGE
=========================================================
*/

async function applyStarterUpdate(
  game,
  side,
  starter
) {
  const pitcherKey =
    side === "away"
      ? "awayPitcher"
      : "homePitcher";

  const pitcherIdKey =
    side === "away"
      ? "awayPitcherId"
      : "homePitcherId";

  const pitcherStatsKey =
    side === "away"
      ? "awayPitcherStats"
      : "homePitcherStats";

  const opponentLineupKey =
    side === "away"
      ? "homeLineup"
      : "awayLineup";

  const previousName =
    normalizePitcherName(
      game[pitcherKey]
    );

  const previousId =
    Number(game[pitcherIdKey] || 0);

  const nextName =
    normalizePitcherName(
      starter?.name
    );

  const nextId =
    Number(starter?.id || 0);

  if (!hasNamedStarter(nextName, nextId)) {
    return false;
  }

  const nameChanged =
    previousName.toLowerCase() !==
    nextName.toLowerCase();

  const idChanged =
    previousId !== nextId;

  if (!nameChanged && !idChanged) {
    return false;
  }

  console.log(
    `⚾ POPS starter update: ${previousName} → ${nextName}`
  );

  clearPitcherCaches(
    previousId,
    nextId
  );

  game[pitcherKey] = nextName;
  game[pitcherIdKey] = nextId;

  game[pitcherStatsKey] =
    await getUpdatedPitcherStats(nextId);

  await refreshLineupBvp(
    game[opponentLineupKey],
    nextId
  );

  return true;
}

/*
=========================================================
CHECK FOR STARTER CHANGES
=========================================================
*/

async function checkForStarterUpdates() {
  if (
    starterRefreshRunning ||
    !todayData ||
    !Array.isArray(todayData.games)
  ) {
    return false;
  }

  starterRefreshRunning = true;

  let starterChanged = false;

  try {
    for (const game of todayData.games) {
      if (!game?.gamePk) continue;
      if (!gameHasNotStarted(game)) continue;

      const feed = await safe(
        () =>
          getLiveGameFeed(
            game.gamePk
          ),
        null
      );

      if (!feed) continue;

      game.status =
        feed?.gameData?.status ||
        game.status ||
        {};

      const awayStarter =
        getStarterFromFeed(
          feed,
          "away"
        );

      const homeStarter =
        getStarterFromFeed(
          feed,
          "home"
        );

      const awayChanged =
        await applyStarterUpdate(
          game,
          "away",
          awayStarter
        );

      const homeChanged =
        await applyStarterUpdate(
          game,
          "home",
          homeStarter
        );

      if (awayChanged || homeChanged) {
        starterChanged = true;
      }
    }

    if (starterChanged) {
      rebuildGamesArray();
      renderGames();
      await recalculateAllPicks();
    }

    stopStarterRefreshWhenFinished();

    return starterChanged;
  } finally {
    starterRefreshRunning = false;
  }
}

/*
=========================================================
STARTER MONITOR
=========================================================
*/

function hasPregameGamesRemaining() {
  return (todayData?.games || []).some(
    game => gameHasNotStarted(game)
  );
}

function startStarterRefresh() {
  if (starterRefreshTimer) {
    clearInterval(starterRefreshTimer);
  }

  starterRefreshTimer = setInterval(() => {
    checkForStarterUpdates().catch(err => {
      console.warn(
        "POPS starter refresh error:",
        err
      );
    });
  }, STARTER_REFRESH_INTERVAL);

  console.log(
    "✅ POPS starter monitor active."
  );
}

function stopStarterRefreshWhenFinished() {
  if (hasPregameGamesRemaining()) {
    return;
  }

  if (starterRefreshTimer) {
    clearInterval(starterRefreshTimer);
    starterRefreshTimer = null;

    console.log(
      "🛑 POPS starter monitor stopped."
    );
  }
}

/*
=========================================================
BATTER STAT HELPERS
=========================================================
*/

function mergeBatterStats(batter = {}) {
  const hitting = batter.hitting || {};

  const avg = Number(hitting.avg || 0);
  const slg = Number(hitting.slg || 0);
  const ops = Number(hitting.ops || 0);

  return {
    ...hitting,

    avg,
    slg,
    ops,

    homeRuns:
      Number(hitting.homeRuns || 0),

    hits:
      Number(hitting.hits || 0),

    atBats:
      Number(hitting.atBats || 0),

    iso:
      Number(
        hitting.iso ||
        (
          slg > 0
            ? slg - avg
            : 0
        )
      )
  };
}

/*
=========================================================
HR PICKS
=========================================================
*/

function addHRPick(
  game,
  batter,
  pitcherName,
  pitcherStats,
  pitcherHand = "",
  teamName = ""
) {
  const batterStats =
    mergeBatterStats(batter);

  const recentForm =
    batter.recentForm || emptyRecentForm();

  const statcast =
    batter.statcast || emptyStatcast();

  const hrLast10 =
    Number(recentForm.homeRuns || 0);

  const opsLast10 =
    Number(recentForm.ops || 0);

  const isoLast10 =
    Number(recentForm.iso || 0);

  const barrelRate =
    Number(
      statcast.barrelRate ||
      statcast.barrelPct ||
      0
    );

  const hardHitRate =
    Number(
      statcast.hardHitRate ||
      statcast.hardHitPct ||
      0
    );

  const exitVelocity =
    Number(
      statcast.avgExitVelo ||
      statcast.avgExitVelocity ||
      statcast.exitVelocity ||
      0
    );

  const flyBallRate =
    Number(
      statcast.flyBallRate ||
      statcast.flyBallPct ||
      0
    );

  const launchAngle =
    Number(
      statcast.launchAngle ||
      statcast.avgLaunchAngle ||
      0
    );

  const sweetSpotRate =
    Number(
      statcast.sweetSpotRate ||
      statcast.sweetSpotPct ||
      0
    );

  const bvpStats =
    batter.bvp || {
      atBats: 0,
      hits: 0,
      avg: ".000",
      homeRuns: 0
    };

  const bvpHR =
    Number(bvpStats.homeRuns || 0);

  const hitStreak =
    Number(batter.hitStreak || 0);

  const batterHand =
    String(batter.batSide || "")
      .toUpperCase();

  const normalizedPitcherHand =
    String(pitcherHand || "")
      .toUpperCase();

  const hasPlatoonAdvantage =
    batterHand === "S" ||
    (
      batterHand === "L" &&
      normalizedPitcherHand === "R"
    ) ||
    (
      batterHand === "R" &&
      normalizedPitcherHand === "L"
    );

  if (
    typeof Formula === "undefined" ||
    typeof Formula.getHRScore !==
      "function"
  ) {
    console.error(
      "Formula.getHRScore is unavailable."
    );

    return;
  }

  const modelBatter = {
    ...batter,

    hitting: {
      ...batterStats,

      plateAppearances:
        Number(
          batterStats.plateAppearances || 0
        ),

      atBats:
        Number(batterStats.atBats || 0),

      hits:
        Number(batterStats.hits || 0),

      doubles:
        Number(batterStats.doubles || 0),

      triples:
        Number(batterStats.triples || 0),

      homeRuns:
        Number(batterStats.homeRuns || 0),

      extraBaseHits:
        Number(
          batterStats.extraBaseHits ||
          (
            Number(
              batterStats.doubles || 0
            ) +
            Number(
              batterStats.triples || 0
            ) +
            Number(
              batterStats.homeRuns || 0
            )
          )
        ),

      avg:
        Number(batterStats.avg || 0),

      slg:
        Number(batterStats.slg || 0),

      ops:
        Number(batterStats.ops || 0),

      iso:
        Number(batterStats.iso || 0),

      hrRate:
        Number(batterStats.hrRate || 0),

      extraBaseHitRate:
        Number(
          batterStats.extraBaseHitRate ||
          0
        )
    },

    statcast,
    recentForm,

    handednessSplit:
      batter.handednessSplit || {},

    bvp: bvpStats,
    hitStreak,
    batSide: batterHand
  };

  const result = Formula.getHRScore({
    batter: modelBatter,

    pitcher: {
      ...pitcherStats
    },

    pitcherHand:
      normalizedPitcherHand,

    handednessSplit:
      batter.handednessSplit || {},

    recentForm
  });

  const breakdown =
    Array.isArray(result?.breakdown)
      ? result.breakdown
      : [];

  hrPicks.push({
  id: getBatterId(batter),

  player: batter.name,
    
    team:
      teamName ||
      batter.team ||
      "Team N/A",

    gamePk:
      Number(
        game.gamePk ||
        game.id ||
        0
      ),  
    
    position: batter.position,

    pitcher:
      normalizePitcherName(
        pitcherName
      ),

    game:
      `${game.awayTeam} vs ${game.homeTeam}`,

    gameTime:
      formatTime(game.date),

    lineupSpot:
      batter.lineupSpot,

    confirmed:
      Boolean(batter.confirmed),

    batterHand,
    pitcherHand:
      normalizedPitcherHand,

    hasPlatoonAdvantage,

    bvpHR,
    bvpStats,
    hitStreak,

    hrLast10,
    opsLast10,
    isoLast10,

    recentForm,
    statcast,

    barrelRate,
    hardHitRate,
    exitVelocity,
    flyBallRate,
    launchAngle,
    sweetSpotRate,

    score:
      Number(result?.score || 0),

    tier:
      result?.tier || "",

    confidence:
      result?.confidence || {},

    breakdown,

    dataAvailability:
      result?.dataAvailability || {}
  });
}

async function loadHRPicks() {
  if (!hrPicksBox) return;

  hrPicksBox.innerHTML =
    "<p>Loading HR Pickz...</p>";

  hrPicks = [];

  for (const game of todayData.games) {
    
    const awayPitcherInfo = {
      pitchHand:
        game.awayPitcherHand || ""
   };

     const homePitcherInfo = {
       pitchHand:
         game.homePitcherHand || ""
   };

    /*
    Batter enrichment already loaded:
    - season hitting
    - hit streak
    - recent form
    - Statcast
    - BvP
    */
    
    for (
  const batter of
  game.awayLineup || []
) {
  addHRPick(
    game,
    batter,
    game.homePitcher,
    game.homePitcherStats || {},
    homePitcherInfo.pitchHand || "",
    game.awayTeam
  );
}

    for (
  const batter of
  game.homeLineup || []
) {
  addHRPick(
    game,
    batter,
    game.awayPitcher,
    game.awayPitcherStats || {},
    awayPitcherInfo.pitchHand || "",
    game.homeTeam
  );
}
  }

  const uniquePlayers = {};

  for (const pick of hrPicks) {
    const key =
      `${pick.player}-${pick.team}`;

    if (
      !uniquePlayers[key] ||
      pick.score >
        uniquePlayers[key].score
    ) {
      uniquePlayers[key] = pick;
    }
  }

  const rankedHRCandidates =
  Object.values(uniquePlayers).sort(
    (a, b) =>
      Number(b.score || 0) -
      Number(a.score || 0)
  );

hrPicks =
  DailyPickLock.getLockedPicks(
    "hr",
    rankedHRCandidates,
    20
  );

window.hrPicks = hrPicks;

  if (!hrPicks.length) {
    hrPicksBox.innerHTML = `
      <div class="pick-card">
        <h3>No HR Pickz Found</h3>
        <p>
          Lineups or player data may not
          be available yet.
        </p>
      </div>
    `;

    return;
  }

  hrPicksBox.innerHTML = hrPicks
    .slice(0, 20)
    .map(
      (pick, index) => `
        <div class="hr-card">
          <div class="hr-rank">
            #${index + 1}
          </div>

          <h3>💣 ${pick.player}</h3>

          <p>
            <strong>Team:</strong>
            ${pick.team}
          </p>

          <p>
            <strong>Game:</strong>
            ${pick.game}
          </p>

          <p>
            <strong>Date/Time:</strong>
            ${pick.gameTime}
          </p>

          <p>
            <strong>Vs Pitcher:</strong>
            ${pick.pitcher}
          </p>

          <p>
            <strong>Batting Spot:</strong>
            ${pick.lineupSpot}
          </p>

          <p>
            <strong>Lineup:</strong>
            ${
              pick.confirmed
                ? "✅ Confirmed lineup"
                : "🟡 Projected lineup"
            }
          </p>

          <p>
            <strong>Platoon Edge:</strong>
            ${
              pick.hasPlatoonAdvantage
                ? "✅ Yes"
                : "❌ No"
            }
          </p>

          <p>
            <strong>Previous HR vs Pitcher:</strong>
            ${pick.bvpHR}
          </p>

          <p>
            <strong>BvP History:</strong>
            ${pick.bvpStats?.hits || 0}/${
              pick.bvpStats?.atBats || 0
            },
            AVG ${
              pick.bvpStats?.avg || ".000"
            }
          </p>

          <p>
            <strong>Hit Streak:</strong>
            ${pick.hitStreak} games
          </p>

          <p>
            <strong>💣 HR in Last 10 Games:</strong>
            ${pick.hrLast10}
          </p>

          <p>
            <strong>📈 OPS Last 10:</strong>
            ${formatDecimal(
              pick.opsLast10,
              3
            )}
          </p>

          <div class="hr-statcast-summary">
            <p>
              <strong>🔥 Barrel Rate:</strong>
              ${formatMetric(
                pick.barrelRate,
                "%",
                1
              )}
            </p>

            <p>
              <strong>💥 Hard-Hit Rate:</strong>
              ${formatMetric(
                pick.hardHitRate,
                "%",
                1
              )}
            </p>

            <p>
              <strong>🚀 Exit Velocity:</strong>
              ${formatMetric(
                pick.exitVelocity,
                " MPH",
                1
              )}
            </p>

            <p>
              <strong>📐 Launch Angle:</strong>
              ${formatMetric(
                pick.launchAngle,
                "°",
                1
              )}
            </p>

            <p>
              <strong>☁️ Fly-Ball Rate:</strong>
              ${formatMetric(
                pick.flyBallRate,
                "%",
                1
              )}
            </p>

            <p>
              <strong>🎯 Sweet-Spot Rate:</strong>
              ${formatMetric(
                pick.sweetSpotRate,
                "%",
                1
              )}
            </p>
          </div>

          <p>
            <strong>POPS HR Score:</strong>
            <span class="score">
              ${pick.score}/100
            </span>
          </p>

          <div class="hr-breakdown">
            ${(pick.breakdown || [])
              .map(item => `
                <div class="hr-breakdown-row">
                  <span class="hr-breakdown-label">
                    ${item.icon || ""}
                    ${item.label || ""}
                  </span>

                  <span class="hr-breakdown-score">
                    ${item.score || 0}/${
                      item.max || 0
                    }
                  </span>
                </div>
              `)
              .join("")}
          </div>

          <div class="hr-model-summary">
            <p>
              ⭐ <strong>Confidence:</strong>
              ${
                pick.confidence?.label ||
                "Low"
              }
              (${
                pick.confidence?.score ||
                0
              }%)
            </p>

            <p>${pick.tier || ""}</p>
          </div>
        </div>
      `
    )
    .join("");

  /*
  Generate the HR parlay combinations after
  the final HR rankings are ready.
  */
  if (
    typeof Parlays !== "undefined" &&
    typeof Parlays.render === "function"
  ) {
    Parlays.render(hrPicks);
  }
}
/*
=========================================================
HIT PICKS
=========================================================
*/

function addHitPick(
  game,
  batter,
  pitcherName,
  teamName = ""
) {
  const stats =
    mergeBatterStats(batter);

  const bvpStats =
    batter.bvp || {
      atBats: 0,
      hits: 0,
      avg: ".000",
      homeRuns: 0
    };

  const bvpHR =
    Number(bvpStats.homeRuns || 0);

  const hitStreak =
    Number(batter.hitStreak || 0);

  if (
    hitStreak < 2 &&
    bvpHR <= 0 &&
    Number(bvpStats.hits || 0) <= 0
  ) {
    return;
  }

  if (
    typeof Formula === "undefined" ||
    typeof Formula.getHitScore !==
      "function"
  ) {
    return;
  }

  const score = Formula.getHitScore(
    batter.name,
    batter.lineupSpot,
    hitStreak,
    bvpHR,
    {
      ...stats,
      recentForm:
        batter.recentForm || {}
    }
  );

 hitPicks.push({
  id: getBatterId(batter),

  player: batter.name,

  team:
    teamName ||
    batter.team ||
    "Team N/A",

  gamePk:
    Number(
      game.gamePk ||
      game.id ||
      0
    ),

  game:
    `${game.awayTeam} vs ${game.homeTeam}`,

  gameTime:
    formatTime(game.date),

  pitcher:
    normalizePitcherName(
      pitcherName
    ),

    lineupSpot:
      batter.lineupSpot,

    confirmed:
      batter.confirmed,

    hitStreak,
    bvpHR,
    bvpStats,
    score
  });
}

async function loadHitPicks() {
  if (!hitPicksBox) return;

  hitPicksBox.innerHTML =
    "<p>Loading Hit Pickz...</p>";

  hitPicks = [];

  for (const game of todayData.games) {
    for (
      const batter of
      game.awayLineup || []
    ) {
      addHitPick(
       game,
       batter,
       game.homePitcher,
       game.awayTeam
  );
    }

    for (
      const batter of
      game.homeLineup || []
    ) {
      addHitPick(
      game,
      batter,
      game.awayPitcher,
      game.homeTeam
);
    }
  }

  const uniquePlayers = {};

  for (const pick of hitPicks) {
    const key =
      `${pick.player}-${pick.team}`;

    if (
      !uniquePlayers[key] ||
      pick.score >
        uniquePlayers[key].score
    ) {
      uniquePlayers[key] = pick;
    }
  }

  hitPicks =
    Object.values(uniquePlayers);

  hitPicks.sort(
    (a, b) =>
      b.hitStreak - a.hitStreak ||
      b.bvpHR - a.bvpHR ||
      Number(b.bvpStats?.hits || 0) -
        Number(a.bvpStats?.hits || 0) ||
      b.score - a.score
  );

  window.hitPicks = hitPicks;

  if (!hitPicks.length) {
    hitPicksBox.innerHTML = `
      <div class="pick-card">
        <h3>No Hit Pickz Found</h3>

        <p>
          No available batters currently
          have a 2+ game hit streak or
          previous success against today's
          pitcher.
        </p>
      </div>
    `;

    return;
  }

  hitPicksBox.innerHTML = hitPicks
    .slice(0, 20)
    .map(
      (pick, index) => `
        <div class="pick-card">
          <span class="rank-badge">
            #${index + 1}
          </span>

          <h3>
            ${pick.player} -
            ${pick.team}
          </h3>

          <p>
            🔥 Hit Streak:
            <span class="score">
              ${pick.hitStreak} games
            </span>
          </p>

          <p>
            💣 Previous HR vs Pitcher:
            <span class="score">
              ${pick.bvpHR}
            </span>
          </p>

          <p>
            📊 Hit Score:
            <span class="score">
              ${pick.score}/100
            </span>
          </p>

          <p>
            ⚾ vs ${pick.pitcher}<br>

            <span class="small">
              Previous vs Pitcher:
              ${pick.bvpStats?.hits || 0}/${
                pick.bvpStats?.atBats || 0
              },
              AVG ${
                pick.bvpStats?.avg || ".000"
              },
              HR ${
                pick.bvpStats?.homeRuns || 0
              }
            </span>
          </p>

          <p>
            📍 Batting spot:
            ${pick.lineupSpot}
          </p>

          <p>
            ${
              pick.confirmed
                ? "✅ Confirmed lineup"
                : "🟡 Projected lineup"
            }
          </p>
        </div>
      `
    )
    .join("");
}

/*
=========================================================
RECALCULATE ALL POPS SECTIONS
=========================================================
*/

async function recalculateAllPicks() {
  if (recalculationRunning) return;

  recalculationRunning = true;

  try {
    rebuildGamesArray();
    renderGames();

    if (
      typeof Pitchers !== "undefined"
    ) {
      Pitchers.box =
        document.getElementById(
          "pitchersBox"
        );

      if (
        typeof Pitchers
          .loadPitcherTargets ===
        "function"
      ) {
        await Pitchers
          .loadPitcherTargets();
      }
    }

    await loadHRPicks();
    await loadHitPicks();

if (
  typeof NRFI !== "undefined" &&
  typeof NRFI.load === "function"
) {
  await NRFI.load(games);
}

if (
  typeof Moneyline !== "undefined" &&
  typeof Moneyline.load ===
    "function"
) {
  await Moneyline.load(games);
}

    console.log(
      "✅ POPS recalculation complete."
    );
  } catch (err) {
    console.error(
      "POPS recalculation error:",
      err
    );
  } finally {
    recalculationRunning = false;
  }
}

/*
=========================================================
NEW-DAY RELOAD
=========================================================
*/

async function reloadForNewDay() {
  if (dailyReloadRunning) return;

  dailyReloadRunning = true;

  try {
    console.log(
      "📅 POPS loading a new daily schedule."
    );

    if (starterRefreshTimer) {
      clearInterval(starterRefreshTimer);
      starterRefreshTimer = null;
    }

    if (
      typeof API !== "undefined" &&
      typeof API.clearAllCaches ===
        "function"
    ) {
      API.clearAllCaches();
    }

    if (
      typeof StatcastAPI !== "undefined" &&
      typeof StatcastAPI.clearCache ===
        "function"
    ) {
      StatcastAPI.clearCache();
    }

    games = [];
    hrPicks = [];
    hitPicks = [];

    todayData = {
      date: API.today(),
      games: []
    };

    clearPageSections();

    await loadTodayData(true);
    await recalculateAllPicks();
    await checkForStarterUpdates();

    if (hasPregameGamesRemaining()) {
      startStarterRefresh();
    }
  } catch (err) {
    console.error(
      "POPS new-day reload error:",
      err
    );
  } finally {
    dailyReloadRunning = false;
  }
}

function startDateWatcher() {
  if (dateCheckTimer) {
    clearInterval(dateCheckTimer);
  }

  dateCheckTimer = setInterval(() => {
    const currentDate = API.today();

    if (
      loadedScheduleDate &&
      currentDate !== loadedScheduleDate
    ) {
      console.log(
        `📅 Date changed: ${loadedScheduleDate} → ${currentDate}`
      );

      reloadForNewDay();
    }
  }, DATE_CHECK_INTERVAL);

  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        const currentDate = API.today();

        if (
          loadedScheduleDate &&
          currentDate !== loadedScheduleDate
        ) {
          reloadForNewDay();
        }
      }
    }
  );
}

/*
=========================================================
INITIALIZE APP
=========================================================
*/

async function init() {
  clearPageSections();

  console.log(
    "🚀 Starting POPS Pickz 11.0"
  );

  console.log(
    "📅 Browser date:",
    API.today()
  );

  await loadTodayData(false);
  
  renderGames();

  await recalculateAllPicks();

/*
Check for starter changes after the page
has already finished its main loading.
*/
if (hasPregameGamesRemaining()) {
  startStarterRefresh();

  setTimeout(() => {
    checkForStarterUpdates().catch(error => {
      console.warn(
        "Initial starter update warning:",
        error
      );
    });
  }, 10000);
}

  startDateWatcher();
}

init().catch(err => {
  console.error(
    "POPS app error:",
    err
  );

  if (hrPicksBox) {
    hrPicksBox.innerHTML = `
      <div class="pick-card">
        <h3>⚠️ Site Loading Error</h3>
        <p>${err.message}</p>
      </div>
    `;
  }

  if (gamesBox) {
    gamesBox.innerHTML = `
      <div class="pick-card">
        <h3>⚠️ Games Could Not Load</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
});

/*
=========================================================
POPS NRFI STADIUM CARD RENDERER
=========================================================
*/

function nrfiNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nrfiText(value, fallback = "N/A") {
  return value !== undefined && value !== null && value !== ""
    ? value
    : fallback;
}

function getTeamLetters(teamName = "") {
  const words = teamName
    .replace(/[^a-zA-Z\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "MLB";

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return words
    .slice(-2)
    .map(word => word.charAt(0))
    .join("")
    .toUpperCase();
}

function formatNrfiGameTime(dateValue) {
  if (!dateValue) return "Time TBD";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return nrfiText(dateValue, "Time TBD");
  }

  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getNrfiRating(score) {
  score = nrfiNumber(score);

  if (score >= 85) {
    return {
      title: "Elite NRFI",
      description: "Top NRFI opportunity",
      cardClass: "elite-card"
    };
  }

  if (score >= 75) {
    return {
      title: "Strong NRFI",
      description: "Strong NRFI lean",
      cardClass: "strong-card"
    };
  }

  if (score >= 65) {
    return {
      title: "Lean NRFI",
      description: "Small NRFI lean",
      cardClass: "lean-card"
    };
  }

  return {
    title: "YRFI Alert",
    description: "First-inning run danger",
    cardClass: "yrfi-card"
  };
}

function createPitcherCard(pitcher = {}) {
  const name = nrfiText(
    pitcher.name || pitcher.fullName,
    "Pitcher TBD"
  );

  const era = nrfiText(pitcher.era, "--");
  const whip = nrfiText(pitcher.whip, "--");

  const hr9 = nrfiText(
    pitcher.hr9 ??
    pitcher.hrPer9 ??
    pitcher.homeRunsPer9,
    "--"
  );

  const score = nrfiNumber(
    pitcher.score ??
    pitcher.pitcherScore ??
    pitcher.nrfiScore,
    0
  );

  return `
    <div class="nrfi-pitcher-card">
      <h4>${name}</h4>

      <div class="nrfi-stat-row">
        <span>ERA</span>
        <strong>${era}</strong>
      </div>

      <div class="nrfi-stat-row">
        <span>WHIP</span>
        <strong>${whip}</strong>
      </div>

      <div class="nrfi-stat-row">
        <span>HR/9</span>
        <strong>${hr9}</strong>
      </div>

      <div class="nrfi-pitcher-total">
        <span>Pitcher Score</span>

        <div>
          <strong>${score}</strong>
          <small>/30</small>
        </div>
      </div>
    </div>
  `;
}

function renderNrfiPredictions(nrfiGames = []) {
  const box = document.getElementById("nrfiPicksBox");

  if (!box) {
    console.warn("nrfiPicksBox was not found.");
    return;
  }

  if (!Array.isArray(nrfiGames) || nrfiGames.length === 0) {
    box.innerHTML = `
      <p class="nrfi-loading">
        No NRFI predictions are available yet.
      </p>
    `;

    updateNrfiSummary([]);
    return;
  }

  const sortedGames = [...nrfiGames].sort((a, b) => {
    return nrfiNumber(b.nrfiScore ?? b.score) -
      nrfiNumber(a.nrfiScore ?? a.score);
  });

  updateNrfiSummary(sortedGames);

  box.innerHTML = sortedGames.map((game, index) => {
    const score = Math.max(
      0,
      Math.min(
        100,
        nrfiNumber(game.nrfiScore ?? game.score)
      )
    );

    const rating = getNrfiRating(score);

    const awayTeam =
      game.awayTeam?.name ||
      game.awayTeamName ||
      game.away ||
      "Away Team";

    const homeTeam =
      game.homeTeam?.name ||
      game.homeTeamName ||
      game.home ||
      "Home Team";

    const venue =
      game.venue?.name ||
      game.venue ||
      game.ballpark ||
      "Venue TBD";

    const gameTime =
      game.gameDate ||
      game.date ||
      game.startTime;

    const awayPitcher =
      game.awayPitcher ||
      game.pitchers?.away ||
      {};

    const homePitcher =
      game.homePitcher ||
      game.pitchers?.home ||
      {};

    const awayConfirmed =
      Boolean(
        game.awayLineupConfirmed ??
        game.lineups?.away?.confirmed
      );

    const homeConfirmed =
      Boolean(
        game.homeLineupConfirmed ??
        game.lineups?.home?.confirmed
      );

    const breakdownText =
      game.breakdown ||
      game.explanation ||
      game.reason ||
      `${rating.title} based on the starting pitchers, team offense and expected top-of-order matchup.`;

    return `
      <article class="nrfi-game-card ${rating.cardClass}">

        <div class="nrfi-rank">
          #${index + 1}
        </div>

        <div class="nrfi-matchup">

          <div class="nrfi-team-logo away">
            ${getTeamLetters(awayTeam)}
          </div>

          <h3 class="nrfi-game-title">
            ${awayTeam}
            <small>vs</small>
            ${homeTeam}
          </h3>

          <div class="nrfi-team-logo home">
            ${getTeamLetters(homeTeam)}
          </div>

        </div>

        <div class="nrfi-game-details">
          <p>
            <span class="nrfi-detail-icon">◷</span>
            ${formatNrfiGameTime(gameTime)}
          </p>

          <p>
            <span class="nrfi-detail-icon">▱</span>
            ${venue}
          </p>
        </div>

        <div class="nrfi-score-panel">

          <div
            class="nrfi-score-ring"
            style="--nrfi-score: ${score};"
          >
            <div class="nrfi-score-number">
              <strong>${score}</strong>
              <span>/100</span>
            </div>
          </div>

          <div class="nrfi-score-copy">
            <span>POPS NRFI Score</span>
            <h4>${rating.title}</h4>

            <p>
              <i class="nrfi-rating-dot"></i>
              ${rating.description}
            </p>
          </div>

        </div>

        <div class="nrfi-pitcher-grid">
          ${createPitcherCard(awayPitcher)}
          ${createPitcherCard(homePitcher)}
        </div>

        <div class="nrfi-lineup-status">

          <div class="nrfi-lineup-item">
            Away lineup:
            <span class="nrfi-check">
              ${awayConfirmed ? "✓" : "!"}
            </span>
            <span class="nrfi-confirmed">
              ${awayConfirmed ? "Confirmed" : "Projected"}
            </span>
          </div>

          <div class="nrfi-lineup-item">
            Home lineup:
            <span class="nrfi-check">
              ${homeConfirmed ? "✓" : "!"}
            </span>
            <span class="nrfi-confirmed">
              ${homeConfirmed ? "Confirmed" : "Projected"}
            </span>
          </div>

        </div>

        <button
          class="nrfi-breakdown-button"
          type="button"
          onclick="toggleNrfiBreakdown(this)"
        >
          View Prediction Breakdown
        </button>

        <div class="nrfi-breakdown">
          <p>${breakdownText}</p>
        </div>

      </article>
    `;
  }).join("");
}

function updateNrfiSummary(nrfiGames = []) {
  const gamesAnalyzed = nrfiGames.length;

  const eliteCount = nrfiGames.filter(game => {
    const score = nrfiNumber(game.nrfiScore ?? game.score);
    return score >= 85;
  }).length;

  const strongCount = nrfiGames.filter(game => {
    const score = nrfiNumber(game.nrfiScore ?? game.score);
    return score >= 75 && score < 85;
  }).length;

  const yrfiCount = nrfiGames.filter(game => {
    const score = nrfiNumber(game.nrfiScore ?? game.score);
    return score < 65;
  }).length;

  const gamesElement =
    document.getElementById("nrfiGamesAnalyzed");

  const eliteElement =
    document.getElementById("nrfiEliteCount");

  const strongElement =
    document.getElementById("nrfiStrongCount");

  const yrfiElement =
    document.getElementById("nrfiYrfiCount");

  if (gamesElement) gamesElement.textContent = gamesAnalyzed;
  if (eliteElement) eliteElement.textContent = eliteCount;
  if (strongElement) strongElement.textContent = strongCount;
  if (yrfiElement) yrfiElement.textContent = yrfiCount;
}

function toggleNrfiBreakdown(button) {
  const card = button.closest(".nrfi-game-card");

  if (!card) return;

  const breakdown = card.querySelector(".nrfi-breakdown");

  if (!breakdown) return;

  const isOpen = breakdown.classList.toggle("open");

  button.textContent = isOpen
    ? "Hide Prediction Breakdown"
    : "View Prediction Breakdown";
}
