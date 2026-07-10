const fs = require("fs");
const path = require("path");

const MLB_BASE = "https://statsapi.mlb.com/api/v1";
const MLB_LIVE_BASE = "https://statsapi.mlb.com/api/v1.1";

const REQUEST_DELAY_MS = 75;

/*
=========================================================
SIMPLE IN-MEMORY CACHE
=========================================================
*/

const cache = {
  playerInfo: new Map(),
  pitcherStats: new Map(),
  batterStats: new Map(),
  hitStreak: new Map(),
  bvp: new Map(),
  roster: new Map()
};

/*
=========================================================
GENERAL HELPERS
=========================================================
*/

function getEasternDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day}`;
}

function getCurrentSeason() {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric"
    }).format(new Date())
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inningsToNumber(value) {
  const text = String(value || "0");
  const [whole, outs] = text.split(".");

  return number(whole) + number(outs) / 3;
}

async function fetchJSON(url, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "POPS-Pickz-MLB",
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }

      console.warn(
        `Request failed. Retrying ${attempt}/${attempts}:`,
        error.message
      );

      await sleep(400 * attempt);
    }
  }

  return null;
}

async function safeFetch(url, fallback = null) {
  try {
    await sleep(REQUEST_DELAY_MS);
    return await fetchJSON(url);
  } catch (error) {
    console.warn("POPS request warning:", error.message);
    return fallback;
  }
}

/*
=========================================================
LIMITED CONCURRENCY
Prevents hundreds of simultaneous MLB requests.
=========================================================
*/

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex++;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(
        items[currentIndex],
        currentIndex
      );
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );

  await Promise.all(workers);

  return results;
}

/*
=========================================================
SCHEDULE AND LIVE GAME DATA
=========================================================
*/

async function getSchedule(date) {
  const url =
    `${MLB_BASE}/schedule` +
    `?sportId=1` +
    `&date=${date}` +
    `&hydrate=team,probablePitcher,venue`;

  const data = await fetchJSON(url);

  return data?.dates?.[0]?.games || [];
}

async function getLiveGame(gamePk) {
  if (!gamePk) return null;

  const url =
    `${MLB_LIVE_BASE}/game/${gamePk}/feed/live`;

  return await safeFetch(url, null);
}

function getSchedulePitcher(game, side) {
  const pitcher =
    game?.teams?.[side]?.probablePitcher || {};

  return {
    id: number(pitcher.id) || null,
    fullName: pitcher.fullName || "TBD"
  };
}

function getLivePitcher(liveData, side) {
  const pitcher =
    liveData?.gameData?.probablePitchers?.[side];

  if (!pitcher?.id) {
    return null;
  }

  return {
    id: number(pitcher.id) || null,
    fullName:
      pitcher.fullName ||
      pitcher.name ||
      "TBD"
  };
}

function resolvePitcher(game, liveData, side) {
  return (
    getLivePitcher(liveData, side) ||
    getSchedulePitcher(game, side)
  );
}

/*
=========================================================
PLAYER INFORMATION
=========================================================
*/

async function getPlayerInfo(playerId) {
  playerId = number(playerId);

  if (!playerId) {
    return {
      id: 0,
      name: "",
      batSide: "",
      pitchHand: "",
      primaryPosition: ""
    };
  }

  if (cache.playerInfo.has(playerId)) {
    return cache.playerInfo.get(playerId);
  }

  const url = `${MLB_BASE}/people/${playerId}`;
  const data = await safeFetch(url, null);
  const person = data?.people?.[0] || {};

  const result = {
    id: playerId,
    name: person.fullName || "",
    batSide: person?.batSide?.code || "",
    pitchHand: person?.pitchHand?.code || "",
    primaryPosition:
      person?.primaryPosition?.abbreviation || ""
  };

  cache.playerInfo.set(playerId, result);

  return result;
}

/*
=========================================================
PITCHER STATS
=========================================================
*/

async function getPitcherStats(playerId) {
  playerId = number(playerId);

  if (!playerId) return {};

  if (cache.pitcherStats.has(playerId)) {
    return cache.pitcherStats.get(playerId);
  }

  const season = getCurrentSeason();

  const url =
    `${MLB_BASE}/people/${playerId}/stats` +
    `?stats=season` +
    `&group=pitching` +
    `&season=${season}`;

  const data = await safeFetch(url, null);
  const stat =
    data?.stats?.[0]?.splits?.[0]?.stat || {};

  const inningsPitched =
    inningsToNumber(stat.inningsPitched);

  const homeRuns = number(stat.homeRuns);

  const calculatedHR9 =
    inningsPitched > 0
      ? Number(
          ((homeRuns * 9) / inningsPitched).toFixed(2)
        )
      : 0;

  const result = {
    gamesPlayed: number(stat.gamesPlayed),
    gamesStarted: number(stat.gamesStarted),

    wins: number(stat.wins),
    losses: number(stat.losses),

    era: number(stat.era),
    whip: number(stat.whip),

    inningsPitched,
    inningsPitchedDisplay:
      stat.inningsPitched || "0.0",

    hits: number(stat.hits),
    runs: number(stat.runs),
    earnedRuns: number(stat.earnedRuns),

    homeRuns,
    homeRunsPer9:
      number(stat.homeRunsPer9) || calculatedHR9,

    baseOnBalls: number(stat.baseOnBalls),
    strikeOuts: number(stat.strikeOuts),

    strikeoutsPer9Inn:
      number(stat.strikeoutsPer9Inn),

    walksPer9Inn:
      number(stat.walksPer9Inn),

    strikeoutWalkRatio:
      number(stat.strikeoutWalkRatio)
  };

  cache.pitcherStats.set(playerId, result);

  return result;
}

/*
=========================================================
BATTER SEASON STATS
=========================================================
*/

async function getBatterStats(playerId) {
  playerId = number(playerId);

  if (!playerId) return {};

  if (cache.batterStats.has(playerId)) {
    return cache.batterStats.get(playerId);
  }

  const season = getCurrentSeason();

  const url =
    `${MLB_BASE}/people/${playerId}/stats` +
    `?stats=season` +
    `&group=hitting` +
    `&season=${season}`;

  const data = await safeFetch(url, null);
  const stat =
    data?.stats?.[0]?.splits?.[0]?.stat || {};

  const avg = number(stat.avg);
  const slg = number(stat.slg);
  const ops = number(stat.ops);

  const doubles = number(stat.doubles);
  const triples = number(stat.triples);
  const homeRuns = number(stat.homeRuns);
  const atBats = number(stat.atBats);
  const plateAppearances = number(stat.plateAppearances);

  const extraBaseHits =
    doubles + triples + homeRuns;

  const iso =
    slg > 0
      ? Number((slg - avg).toFixed(3))
      : 0;

  const hrRate =
    plateAppearances > 0
      ? Number(
          (homeRuns / plateAppearances).toFixed(4)
        )
      : 0;

  const extraBaseHitRate =
    atBats > 0
      ? Number(
          (extraBaseHits / atBats).toFixed(4)
        )
      : 0;

  const result = {
    gamesPlayed: number(stat.gamesPlayed),

    plateAppearances,
    atBats,

    runs: number(stat.runs),
    hits: number(stat.hits),

    doubles,
    triples,
    homeRuns,
    extraBaseHits,

    rbi: number(stat.rbi),
    baseOnBalls: number(stat.baseOnBalls),
    strikeOuts: number(stat.strikeOuts),

    avg,
    obp: number(stat.obp),
    slg,
    ops,
    iso,

    hrRate,
    extraBaseHitRate,

    totalBases: number(stat.totalBases),

    hasSeasonPowerData:
      plateAppearances > 0 &&
      (homeRuns > 0 || slg > 0 || ops > 0)
  };

  cache.batterStats.set(playerId, result);

  return result;
}

/*
=========================================================
HIT STREAK
=========================================================
*/

async function getHitStreak(playerId) {
  playerId = number(playerId);

  if (!playerId) return 0;

  if (cache.hitStreak.has(playerId)) {
    return cache.hitStreak.get(playerId);
  }

  const season = getCurrentSeason();

  const url =
    `${MLB_BASE}/people/${playerId}/stats` +
    `?stats=gameLog` +
    `&group=hitting` +
    `&season=${season}`;

  const data = await safeFetch(url, null);

  let games =
    data?.stats?.[0]?.splits || [];

  games = games
    .filter(item => item.date)
    .sort(
      (a, b) =>
        new Date(b.date) - new Date(a.date)
    );

  let streak = 0;

  for (const game of games) {
    const hits = number(game?.stat?.hits);

    if (hits >= 1) {
      streak++;
    } else {
      break;
    }
  }

  cache.hitStreak.set(playerId, streak);

  return streak;
}

/*
=========================================================
BATTER VS PITCHER
=========================================================
*/

async function getBvPStats(batterId, pitcherId) {
  batterId = number(batterId);
  pitcherId = number(pitcherId);

  const empty = {
    atBats: 0,
    hits: 0,
    avg: ".000",
    homeRuns: 0
  };

  if (!batterId || !pitcherId) {
    return empty;
  }

  const key = `${batterId}-${pitcherId}`;

  if (cache.bvp.has(key)) {
    return cache.bvp.get(key);
  }

  const season = getCurrentSeason();

  const url =
    `${MLB_BASE}/people/${batterId}/stats` +
    `?stats=vsPlayer` +
    `&group=hitting` +
    `&opposingPlayerId=${pitcherId}` +
    `&season=${season}`;

  const data = await safeFetch(url, null);
  const stat =
    data?.stats?.[0]?.splits?.[0]?.stat || {};

  const result = {
    atBats: number(stat.atBats),
    hits: number(stat.hits),
    avg: stat.avg || ".000",
    homeRuns: number(stat.homeRuns)
  };

  cache.bvp.set(key, result);

  return result;
}

/*
=========================================================
CONFIRMED LINEUPS
=========================================================
*/

function getConfirmedLineup(liveData, side) {
  const teamBox =
    liveData?.liveData?.boxscore?.teams?.[side];

  if (!teamBox) return [];

  const battingOrder =
    teamBox.battingOrder || [];

  const players =
    teamBox.players || {};

  return battingOrder
    .map((playerId, index) => {
      const player =
        players[`ID${playerId}`];

      if (!player) return null;

      return {
        id: number(playerId),

        name:
          player?.person?.fullName ||
          "Unknown",

        position:
          player?.position?.abbreviation ||
          "",

        lineupSpot: index + 1,
        confirmed: true
      };
    })
    .filter(Boolean);
}

/*
=========================================================
ACTIVE ROSTER FALLBACK
=========================================================
*/

function isPitcher(position = "") {
  return ["P", "SP", "RP"].includes(
    String(position).toUpperCase()
  );
}

function isLikelyPositionPlayer(position = "") {
  const code = String(position).toUpperCase();

  return !isPitcher(code) && code !== "";
}

async function getActiveRoster(teamId) {
  teamId = number(teamId);

  if (!teamId) return [];

  if (cache.roster.has(teamId)) {
    return cache.roster.get(teamId);
  }

  const url =
    `${MLB_BASE}/teams/${teamId}/roster` +
    `?rosterType=active`;

  const data = await safeFetch(url, null);

  const roster = (data?.roster || [])
    .map(item => ({
      id: number(item?.person?.id),

      name:
        item?.person?.fullName ||
        "Unknown",

      position:
        item?.position?.abbreviation ||
        ""
    }))
    .filter(
      player =>
        player.id &&
        isLikelyPositionPlayer(player.position)
    );

  cache.roster.set(teamId, roster);

  return roster;
}

function getProjectedLineupScore(hitting = {}) {
  const plateAppearances =
    number(hitting.plateAppearances);

  const ops = number(hitting.ops);
  const slg = number(hitting.slg);
  const iso = number(hitting.iso);
  const homeRuns = number(hitting.homeRuns);

  /*
  This score only selects likely everyday hitters.
  It is not the POPS HR prediction score.
  */
  return (
    Math.min(plateAppearances / 10, 50) +
    ops * 35 +
    slg * 20 +
    iso * 25 +
    homeRuns * 1.5
  );
}

async function getProjectedLineup(teamId) {
  const roster = await getActiveRoster(teamId);

  const enrichedRoster = await mapWithConcurrency(
    roster,
    6,
    async player => {
      const hitting =
        await getBatterStats(player.id);

      return {
        ...player,
        hitting,
        projectedScore:
          getProjectedLineupScore(hitting)
      };
    }
  );

  const selected = enrichedRoster
    .filter(player =>
      number(player?.hitting?.plateAppearances) > 0
    )
    .sort(
      (a, b) =>
        b.projectedScore - a.projectedScore
    )
    .slice(0, 9);

  return selected.map((player, index) => ({
    id: player.id,
    name: player.name,
    position: player.position,
    lineupSpot: index + 1,
    confirmed: false,
    hitting: player.hitting
  }));
}

/*
=========================================================
ENRICH EACH BATTER
=========================================================
*/

async function enrichBatter(
  batter,
  opposingPitcherId
) {
  const playerId = number(batter.id);

  const [
    playerInfo,
    hitting,
    hitStreak,
    bvp
  ] = await Promise.all([
    getPlayerInfo(playerId),

    batter.hitting
      ? Promise.resolve(batter.hitting)
      : getBatterStats(playerId),

    getHitStreak(playerId),

    getBvPStats(
      playerId,
      opposingPitcherId
    )
  ]);

  return {
    id: playerId,

    name:
      batter.name ||
      playerInfo.name ||
      "Unknown",

    position:
      batter.position ||
      playerInfo.primaryPosition ||
      "",

    lineupSpot:
      number(batter.lineupSpot) || 9,

    confirmed:
      batter.confirmed === true,

    batSide:
      playerInfo.batSide || "",

    hitting,

    /*
    Statcast data will be added in the next phase.
    Null means unavailable—not zero performance.
    */
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

    hitStreak,

    bvp,

    dataQuality: {
      seasonStats:
        number(hitting.plateAppearances) > 0,

      statcast: false,

      recentForm:
        hitStreak >= 0,

      bvp:
        number(bvp.atBats) > 0,

      confirmedLineup:
        batter.confirmed === true
    }
  };
}

/*
=========================================================
BUILD TEAM LINEUP
=========================================================
*/

async function buildTeamLineup({
  liveData,
  side,
  teamId,
  opposingPitcherId
}) {
  let lineup =
    getConfirmedLineup(liveData, side);

  if (!lineup.length) {
    console.log(
      `  No confirmed ${side} lineup. Building projected lineup...`
    );

    lineup =
      await getProjectedLineup(teamId);
  }

  return await mapWithConcurrency(
    lineup,
    5,
    batter =>
      enrichBatter(
        batter,
        opposingPitcherId
      )
  );
}

/*
=========================================================
BUILD ONE GAME
=========================================================
*/

async function buildGame(game) {
  const gamePk = number(game.gamePk);

  const awayTeamId =
    number(game?.teams?.away?.team?.id);

  const homeTeamId =
    number(game?.teams?.home?.team?.id);

  const liveData =
    await getLiveGame(gamePk);

  const awayPitcher =
    resolvePitcher(game, liveData, "away");

  const homePitcher =
    resolvePitcher(game, liveData, "home");

  const [
    awayPitcherStats,
    homePitcherStats,
    awayPitcherInfo,
    homePitcherInfo
  ] = await Promise.all([
    getPitcherStats(awayPitcher.id),
    getPitcherStats(homePitcher.id),
    getPlayerInfo(awayPitcher.id),
    getPlayerInfo(homePitcher.id)
  ]);

  const [awayLineup, homeLineup] =
    await Promise.all([
      buildTeamLineup({
        liveData,
        side: "away",
        teamId: awayTeamId,
        opposingPitcherId:
          homePitcher.id
      }),

      buildTeamLineup({
        liveData,
        side: "home",
        teamId: homeTeamId,
        opposingPitcherId:
          awayPitcher.id
      })
    ]);

  return {
    gamePk,
    date: game.gameDate,

    status:
      liveData?.gameData?.status?.detailedState ||
      game?.status?.detailedState ||
      "Scheduled",

    statusObject:
      liveData?.gameData?.status ||
      game?.status ||
      {},

    venue:
      liveData?.gameData?.venue?.name ||
      game?.venue?.name ||
      "TBD",

    awayTeam:
      game?.teams?.away?.team?.name ||
      "Away Team",

    homeTeam:
      game?.teams?.home?.team?.name ||
      "Home Team",

    awayTeamId,
    homeTeamId,

    awayPitcher:
      awayPitcher.fullName ||
      "TBD",

    homePitcher:
      homePitcher.fullName ||
      "TBD",

    awayPitcherId:
      awayPitcher.id || null,

    homePitcherId:
      homePitcher.id || null,

    awayPitcherHand:
      awayPitcherInfo.pitchHand || "",

    homePitcherHand:
      homePitcherInfo.pitchHand || "",

    awayPitcherStats,
    homePitcherStats,

    awayLineup,
    homeLineup
  };
}

/*
=========================================================
BUILD TODAY DATA
=========================================================
*/

async function buildTodayData() {
  const date = getEasternDate();

  console.log(
    `Building POPS data for ${date}...`
  );

  const schedule =
    await getSchedule(date);

  const games = [];

  /*
  Games are processed one at a time to prevent the MLB
  service from receiving too many simultaneous requests.
  */
  for (const game of schedule) {
    const awayName =
      game?.teams?.away?.team?.name ||
      "Away Team";

    const homeName =
      game?.teams?.home?.team?.name ||
      "Home Team";

    console.log(
      `Loading ${awayName} vs ${homeName}`
    );

    try {
      const builtGame =
        await buildGame(game);

      games.push(builtGame);
    } catch (error) {
      console.error(
        `Could not fully build ${awayName} vs ${homeName}:`,
        error.message
      );
    }
  }

  return {
    generatedAt:
      new Date().toISOString(),

    date,

    version:
      "POPS Pickz Batter Data 3.0",

    games
  };
}

/*
=========================================================
SAVE TODAY.JSON
=========================================================
*/

async function saveTodayData(todayData) {
  const dataDirectory =
    path.join(process.cwd(), "data");

  const outputPath =
    path.join(
      dataDirectory,
      "today.json"
    );

  fs.mkdirSync(dataDirectory, {
    recursive: true
  });

  fs.writeFileSync(
    outputPath,
    JSON.stringify(todayData, null, 2),
    "utf8"
  );

  console.log(
    `POPS data saved to ${outputPath}`
  );
}

/*
=========================================================
RUN SCRIPT
=========================================================
*/

async function main() {
  try {
    const todayData =
      await buildTodayData();

    await saveTodayData(todayData);

    const totalBatters =
      todayData.games.reduce(
        (total, game) =>
          total +
          game.awayLineup.length +
          game.homeLineup.length,
        0
      );

    console.log(
      `✅ Finished: ${todayData.games.length} games and ${totalBatters} batters loaded.`
    );
  } catch (error) {
    console.error(
      "❌ POPS data build failed:",
      error
    );

    process.exitCode = 1;
  }
}

main();
