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
POPS REFRESH SETTINGS
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
  if (
    game.status &&
    typeof game.status === "object"
  ) {
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

  /*
  Continue checking for 30 minutes after scheduled time.
  This helps with delays and late starter announcements.
  */
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

  return {
    id: batterId,

    name:
      batter.name ||
      playerInfo.name ||
      "Unknown",

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

    statcast: {
      available: false,
      barrelPct: null,
      hardHitPct: null,
      avgExitVelocity: null,
      launchAngle: null,
      sweetSpotPct: null,
      flyBallPct: null,
      pullPct: null
    },

    recentForm: {},

    handednessSplit: {},

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
  forceRefresh = true
) {
  if (
    typeof API === "undefined" ||
    typeof API.getSchedule !== "function"
  ) {
    throw new Error(
      "API is unavailable. Make sure api.js loads before app.js."
    );
  }

  const requestedDate = API.today();

  console.log(
    "📅 POPS requesting MLB schedule:",
    requestedDate
  );

  const schedule = await API.getSchedule(
    forceRefresh
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
  Build each game one at a time to reduce MLB API congestion.
  */
  for (const scheduleGame of schedule) {
    const game = await buildGameData(
      scheduleGame
    );

    todayData.games.push(game);

    rebuildGamesArray();
  }

  rebuildGamesArray();

  console.log(
    `✅ POPS loaded ${todayData.games.length} games for ${loadedScheduleDate}.`
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

        <p>
          ⏰ ${formatTime(game.date)}
        </p>

        <p>
          🏟️ ${game.venue}
        </p>

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
  const statcast = batter.statcast || {};

  const avg = Number(hitting.avg || 0);
  const slg = Number(hitting.slg || 0);
  const ops = Number(hitting.ops || 0);

  return {
    ...hitting,
    ...statcast,

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
      slg && avg
        ? Number(
            (slg - avg).toFixed(3)
          )
        : 0
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
  pitcherHand = ""
) {
  const batterStats =
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

  const batterHand =
    batter.batSide || "";

  const hasPlatoonAdvantage =
    batterHand === "S" ||
    (
      batterHand === "L" &&
      pitcherHand === "R"
    ) ||
    (
      batterHand === "R" &&
      pitcherHand === "L"
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

    statcast:
      batter.statcast || {
        available: false,
        barrelPct: null,
        hardHitPct: null,
        avgExitVelocity: null,
        launchAngle: null,
        sweetSpotPct: null,
        flyBallPct: null,
        pullPct: null
      },

    recentForm:
      batter.recentForm || {},

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

    pitcherHand,

    handednessSplit:
      batter.handednessSplit || {},

    recentForm:
      batter.recentForm || {}
  });

  const breakdown =
    Array.isArray(result?.breakdown)
      ? result.breakdown
      : [];

  hrPicks.push({
    player: batter.name,
    team: batter.team,
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
      batter.confirmed,

    batterHand,
    pitcherHand,
    hasPlatoonAdvantage,

    bvpHR,
    bvpStats,
    hitStreak,

    score:
      Number(result?.score || 0),

    tier:
      result?.tier || "",

    confidence:
      result?.confidence || {},

    breakdown
  });
}

async function loadHRPicks() {
  if (!hrPicksBox) return;

  hrPicksBox.innerHTML =
    "<p>Loading HR Pickz...</p>";

  hrPicks = [];

  for (const game of todayData.games) {
    const [
      awayPitcherInfo,
      homePitcherInfo
    ] = await Promise.all([
      game.awayPitcherId
        ? safe(
            () =>
              API.getPlayerInfo(
                game.awayPitcherId
              ),
            {}
          )
        : Promise.resolve({}),

      game.homePitcherId
        ? safe(
            () =>
              API.getPlayerInfo(
                game.homePitcherId
              ),
            {}
          )
        : Promise.resolve({})
    ]);

    for (const batter of game.awayLineup || []) {

    if (batter.id) {

        batter.recentForm =
            await API.getRecentForm(batter.id);

        batter.statcast =
            await StatcastAPI.getPlayerPowerStats(
                batter.id
            );

    }

    addHRPick(
        game,
        batter,
        game.homePitcher,
        game.homePitcherStats || {},
        homePitcherInfo.pitchHand || ""
    );

}

    for (const batter of game.homeLineup || []) {

    if (batter.id) {

        batter.recentForm =
            await API.getRecentForm(batter.id);

        batter.statcast =
            await StatcastAPI.getPlayerPowerStats(
                batter.id
            );

    }

    addHRPick(
        game,
        batter,
        game.awayPitcher,
        game.awayPitcherStats || {},
        awayPitcherInfo.pitchHand || ""
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

  hrPicks =
    Object.values(uniquePlayers).sort(
      (a, b) => b.score - a.score
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
}

/*
=========================================================
HIT PICKS
=========================================================
*/

function addHitPick(
  game,
  batter,
  pitcherName
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
    stats
  );

  hitPicks.push({
    player: batter.name,
    team: batter.team,

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
        game.homePitcher
      );
    }

    for (
      const batter of
      game.homeLineup || []
    ) {
      addHitPick(
        game,
        batter,
        game.awayPitcher
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
    "🚀 Starting POPS Pickz 10.0"
  );

  console.log(
    "📅 Browser date:",
    API.today()
  );

  await loadTodayData(true);

  renderGames();

  /*
  Check probable starters immediately.
  */
  await checkForStarterUpdates();

  await recalculateAllPicks();

  if (hasPregameGamesRemaining()) {
    startStarterRefresh();
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
