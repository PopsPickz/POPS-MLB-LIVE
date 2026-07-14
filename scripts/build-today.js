const fs = require("fs");
const path = require("path");

const MLB_BASE = "https://statsapi.mlb.com/api/v1";
const MLB_LIVE_BASE = "https://statsapi.mlb.com/api/v1.1";

const SAVANT_BASE =
  "https://baseballsavant.mlb.com/statcast_search/csv";

const REQUEST_DELAY_MS = 75;
const STATCAST_REQUEST_DELAY_MS = 125;

/*
=========================================================
SIMPLE IN-MEMORY CACHE
=========================================================
*/

const cache = {
  playerInfo: new Map(),
  pitcherStats: new Map(),
  batterStats: new Map(),
  gameLogs: new Map(),
  hitStreak: new Map(),
  recentForm: new Map(),
  bvp: new Map(),
  roster: new Map(),
  statcast: new Map()
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
  const parsed = Number(
    String(value ?? "")
      .replace("%", "")
      .trim()
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function round(value, places = 1) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Number(
    parsed.toFixed(places)
  );
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
CSV NETWORK HELPERS
=========================================================
*/

async function fetchText(
  url,
  attempts = 3
) {
  for (
    let attempt = 1;
    attempt <= attempts;
    attempt++
  ) {
    try {
      await sleep(
        STATCAST_REQUEST_DELAY_MS
      );

      const response =
        await fetch(url, {
          headers: {
            "User-Agent":
              "POPS-Pickz-MLB",

            Accept:
              "text/csv,text/plain,*/*"
          }
        });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${url}`
        );
      }

      return await response.text();
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }

      console.warn(
        `Statcast request failed. Retrying ${attempt}/${attempts}:`,
        error.message
      );

      await sleep(
        500 * attempt
      );
    }
  }

  return "";
}

function parseCSV(text = "") {
  if (!text.trim()) {
    return [];
  }

  const rows = [];

  let currentCell = "";
  let currentRow = [];
  let insideQuotes = false;

  for (
    let index = 0;
    index < text.length;
    index++
  ) {
    const character =
      text[index];

    const nextCharacter =
      text[index + 1];

    if (
      character === '"' &&
      insideQuotes &&
      nextCharacter === '"'
    ) {
      currentCell += '"';
      index++;
      continue;
    }

    if (character === '"') {
      insideQuotes =
        !insideQuotes;

      continue;
    }

    if (
      character === "," &&
      !insideQuotes
    ) {
      currentRow.push(
        currentCell
      );

      currentCell = "";
      continue;
    }

    if (
      (
        character === "\n" ||
        character === "\r"
      ) &&
      !insideQuotes
    ) {
      if (
        character === "\r" &&
        nextCharacter === "\n"
      ) {
        index++;
      }

      if (
        currentCell !== "" ||
        currentRow.length
      ) {
        currentRow.push(
          currentCell
        );

        rows.push(
          currentRow
        );

        currentCell = "";
        currentRow = [];
      }

      continue;
    }

    currentCell += character;
  }

  if (
    currentCell !== "" ||
    currentRow.length
  ) {
    currentRow.push(
      currentCell
    );

    rows.push(
      currentRow
    );
  }

  if (rows.length < 2) {
    return [];
  }

  const headers =
    rows[0].map(header =>
      String(header).trim()
    );

  return rows
    .slice(1)
    .filter(values =>
      values.some(value =>
        String(value).trim() !== ""
      )
    )
    .map(values => {
      const object = {};

      headers.forEach(
        (header, index) => {
          object[header] =
            values[index] ?? "";
        }
      );

      return object;
    });
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
    {
      length: Math.min(limit, items.length)
    },
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

  const homeRuns =
    number(stat.homeRuns);

  const calculatedHR9 =
    inningsPitched > 0
      ? Number(
          (
            (homeRuns * 9) /
            inningsPitched
          ).toFixed(2)
        )
      : 0;

  const result = {
    id: playerId,

    gamesPlayed:
      number(stat.gamesPlayed),

    gamesStarted:
      number(stat.gamesStarted),

    wins:
      number(stat.wins),

    losses:
      number(stat.losses),

    era:
      number(stat.era),

    whip:
      number(stat.whip),

    inningsPitched,

    inningsPitchedDisplay:
      stat.inningsPitched || "0.0",

    hits:
      number(stat.hits),

    runs:
      number(stat.runs),

    earnedRuns:
      number(stat.earnedRuns),

    homeRuns,

    homeRunsPer9:
      number(stat.homeRunsPer9) ||
      calculatedHR9,

    baseOnBalls:
      number(stat.baseOnBalls),

    strikeOuts:
      number(stat.strikeOuts),

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

  const avg =
    number(stat.avg);

  const slg =
    number(stat.slg);

  const ops =
    number(stat.ops);

  const doubles =
    number(stat.doubles);

  const triples =
    number(stat.triples);

  const homeRuns =
    number(stat.homeRuns);

  const atBats =
    number(stat.atBats);

  const plateAppearances =
    number(stat.plateAppearances);

  const extraBaseHits =
    doubles +
    triples +
    homeRuns;

  const iso =
    slg > 0
      ? Number(
          (slg - avg).toFixed(3)
        )
      : 0;

  const hrRate =
    plateAppearances > 0
      ? Number(
          (
            homeRuns /
            plateAppearances
          ).toFixed(4)
        )
      : 0;

  const extraBaseHitRate =
    atBats > 0
      ? Number(
          (
            extraBaseHits /
            atBats
          ).toFixed(4)
        )
      : 0;

  const result = {
    gamesPlayed:
      number(stat.gamesPlayed),

    plateAppearances,
    atBats,

    runs:
      number(stat.runs),

    hits:
      number(stat.hits),

    doubles,
    triples,
    homeRuns,
    extraBaseHits,

    rbi:
      number(stat.rbi),

    baseOnBalls:
      number(stat.baseOnBalls),

    strikeOuts:
      number(stat.strikeOuts),

    avg,

    obp:
      number(stat.obp),

    slg,
    ops,
    iso,

    hrRate,
    extraBaseHitRate,

    totalBases:
      number(stat.totalBases),

    hasSeasonPowerData:
      plateAppearances > 0 &&
      (
        homeRuns > 0 ||
        slg > 0 ||
        ops > 0
      )
  };

  cache.batterStats.set(playerId, result);

  return result;
}

/*
=========================================================
STATCAST BATTER DATA
=========================================================
*/

function emptyStatcast() {
  return {
    available: false,
    hasStatcastData: false,
    source: "none",

    battedBalls: 0,
    statcastPA: 0,

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

function buildStatcastUrl(
  playerId
) {
  const season =
    getCurrentSeason();

  const params =
    new URLSearchParams();

  params.set("all", "true");
  params.set("hfGT", "R|");
  params.set("hfSea", `${season}|`);
  params.set("player_type", "batter");

  params.set(
    "game_date_gt",
    `${season}-03-01`
  );

  params.set(
    "game_date_lt",
    getEasternDate()
  );

  params.append(
  "batters_lookup[]",
  String(playerId)
);

  params.set("min_pitches", "0");
  params.set("min_results", "0");
  params.set("min_pas", "0");
  params.set("group_by", "name-year");
  params.set("sort_col", "launch_speed");
  params.set(
    "player_event_sort",
    "h_launch_speed"
  );
  params.set("sort_order", "desc");
  params.set("type", "details");

  return (
    `${SAVANT_BASE}?` +
    params.toString()
  );
}

function hasLaunchSpeed(
  row = {}
) {
  return (
    row.launch_speed !== undefined &&
    row.launch_speed !== null &&
    row.launch_speed !== "" &&
    number(row.launch_speed) > 0
  );
}

function hasLaunchAngle(
  row = {}
) {
  return (
    row.launch_angle !== undefined &&
    row.launch_angle !== null &&
    row.launch_angle !== "" &&
    Number.isFinite(
      Number(row.launch_angle)
    )
  );
}

function isStatcastBarrel(
  row = {}
) {
  const category =
    number(
      row.launch_speed_angle
    );

  if (category === 6) {
    return true;
  }

  const exitVelocity =
    number(
      row.launch_speed
    );

  const launchAngle =
    number(
      row.launch_angle
    );

  if (exitVelocity < 98) {
    return false;
  }

  const velocityAbove98 =
    Math.floor(
      exitVelocity - 98
    );

  const lowerBound =
    Math.max(
      8,
      26 - velocityAbove98
    );

  const upperBound =
    Math.min(
      50,
      30 + velocityAbove98
    );

  return (
    launchAngle >= lowerBound &&
    launchAngle <= upperBound
  );
}

function calculateStatcast(
  rows = []
) {
  const battedBalls =
    rows.filter(row =>
      hasLaunchSpeed(row) &&
      hasLaunchAngle(row)
    );

  const total =
    battedBalls.length;

  if (!total) {
    return emptyStatcast();
  }

  let totalExitVelocity = 0;
  let totalLaunchAngle = 0;

  let barrels = 0;
  let hardHits = 0;
  let sweetSpots = 0;
  let flyBalls = 0;
  let pulledBalls = 0;

  for (
    const row of battedBalls
  ) {
    const exitVelocity =
      number(
        row.launch_speed
      );

    const launchAngle =
      number(
        row.launch_angle
      );

    totalExitVelocity +=
      exitVelocity;

    totalLaunchAngle +=
      launchAngle;

    if (
      isStatcastBarrel(row)
    ) {
      barrels++;
    }

    if (
      exitVelocity >= 95
    ) {
      hardHits++;
    }

    if (
      launchAngle >= 8 &&
      launchAngle <= 32
    ) {
      sweetSpots++;
    }

    const battedBallType =
      String(
        row.bb_type || ""
      ).toLowerCase();

    if (
      battedBallType ===
        "fly_ball" ||
      (
        !battedBallType &&
        launchAngle >= 25 &&
        launchAngle <= 50
      )
    ) {
      flyBalls++;
    }

    const direction =
      String(
        row.pull ||
        row.hit_direction ||
        ""
      ).toLowerCase();

    if (
      direction === "pull" ||
      direction === "pulled"
    ) {
      pulledBalls++;
    }
  }

  const barrelRate =
    (barrels / total) * 100;

  const hardHitRate =
    (hardHits / total) * 100;

  const sweetSpotRate =
    (sweetSpots / total) * 100;

  const flyBallRate =
    (flyBalls / total) * 100;

  const pullRate =
    (pulledBalls / total) * 100;

  const exitVelocity =
    totalExitVelocity / total;

  const launchAngle =
    totalLaunchAngle / total;

  return {
    available: true,
    hasStatcastData: true,
    source:
      "baseball-savant-build",

    battedBalls:
      total,

    statcastPA:
      total,

    barrelRate:
      round(barrelRate),

    barrelPct:
      round(barrelRate),

    hardHitRate:
      round(hardHitRate),

    hardHitPct:
      round(hardHitRate),

    exitVelocity:
      round(exitVelocity),

    avgExitVelo:
      round(exitVelocity),

    avgExitVelocity:
      round(exitVelocity),

    launchAngle:
      round(launchAngle),

    avgLaunchAngle:
      round(launchAngle),

    sweetSpotRate:
      round(sweetSpotRate),

    sweetSpotPct:
      round(sweetSpotRate),

    flyBallRate:
      round(flyBallRate),

    flyBallPct:
      round(flyBallRate),

    pullRate:
      round(pullRate),

    pullPct:
      round(pullRate)
  };
}

async function getPlayerStatcast(
  playerId
) {
  playerId =
    number(playerId);

  if (!playerId) {
    return emptyStatcast();
  }

  if (
    cache.statcast.has(
      playerId
    )
  ) {
    return cache.statcast.get(
      playerId
    );
  }

  const url =
    buildStatcastUrl(
      playerId
    );

  try {
    const csv =
      await fetchText(url);

    const rows =
      parseCSV(csv);

    console.log(
  `    Statcast CSV ${playerId}: ${csv.length} characters, ${rows.length} rows`
);

const stats =
  calculateStatcast(
    rows
  );

    cache.statcast.set(
      playerId,
      stats
    );

    console.log(
      `  Statcast ${playerId}: ${stats.battedBalls} batted balls`
    );

    return stats;
  } catch (error) {
    console.warn(
      `Statcast unavailable for ${playerId}:`,
      error.message
    );

    const empty =
      emptyStatcast();

    cache.statcast.set(
      playerId,
      empty
    );

    return empty;
  }
}

/*
=========================================================
SHARED BATTER GAME LOG
Used by hit streak and recent form.
=========================================================
*/

async function getBatterGameLogs(playerId) {
  playerId = number(playerId);

  if (!playerId) return [];

  if (cache.gameLogs.has(playerId)) {
    return cache.gameLogs.get(playerId);
  }

  const season = getCurrentSeason();

  const url =
    `${MLB_BASE}/people/${playerId}/stats` +
    `?stats=gameLog` +
    `&group=hitting` +
    `&season=${season}`;

  const data = await safeFetch(url, null);

  const logs =
    (data?.stats?.[0]?.splits || [])
      .filter(item => item.date)
      .sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      );

  cache.gameLogs.set(playerId, logs);

  return logs;
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

  const games =
    await getBatterGameLogs(playerId);

  let streak = 0;

  for (const game of games) {
    const hits =
      number(game?.stat?.hits);

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
RECENT POWER — LAST 10 GAMES
=========================================================
*/

async function getRecentForm(playerId) {
  playerId = number(playerId);

  const empty = {
    games: 0,
    plateAppearances: 0,
    atBats: 0,
    runs: 0,
    hits: 0,
    doubles: 0,
    triples: 0,
    homeRuns: 0,
    extraBaseHits: 0,
    totalBases: 0,
    rbi: 0,
    baseOnBalls: 0,
    strikeOuts: 0,
    avg: 0,
    obp: 0,
    slg: 0,
    ops: 0,
    iso: 0
  };

  if (!playerId) {
    return empty;
  }

  if (cache.recentForm.has(playerId)) {
    return cache.recentForm.get(playerId);
  }

  const allLogs =
    await getBatterGameLogs(playerId);

  const logs =
    allLogs.slice(0, 10);

  if (!logs.length) {
    cache.recentForm.set(playerId, empty);
    return empty;
  }

  const totals = logs.reduce(
    (result, game) => {
      const stat =
        game?.stat || {};

      result.games += 1;

      result.plateAppearances +=
        number(stat.plateAppearances);

      result.atBats +=
        number(stat.atBats);

      result.runs +=
        number(stat.runs);

      result.hits +=
        number(stat.hits);

      result.doubles +=
        number(stat.doubles);

      result.triples +=
        number(stat.triples);

      result.homeRuns +=
        number(stat.homeRuns);

      result.totalBases +=
        number(stat.totalBases);

      result.rbi +=
        number(stat.rbi);

      result.baseOnBalls +=
        number(stat.baseOnBalls);

      result.strikeOuts +=
        number(stat.strikeOuts);

      result.hitByPitch +=
        number(stat.hitByPitch);

      result.sacFlies +=
        number(stat.sacFlies);

      return result;
    },
    {
      games: 0,
      plateAppearances: 0,
      atBats: 0,
      runs: 0,
      hits: 0,
      doubles: 0,
      triples: 0,
      homeRuns: 0,
      totalBases: 0,
      rbi: 0,
      baseOnBalls: 0,
      strikeOuts: 0,
      hitByPitch: 0,
      sacFlies: 0
    }
  );

  const extraBaseHits =
    totals.doubles +
    totals.triples +
    totals.homeRuns;

  const avg =
    totals.atBats > 0
      ? totals.hits /
        totals.atBats
      : 0;

  const slg =
    totals.atBats > 0
      ? totals.totalBases /
        totals.atBats
      : 0;

  const obpDenominator =
    totals.atBats +
    totals.baseOnBalls +
    totals.hitByPitch +
    totals.sacFlies;

  const obp =
    obpDenominator > 0
      ? (
          totals.hits +
          totals.baseOnBalls +
          totals.hitByPitch
        ) /
        obpDenominator
      : 0;

  const ops =
    obp + slg;

  const iso =
    slg - avg;

  const result = {
    games:
      totals.games,

    plateAppearances:
      totals.plateAppearances,

    atBats:
      totals.atBats,

    runs:
      totals.runs,

    hits:
      totals.hits,

    doubles:
      totals.doubles,

    triples:
      totals.triples,

    homeRuns:
      totals.homeRuns,

    extraBaseHits,

    totalBases:
      totals.totalBases,

    rbi:
      totals.rbi,

    baseOnBalls:
      totals.baseOnBalls,

    strikeOuts:
      totals.strikeOuts,

    avg:
      Number(avg.toFixed(3)),

    obp:
      Number(obp.toFixed(3)),

    slg:
      Number(slg.toFixed(3)),

    ops:
      Number(ops.toFixed(3)),

    iso:
      Number(
        Math.max(0, iso).toFixed(3)
      )
  };

  cache.recentForm.set(playerId, result);

  return result;
}

/*
=========================================================
BATTER VS PITCHER
=========================================================
*/

async function getBvPStats(
  batterId,
  pitcherId
) {
  batterId = number(batterId);
  pitcherId = number(pitcherId);

  const empty = {
    atBats: 0,
    plateAppearances: 0,
    hits: 0,
    doubles: 0,
    triples: 0,
    homeRuns: 0,
    baseOnBalls: 0,
    hitByPitch: 0,
    sacFlies: 0,
    avg: ".000",
    obp: ".000",
    slg: ".000",
    ops: ".000"
  };

  if (!batterId || !pitcherId) {
    return empty;
  }

  const key =
    `career-${batterId}-${pitcherId}`;

  if (cache.bvp.has(key)) {
    return cache.bvp.get(key);
  }

  /*
  No season parameter is used.

  This retrieves career batter-vs-pitcher
  history instead of only the current season.
  */

  const url =
    `${MLB_BASE}/people/${batterId}/stats` +
    `?stats=vsPlayer` +
    `&group=hitting` +
    `&opposingPlayerId=${pitcherId}` +
    `&sportId=1`;

  const data =
    await safeFetch(url, null);

  const splits =
    data?.stats?.[0]?.splits || [];

  let atBats = 0;
  let plateAppearances = 0;
  let hits = 0;
  let doubles = 0;
  let triples = 0;
  let homeRuns = 0;
  let baseOnBalls = 0;
  let hitByPitch = 0;
  let sacFlies = 0;

  for (const split of splits) {
    const stat =
      split?.stat || {};

    atBats += number(
      stat.atBats
    );

    plateAppearances += number(
      stat.plateAppearances
    );

    hits += number(
      stat.hits
    );

    doubles += number(
      stat.doubles
    );

    triples += number(
      stat.triples
    );

    homeRuns += number(
      stat.homeRuns
    );

    baseOnBalls += number(
      stat.baseOnBalls
    );

    hitByPitch += number(
      stat.hitByPitch
    );

    sacFlies += number(
      stat.sacFlies
    );
  }

  const singles =
    Math.max(
      0,
      hits -
      doubles -
      triples -
      homeRuns
    );

  const totalBases =
    singles +
    doubles * 2 +
    triples * 3 +
    homeRuns * 4;

  const avg =
    atBats > 0
      ? hits / atBats
      : 0;

  const obpDenominator =
    atBats +
    baseOnBalls +
    hitByPitch +
    sacFlies;

  const obp =
    obpDenominator > 0
      ? (
          hits +
          baseOnBalls +
          hitByPitch
        ) /
        obpDenominator
      : 0;

  const slg =
    atBats > 0
      ? totalBases / atBats
      : 0;

  const ops =
    obp + slg;

  const result = {
    atBats,

    plateAppearances:
      plateAppearances ||
      (
        atBats +
        baseOnBalls +
        hitByPitch +
        sacFlies
      ),

    hits,
    doubles,
    triples,
    homeRuns,
    baseOnBalls,
    hitByPitch,
    sacFlies,

    avg:
      avg.toFixed(3),

    obp:
      obp.toFixed(3),

    slg:
      slg.toFixed(3),

    ops:
      ops.toFixed(3)
  };

  cache.bvp.set(
    key,
    result
  );

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
        id:
          number(playerId),

        name:
          player?.person?.fullName ||
          "Unknown",

        position:
          player?.position?.abbreviation ||
          "",

        lineupSpot:
          index + 1,

        confirmed:
          true
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
  const code =
    String(position).toUpperCase();

  return (
    !isPitcher(code) &&
    code !== ""
  );
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

  const data =
    await safeFetch(url, null);

  const roster =
    (data?.roster || [])
      .map(item => ({
        id:
          number(item?.person?.id),

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
          isLikelyPositionPlayer(
            player.position
          )
      );

  cache.roster.set(teamId, roster);

  return roster;
}

function getProjectedLineupScore(
  hitting = {}
) {
  const plateAppearances =
    number(hitting.plateAppearances);

  const ops =
    number(hitting.ops);

  const slg =
    number(hitting.slg);

  const iso =
    number(hitting.iso);

  const homeRuns =
    number(hitting.homeRuns);

  /*
  This score only selects likely everyday hitters.
  It is not the POPS HR prediction score.
  */
  return (
    Math.min(
      plateAppearances / 10,
      50
    ) +
    ops * 35 +
    slg * 20 +
    iso * 25 +
    homeRuns * 1.5
  );
}

async function getProjectedLineup(teamId) {
  const roster =
    await getActiveRoster(teamId);

  const enrichedRoster =
    await mapWithConcurrency(
      roster,
      6,
      async player => {
        const hitting =
          await getBatterStats(
            player.id
          );

        return {
          ...player,
          hitting,

          projectedScore:
            getProjectedLineupScore(
              hitting
            )
        };
      }
    );

  const selected =
    enrichedRoster
      .filter(
        player =>
          number(
            player?.hitting
              ?.plateAppearances
          ) > 0
      )
      .sort(
        (a, b) =>
          b.projectedScore -
          a.projectedScore
      )
      .slice(0, 9);

  return selected.map(
    (player, index) => ({
      id:
        player.id,

      name:
        player.name,

      position:
        player.position,

      lineupSpot:
        index + 1,

      confirmed:
        false,

      hitting:
        player.hitting
    })
  );
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
  const playerId =
    number(batter.id);

  const [
  playerInfo,
  hitting,
  hitStreak,
  recentForm,
  bvp,
  statcast
] = await Promise.all([
  getPlayerInfo(playerId),

  batter.hitting
    ? Promise.resolve(
        batter.hitting
      )
    : getBatterStats(playerId),

  getHitStreak(playerId),

  getRecentForm(playerId),

  getBvPStats(
    playerId,
    opposingPitcherId
  ),

  getPlayerStatcast(
    playerId
  )
    
]);
  
  return {
    id:
      playerId,

    name:
      batter.name ||
      playerInfo.name ||
      "Unknown",

    position:
      batter.position ||
      playerInfo.primaryPosition ||
      "",

    lineupSpot:
      number(
        batter.lineupSpot
      ) || 9,

    confirmed:
      batter.confirmed === true,

    batSide:
      playerInfo.batSide || "",

    hitting,

   statcast,
    
    hitStreak,

    recentForm,

    bvp,

    dataQuality: {
      seasonStats:
        number(
          hitting.plateAppearances
        ) > 0,

      statcast:
        statcast.hasStatcastData === true,

      recentForm:
        number(
          recentForm.games
        ) > 0,

      bvp:
        number(
          bvp.atBats
        ) > 0,

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
    getConfirmedLineup(
      liveData,
      side
    );

  if (!lineup.length) {
    console.log(
      `  No confirmed ${side} lineup. Building projected lineup...`
    );

    lineup =
      await getProjectedLineup(
        teamId
      );
  }

  return await mapWithConcurrency(
    lineup,
    3,
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
  const gamePk =
    number(game.gamePk);

  const awayTeamId =
    number(
      game?.teams?.away?.team?.id
    );

  const homeTeamId =
    number(
      game?.teams?.home?.team?.id
    );

  const liveData =
    await getLiveGame(gamePk);

  const awayPitcher =
    resolvePitcher(
      game,
      liveData,
      "away"
    );

  const homePitcher =
    resolvePitcher(
      game,
      liveData,
      "home"
    );

  const [
    awayPitcherStats,
    homePitcherStats,
    awayPitcherInfo,
    homePitcherInfo
  ] = await Promise.all([
    getPitcherStats(
      awayPitcher.id
    ),

    getPitcherStats(
      homePitcher.id
    ),

    getPlayerInfo(
      awayPitcher.id
    ),

    getPlayerInfo(
      homePitcher.id
    )
  ]);

  const [
    awayLineup,
    homeLineup
  ] = await Promise.all([
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

    date:
      game.gameDate,

    status:
      liveData?.gameData?.status
        ?.detailedState ||
      game?.status?.detailedState ||
      "Scheduled",

    statusObject:
      liveData?.gameData?.status ||
      game?.status ||
      {},

    venue:
      liveData?.gameData?.venue
        ?.name ||
      game?.venue?.name ||
      "TBD",

    awayTeam:
      game?.teams?.away?.team
        ?.name ||
      "Away Team",

    homeTeam:
      game?.teams?.home?.team
        ?.name ||
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
      awayPitcherInfo.pitchHand ||
      "",

    homePitcherHand:
      homePitcherInfo.pitchHand ||
      "",

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
  const date =
    getEasternDate();

  console.log(
    `Building POPS data for ${date}...`
  );

  const schedule =
    await getSchedule(date);

  const games = [];

  /*
  Games are processed one at a time to prevent
  too many simultaneous requests.
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
      "POPS Pickz Batter Data 4.0",

    games
  };
}

/*
=========================================================
SHARED DAILY LADDER
=========================================================

Creates one shared data/ladder.json file.

Every phone, laptop and browser will load the same two
players.

The selections remain unchanged for the entire Eastern
date, even when the GitHub workflow runs multiple times.
=========================================================
*/

const LADDER_PICK_COUNT = 2;
const LADDER_POOL_LIMIT = 20;

function getLadderOutputPath() {
  return path.join(
    process.cwd(),
    "data",
    "ladder.json"
  );
}

function getLadderPlayerKey(
  player = {}
) {
  const playerId =
    number(
      player.id ||
      player.playerId
    );

  if (playerId > 0) {
    return `id-${playerId}`;
  }

  return [
    String(
      player.player ||
      player.name ||
      ""
    )
      .toLowerCase()
      .trim(),

    String(
      player.team ||
      ""
    )
      .toLowerCase()
      .trim()
  ].join("-");
}

function removeDuplicateLadderPlayers(
  players = []
) {
  const unique = [];
  const usedKeys =
    new Set();

  for (const player of players) {
    if (!player) {
      continue;
    }

    const key =
      getLadderPlayerKey(
        player
      );

    if (
      !key ||
      usedKeys.has(key)
    ) {
      continue;
    }

    usedKeys.add(key);
    unique.push(player);
  }

  return unique;
}

function shuffleLadderPlayers(
  players = []
) {
  const shuffled =
    [...players];

  for (
    let index =
      shuffled.length - 1;
    index > 0;
    index--
  ) {
    const randomIndex =
      Math.floor(
        Math.random() *
        (index + 1)
      );

    [
      shuffled[index],
      shuffled[randomIndex]
    ] = [
      shuffled[randomIndex],
      shuffled[index]
    ];
  }

  return shuffled;
}

function ladderPlayerQualifies(
  player = {}
) {
  const hitStreak =
    number(
      player.hitStreak
    );

  const bvpHits =
    number(
      player.bvp?.hits
    );

  const bvpAtBats =
    number(
      player.bvp?.atBats
    );

  const bvpPlateAppearances =
    number(
      player.bvp
        ?.plateAppearances
    );

  const hasPitcherHistory =
    bvpAtBats > 0 ||
    bvpPlateAppearances > 0;

  const qualifiesWithHistory =
    hasPitcherHistory &&
    hitStreak >= 2 &&
    bvpHits >= 1;

  const qualifiesWithoutHistory =
    !hasPitcherHistory &&
    hitStreak >= 4;

  return (
    qualifiesWithHistory ||
    qualifiesWithoutHistory
  );
}

function calculateBuilderHitScore(
  batter = {}
) {
  const hitting =
    batter.hitting || {};

  const recentForm =
    batter.recentForm || {};

  const avg =
    number(
      hitting.avg
    );

  const ops =
    number(
      hitting.ops
    );

  const recentOPS =
    number(
      recentForm.ops
    );

  const lineupSpot =
    number(
      batter.lineupSpot
    ) || 9;

  const hitStreak =
    number(
      batter.hitStreak
    );

  const previousHR =
    number(
      batter.bvp?.homeRuns
    );

  let score = 60;

  if (avg >= 0.320) {
    score += 15;
  } else if (avg >= 0.300) {
    score += 12;
  } else if (avg >= 0.280) {
    score += 9;
  } else if (avg >= 0.260) {
    score += 6;
  }

  if (ops >= 0.950) {
    score += 8;
  } else if (ops >= 0.900) {
    score += 6;
  } else if (ops >= 0.850) {
    score += 4;
  }

  if (recentOPS >= 0.950) {
    score += 5;
  }

  if (
    lineupSpot === 3 ||
    lineupSpot === 4
  ) {
    score += 5;
  } else if (
    lineupSpot === 2 ||
    lineupSpot === 5
  ) {
    score += 4;
  } else if (lineupSpot === 1) {
    score += 3;
  } else if (lineupSpot === 6) {
    score += 2;
  } else {
    score += 1;
  }

  if (hitStreak >= 10) {
    score += 10;
  } else if (hitStreak >= 7) {
    score += 8;
  } else if (hitStreak >= 5) {
    score += 6;
  } else if (hitStreak >= 3) {
    score += 4;
  }

  if (previousHR > 0) {
    score += Math.min(
      previousHR * 2,
      6
    );
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(score)
    )
  );
}

function buildLadderCandidate(
  game,
  batter,
  team,
  pitcher
) {
  const bvp =
    batter.bvp || {};

  const bvpAtBats =
    number(
      bvp.atBats
    );

  const bvpPlateAppearances =
    number(
      bvp.plateAppearances
    );

  const hasPitcherHistory =
    bvpAtBats > 0 ||
    bvpPlateAppearances > 0;

  return {
    id:
      number(
        batter.id
      ),

    player:
      batter.name ||
      "Unknown Player",

    team,

    game:
      `${game.awayTeam} vs ${game.homeTeam}`,

    gamePk:
      number(
        game.gamePk
      ),

    gameTime:
      game.date ||
      "",

    pitcher:
      pitcher ||
      "Pitcher TBD",

    lineupSpot:
      number(
        batter.lineupSpot
      ),

    confirmed:
      batter.confirmed === true,

    hitStreak:
      number(
        batter.hitStreak
      ),

    bvpHits:
      number(
        bvp.hits
      ),

    bvpAtBats,

    bvpPlateAppearances,

    bvpAverage:
      bvp.avg ||
      ".000",

    bvpHomeRuns:
      number(
        bvp.homeRuns
      ),

    hasPitcherHistory,

    qualificationReason:
      hasPitcherHistory
        ? (
            "2+ game hit streak and at least " +
            "1 previous hit vs pitcher"
          )
        : (
            "4+ game hit streak with no " +
            "previous pitcher history"
          ),

    score:
      calculateBuilderHitScore(
        batter
      ),

    result:
      "pending",

    hitsToday:
      0
  };
}

function buildSharedLadderPool(
  todayData
) {
  const candidates = [];

  for (
    const game of
    todayData.games || []
  ) {
    for (
      const batter of
      game.awayLineup || []
    ) {
      if (
        !ladderPlayerQualifies(
          batter
        )
      ) {
        continue;
      }

      candidates.push(
        buildLadderCandidate(
          game,
          batter,
          game.awayTeam,
          game.homePitcher
        )
      );
    }

    for (
      const batter of
      game.homeLineup || []
    ) {
      if (
        !ladderPlayerQualifies(
          batter
        )
      ) {
        continue;
      }

      candidates.push(
        buildLadderCandidate(
          game,
          batter,
          game.homeTeam,
          game.awayPitcher
        )
      );
    }
  }

  const uniqueCandidates =
    removeDuplicateLadderPlayers(
      candidates
    );

  /*
  Match the browser Hit Pickz ranking:

  1. Hit streak
  2. Previous BvP hits
  3. BvP batting average
  4. POPS Hit Score
  */

  uniqueCandidates.sort(
    (a, b) => {
      const streakDifference =
        number(b.hitStreak) -
        number(a.hitStreak);

      if (streakDifference !== 0) {
        return streakDifference;
      }

      const bvpHitsDifference =
        number(b.bvpHits) -
        number(a.bvpHits);

      if (bvpHitsDifference !== 0) {
        return bvpHitsDifference;
      }

      const bvpAverageDifference =
        number(b.bvpAverage) -
        number(a.bvpAverage);

      if (
        bvpAverageDifference !== 0
      ) {
        return bvpAverageDifference;
      }

      return (
        number(b.score) -
        number(a.score)
      );
    }
  );

  /*
  The random Ladder is selected from the canonical
  Top 20 shared Hit Pickz pool.
  */

  return uniqueCandidates.slice(
    0,
    LADDER_POOL_LIMIT
  );
}

function loadExistingLadder() {
  const outputPath =
    getLadderOutputPath();

  try {
    if (
      !fs.existsSync(
        outputPath
      )
    ) {
      return null;
    }

    const contents =
      fs.readFileSync(
        outputPath,
        "utf8"
      );

    const parsed =
      JSON.parse(contents);

    if (
      !parsed ||
      !Array.isArray(
        parsed.picks
      )
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn(
      "Could not read existing ladder.json:",
      error.message
    );

    return null;
  }
}

function buildOrPreserveLadder(
  todayData
) {
  const date =
    todayData.date ||
    getEasternDate();

  const existingLadder =
    loadExistingLadder();

  /*
  Preserve the exact same two players when the
  existing file already belongs to today's
  Eastern date.
  */

  if (
    existingLadder?.date === date &&
    existingLadder
      ?.picks?.length ===
        LADDER_PICK_COUNT
  ) {
    console.log(
      "🔒 Preserving today's shared Ladder picks:",
      existingLadder.picks.map(
        pick => pick.player
      )
    );

    return existingLadder;
  }

  const sharedHitPool =
    buildSharedLadderPool(
      todayData
    );

  if (
    sharedHitPool.length <
    LADDER_PICK_COUNT
  ) {
    console.warn(
      `Only ${sharedHitPool.length} eligible shared Ladder players were found.`
    );

    return {
      generatedAt:
        new Date()
          .toISOString(),

      date,

      selectionType:
        "shared-daily-random",

      locked:
        true,

      step:
        1,

      status:
        "unavailable",

      poolSize:
        sharedHitPool.length,

      picks:
        []
    };
  }

  const selectedPicks =
    shuffleLadderPlayers(
      sharedHitPool
    ).slice(
      0,
      LADDER_PICK_COUNT
    );

  const ladder = {
    generatedAt:
      new Date()
        .toISOString(),

    date,

    selectionType:
      "shared-daily-random",

    locked:
      true,

    step:
      1,

    status:
      "pending",

    poolSize:
      sharedHitPool.length,

    picks:
      selectedPicks
  };

  console.log(
    "🎲 Created today's shared Ladder picks:",
    selectedPicks.map(
      pick => pick.player
    )
  );

  return ladder;
}

function saveLadderData(
  ladderData
) {
  const dataDirectory =
    path.join(
      process.cwd(),
      "data"
    );

  const outputPath =
    getLadderOutputPath();

  fs.mkdirSync(
    dataDirectory,
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      ladderData,
      null,
      2
    ),
    "utf8"
  );

  console.log(
    `Shared Ladder saved to ${outputPath}`
  );
}


/*
=========================================================
SAVE TODAY.JSON
=========================================================
*/

async function saveTodayData(todayData) {
  const dataDirectory =
    path.join(
      process.cwd(),
      "data"
    );

  const outputPath =
    path.join(
      dataDirectory,
      "today.json"
    );

  fs.mkdirSync(
    dataDirectory,
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      todayData,
      null,
      2
    ),
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

    await saveTodayData(
      todayData
    );

    const totalBatters =
      todayData.games.reduce(
        (total, game) =>
          total +
          game.awayLineup.length +
          game.homeLineup.length,
        0
      );

    const battersWithRecentForm =
      todayData.games.reduce(
        (total, game) => {
          const allBatters = [
            ...game.awayLineup,
            ...game.homeLineup
          ];

          return (
            total +
            allBatters.filter(
              batter =>
                number(
                  batter?.recentForm
                    ?.games
                ) > 0
            ).length
          );
        },
        0
      );

    const battersWithStatcast =
      todayData.games.reduce(
        (total, game) => {
          const allBatters = [
            ...game.awayLineup,
            ...game.homeLineup
          ];

          return (
            total +
            allBatters.filter(
              batter =>
                batter?.statcast
                  ?.hasStatcastData === true
            ).length
          );
        },
        0
      );

    console.log(
      `✅ Finished: ${todayData.games.length} games and ${totalBatters} batters loaded.`
    );

    console.log(
      `🔥 Recent form loaded for ${battersWithRecentForm}/${totalBatters} batters.`
    );

    console.log(
      `🚀 Statcast loaded for ${battersWithStatcast}/${totalBatters} batters.`
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
