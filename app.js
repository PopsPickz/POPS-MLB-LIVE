const gamesBox = document.getElementById("gamesBox");
const hrPicksBox = document.getElementById("hrPicksBox");
const hitPicksBox = document.getElementById("hitPicksBox");
const moneylineBox = document.getElementById("moneylineBox");

let todayData = null;
let games = [];
let hrPicks = [];
let hitPicks = [];

/*
=========================================================
POPS AUTOMATIC STARTER REFRESH SETTINGS
=========================================================
*/

const STARTER_REFRESH_INTERVAL = 5 * 60 * 1000;

let starterRefreshTimer = null;
let starterRefreshRunning = false;
let recalculationRunning = false;

/*
=========================================================
GENERAL HELPERS
=========================================================
*/

function formatTime(dateString) {
  return new Date(dateString).toLocaleString([], {
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
  return normalizePitcherName(name) !== "TBD" && Number(id || 0) > 0;
}

function isGameStarted(status = {}) {
  const abstractState = String(
    status.abstractGameState || status.abstractGameCode || ""
  ).toLowerCase();

  const detailedState = String(
    status.detailedState || status.statusCode || ""
  ).toLowerCase();

  const codedState = String(status.codedGameState || "").toUpperCase();

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

function gameHasNotStarted(game) {
  if (game?.status && isGameStarted(game.status)) {
    return false;
  }

  const firstPitch = new Date(game.date).getTime();

  if (!Number.isFinite(firstPitch)) {
    return true;
  }

  /*
  Keep checking for 30 minutes after scheduled first pitch.
  This protects against delayed games and late starter announcements.
  */
  return Date.now() < firstPitch + 30 * 60 * 1000;
}

function rebuildGamesArray() {
  games = (todayData?.games || []).map(game => ({
    id: game.gamePk,
    gamePk: game.gamePk,
    date: game.date,
    venue: game.venue,

    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    awayTeamId: game.awayTeamId,
    homeTeamId: game.homeTeamId,

    awayPitcher: normalizePitcherName(game.awayPitcher),
    homePitcher: normalizePitcherName(game.homePitcher),

    awayPitcherId: Number(game.awayPitcherId || 0),
    homePitcherId: Number(game.homePitcherId || 0),

    awayPitcherStats: game.awayPitcherStats || {},
    homePitcherStats: game.homePitcherStats || {},

    awayTeamStats: game.awayTeamStats || {},
    homeTeamStats: game.homeTeamStats || {},

    status: game.status || {}
  }));

  window.games = games;
  window.todayData = todayData;
}

/*
=========================================================
LOAD TODAY.JSON
=========================================================
*/

async function loadTodayData() {
  const res = await fetch(`data/today.json?cache=${Date.now()}`, {
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error("Could not load data/today.json");
  }

  todayData = await res.json();

  if (!Array.isArray(todayData.games)) {
    todayData.games = [];
  }

  rebuildGamesArray();
}

/*
=========================================================
LIVE MLB GAME FEED
=========================================================
*/

async function getLiveGameFeed(gamePk) {
  if (!gamePk) return null;

  const response = await fetch(
    `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live?cache=${Date.now()}`,
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(
      `Could not load live MLB feed for game ${gamePk}`
    );
  }

  return response.json();
}

function getStarterFromFeed(feed, side) {
  const probablePitcher =
    feed?.gameData?.probablePitchers?.[side] || null;

  if (probablePitcher?.id) {
    return {
      id: Number(probablePitcher.id),
      name: normalizePitcherName(
        probablePitcher.fullName ||
        probablePitcher.name ||
        probablePitcher.lastFirstName
      )
    };
  }

  /*
  Secondary source after lineups are posted.

  MLB's boxscore may identify the starter even when the
  probablePitchers object has not populated correctly.
  */
  const players =
    feed?.liveData?.boxscore?.teams?.[side]?.players || {};

  const starterEntry = Object.values(players).find(player => {
    const gameStatus = player?.gameStatus || {};
    const stats = player?.stats?.pitching || {};

    return (
      gameStatus.isCurrentPitcher === true ||
      gameStatus.isStarter === true ||
      Number(stats.gamesStarted || 0) > 0
    );
  });

  if (starterEntry?.person?.id) {
    return {
      id: Number(starterEntry.person.id),
      name: normalizePitcherName(starterEntry.person.fullName)
    };
  }

  return {
    id: 0,
    name: "TBD"
  };
}

/*
=========================================================
PITCHER STATS AND CACHE MANAGEMENT
=========================================================
*/

async function getUpdatedPitcherStats(pitcherId) {
  if (!pitcherId) return {};

  if (
    typeof API !== "undefined" &&
    typeof API.getPitcherStats === "function"
  ) {
    return safe(
      () => API.getPitcherStats(pitcherId, true),
      {}
    );
  }

  return {};
}

function clearObjectCacheEntry(object, id) {
  if (!object || typeof object !== "object" || !id) return;

  delete object[id];
  delete object[String(id)];
}

function clearPitcherCaches(oldPitcherId, newPitcherId) {
  if (typeof API === "undefined") return;

  const possibleCaches = [
    API.cache,
    API.playerCache,
    API.pitcherCache,
    API.pitcherStatsCache,
    API.bvpCache
  ];

  for (const cacheObject of possibleCaches) {
    clearObjectCacheEntry(cacheObject, oldPitcherId);
    clearObjectCacheEntry(cacheObject, newPitcherId);
  }

  if (typeof API.clearPitcherCache === "function") {
    safe(
      () => API.clearPitcherCache(oldPitcherId, newPitcherId),
      null
    );
  }

  if (typeof API.clearBvpCache === "function") {
    safe(
      () => API.clearBvpCache(),
      null
    );
  }
}

/*
=========================================================
BVP REFRESH AFTER A STARTER CHANGE
=========================================================
*/

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

async function refreshLineupBvp(lineup, pitcherId) {
  if (!Array.isArray(lineup)) return;

  for (const batter of lineup) {
    const batterId = getBatterId(batter);

    /*
    Remove BvP from the previous pitcher immediately so
    stale numbers are never displayed against a new starter.
    */
    batter.bvp = {
      atBats: 0,
      hits: 0,
      avg: ".000",
      homeRuns: 0
    };

    if (
      !batterId ||
      !pitcherId ||
      typeof API === "undefined"
    ) {
      continue;
    }

    let newBvp = null;

    if (typeof API.getBvP === "function") {
      newBvp = await safe(
        () => API.getBvP(batterId, pitcherId, true),
        null
      );
    } else if (typeof API.getBVP === "function") {
      newBvp = await safe(
        () => API.getBVP(batterId, pitcherId, true),
        null
      );
    } else if (typeof API.getBatterVsPitcher === "function") {
      newBvp = await safe(
        () => API.getBatterVsPitcher(
          batterId,
          pitcherId,
          true
        ),
        null
      );
    }

    if (newBvp && typeof newBvp === "object") {
      batter.bvp = {
        atBats: Number(
          newBvp.atBats ||
          newBvp.ab ||
          newBvp?.stats?.atBats ||
          0
        ),

        hits: Number(
          newBvp.hits ||
          newBvp?.stats?.hits ||
          0
        ),

        avg:
          newBvp.avg ||
          newBvp.average ||
          newBvp?.stats?.avg ||
          ".000",

        homeRuns: Number(
          newBvp.homeRuns ||
          newBvp.hr ||
          newBvp?.stats?.homeRuns ||
          0
        )
      };
    }
  }
}

/*
=========================================================
APPLY STARTER CHANGE
=========================================================
*/

async function applyStarterUpdate(game, side, starter) {
  const pitcherKey =
    side === "away" ? "awayPitcher" : "homePitcher";

  const pitcherIdKey =
    side === "away" ? "awayPitcherId" : "homePitcherId";

  const pitcherStatsKey =
    side === "away"
      ? "awayPitcherStats"
      : "homePitcherStats";

  /*
  The opponent's lineup faces this pitcher.
  */
  const opponentLineupKey =
    side === "away" ? "homeLineup" : "awayLineup";

  const previousPitcherName = normalizePitcherName(
    game[pitcherKey]
  );

  const previousPitcherId = Number(
    game[pitcherIdKey] || 0
  );

  const nextPitcherName = normalizePitcherName(
    starter?.name
  );

  const nextPitcherId = Number(starter?.id || 0);

  if (!hasNamedStarter(nextPitcherName, nextPitcherId)) {
    return false;
  }

  const nameChanged =
    previousPitcherName.toLowerCase() !==
    nextPitcherName.toLowerCase();

  const idChanged =
    previousPitcherId !== nextPitcherId;

  if (!nameChanged && !idChanged) {
    return false;
  }

  console.log(
    `⚾ POPS starter update: ${previousPitcherName} → ${nextPitcherName}`
  );

  clearPitcherCaches(
    previousPitcherId,
    nextPitcherId
  );

  game[pitcherKey] = nextPitcherName;
  game[pitcherIdKey] = nextPitcherId;

  game[pitcherStatsKey] =
    await getUpdatedPitcherStats(nextPitcherId);

  await refreshLineupBvp(
    game[opponentLineupKey],
    nextPitcherId
  );

  return true;
}

/*
=========================================================
CHECK EVERY GAME FOR STARTER CHANGES
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
        () => getLiveGameFeed(game.gamePk),
        null
      );

      if (!feed) continue;

      game.status = feed?.gameData?.status || game.status || {};

      const awayStarter = getStarterFromFeed(
        feed,
        "away"
      );

      const homeStarter = getStarterFromFeed(
        feed,
        "home"
      );

      const awayChanged = await applyStarterUpdate(
        game,
        "away",
        awayStarter
      );

      const homeChanged = await applyStarterUpdate(
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
START AND STOP FIVE-MINUTE CHECKS
=========================================================
*/

function hasPregameGamesRemaining() {
  return (todayData?.games || []).some(game =>
    gameHasNotStarted(game)
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
    "✅ POPS starter monitor active: checking every 5 minutes."
  );
}

function stopStarterRefreshWhenFinished() {
  if (hasPregameGamesRemaining()) return;

  if (starterRefreshTimer) {
    clearInterval(starterRefreshTimer);
    starterRefreshTimer = null;

    console.log(
      "🛑 POPS starter monitor stopped: today's games have started."
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

    homeRuns: Number(hitting.homeRuns || 0),
    hits: Number(hitting.hits || 0),
    atBats: Number(hitting.atBats || 0),

    iso:
      slg && avg
        ? Number((slg - avg).toFixed(3))
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
  const batterStats = mergeBatterStats(batter);

  const bvpStats = batter.bvp || {
    atBats: 0,
    hits: 0,
    avg: ".000",
    homeRuns: 0
  };

  const bvpHR = Number(
    bvpStats.homeRuns || 0
  );

  const hitStreak = Number(
    batter.hitStreak || 0
  );

  const batterHand =
    batter.batSide || "";

  const hasPlatoonAdvantage =
    batterHand === "S" ||
    (batterHand === "L" &&
      pitcherHand === "R") ||
    (batterHand === "R" &&
      pitcherHand === "L");

  const pitcherData = {
    id:
      pitcherStats?.id ||
      pitcherStats?.playerId ||
      pitcherStats?.pitcherId ||
      0,

    ...pitcherStats
  };

  const modelBatter = {
    ...batter,

    hitting: {
      ...batterStats,

      plateAppearances: Number(
        batterStats.plateAppearances || 0
      ),

      atBats: Number(
        batterStats.atBats || 0
      ),

      hits: Number(
        batterStats.hits || 0
      ),

      doubles: Number(
        batterStats.doubles || 0
      ),

      triples: Number(
        batterStats.triples || 0
      ),

      homeRuns: Number(
        batterStats.homeRuns || 0
      ),

      extraBaseHits: Number(
        batterStats.extraBaseHits ||
        (
          Number(batterStats.doubles || 0) +
          Number(batterStats.triples || 0) +
          Number(batterStats.homeRuns || 0)
        )
      ),

      avg: Number(
        batterStats.avg || 0
      ),

      slg: Number(
        batterStats.slg || 0
      ),

      ops: Number(
        batterStats.ops || 0
      ),

      iso: Number(
        batterStats.iso || 0
      ),

      hrRate: Number(
        batterStats.hrRate || 0
      ),

      extraBaseHitRate: Number(
        batterStats.extraBaseHitRate || 0
      )
    },

    statcast: batter.statcast || {
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

  if (
  typeof Formula === "undefined" ||
  typeof Formula.getHRScore !== "function"
) {
  console.error(
    "POPS Formula is unavailable. Make sure formula.js loads before app.js."
  );

  return;
}

const result = Formula.getHRScore({
  batter: modelBatter,
  pitcher: pitcherData,
  pitcherHand,
  handednessSplit:
    batter.handednessSplit || {},
  recentForm:
    batter.recentForm || {}
});

const breakdown = Array.isArray(result.breakdown)
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

    score: Number(result.score || 0),

    tier:
      result.tier,

    confidence:
      result.confidence,

    breakdown,

    modelBreakdown:
      result.breakdown,

    reasons:
      result.tier
  });
}

async function loadHRPicks() {
  hrPicksBox.innerHTML =
    "<p>Loading HR Pickz...</p>";

  hrPicks = [];

  for (const game of todayData.games) {
    const awayPitcherInfo =
      game.awayPitcherId &&
      typeof API !== "undefined" &&
      typeof API.getPlayerInfo === "function"
        ? await safe(
            () =>
              API.getPlayerInfo(
                game.awayPitcherId
              ),
            {}
          )
        : {};

    const homePitcherInfo =
      game.homePitcherId &&
      typeof API !== "undefined" &&
      typeof API.getPlayerInfo === "function"
        ? await safe(
            () =>
              API.getPlayerInfo(
                game.homePitcherId
              ),
            {}
          )
        : {};

    const awayLineup = (
      game.awayLineup || []
    ).map(batter => ({
      ...batter,
      team: game.awayTeam
    }));

    const homeLineup = (
      game.homeLineup || []
    ).map(batter => ({
      ...batter,
      team: game.homeTeam
    }));

    for (const batter of awayLineup) {
      addHRPick(
        game,
        batter,
        game.homePitcher,
        game.homePitcherStats || {},
        homePitcherInfo.pitchHand || ""
      );
    }

    for (const batter of homeLineup) {
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

  hrPicks.forEach(pick => {
    const key = `${pick.player}-${pick.team}`;

    if (
      !uniquePlayers[key] ||
      pick.score > uniquePlayers[key].score
    ) {
      uniquePlayers[key] = pick;
    }
  });

  hrPicks = Object.values(uniquePlayers).sort(
    (a, b) => b.score - a.score
  );

  window.hrPicks = hrPicks;

  if (!hrPicks.length) {
    hrPicksBox.innerHTML =
      "<p>No HR Pickz found.</p>";

    return;
  }

  hrPicksBox.innerHTML = hrPicks
    .slice(0, 20)
    .map(
      (pick, index) => `
        <div class="hr-card">
          <div class="hr-rank">#${index + 1}</div>

          <h3>💣 ${pick.player}</h3>

          <p><strong>Team:</strong> ${pick.team}</p>
          <p><strong>Game:</strong> ${pick.game}</p>
          <p><strong>Date/Time:</strong> ${pick.gameTime}</p>

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
            <strong>Batter Hand:</strong>
            ${pick.batterHand || "N/A"}
          </p>

          <p>
            <strong>Pitcher Hand:</strong>
            ${pick.pitcherHand || "N/A"}
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
            AVG ${pick.bvpStats?.avg || ".000"}
          </p>

          <p>
            <strong>Hit Streak:</strong>
            ${pick.hitStreak}+ games
          </p>

          <p>
            <strong>POPS HR Score:</strong>
            <span class="score">
              ${pick.score}/100
            </span>
          </p>

          <div class="hr-breakdown">
  ${(pick.breakdown || []).map(item => `
    <div class="hr-breakdown-row">
      <span class="hr-breakdown-label">
        ${item.icon} ${item.label}
      </span>

      <span class="hr-breakdown-score">
        ${item.score}/${item.max}
      </span>
    </div>
  `).join("")}
</div>

<div class="hr-model-summary">
  <p>
    ⭐ <strong>Confidence:</strong>
    ${pick.confidence?.label || "Low"}
    (${pick.confidence?.score || 0}%)
  </p>

  <p>
    ${pick.tier || ""}
  </p>
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
  const stats = mergeBatterStats(batter);

  const bvpStats = batter.bvp || {
    atBats: 0,
    hits: 0,
    avg: ".000",
    homeRuns: 0
  };

  const bvpHR = Number(
    bvpStats.homeRuns || 0
  );

  const hitStreak = Number(
    batter.hitStreak || 0
  );

  if (
    hitStreak >= 2 ||
    bvpHR > 0 ||
    Number(bvpStats.hits || 0) > 0
  ) {
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

      pitcher: normalizePitcherName(
        pitcherName
      ),

      lineupSpot: batter.lineupSpot,
      confirmed: batter.confirmed,

      hitStreak,
      bvpHR,
      bvpStats,
      score
    });
  }
}

async function loadHitPicks() {
  hitPicksBox.innerHTML =
    "<p>Loading Hit Pickz...</p>";

  hitPicks = [];

  for (const game of todayData.games) {
    const awayLineup = (
      game.awayLineup || []
    ).map(batter => ({
      ...batter,
      team: game.awayTeam
    }));

    const homeLineup = (
      game.homeLineup || []
    ).map(batter => ({
      ...batter,
      team: game.homeTeam
    }));

    awayLineup.forEach(batter =>
      addHitPick(
        game,
        batter,
        game.homePitcher
      )
    );

    homeLineup.forEach(batter =>
      addHitPick(
        game,
        batter,
        game.awayPitcher
      )
    );
  }

  const uniqueHitPlayers = {};

  hitPicks.forEach(pick => {
    const key = `${pick.player}-${pick.team}`;

    if (
      !uniqueHitPlayers[key] ||
      pick.score > uniqueHitPlayers[key].score
    ) {
      uniqueHitPlayers[key] = pick;
    }
  });

  hitPicks = Object.values(uniqueHitPlayers);

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
          No lineup batters currently have a
          2+ game hit streak or previous success
          against the current pitcher.
        </p>
      </div>
    `;

    return;
  }

  hitPicksBox.innerHTML = hitPicks
    .map(
      (pick, index) => `
        <div class="pick-card">
          <span class="rank-badge">
            #${index + 1}
          </span>

          <h3>
            ${pick.player} - ${pick.team}
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
RECALCULATE EVERY POPS SECTION
=========================================================
*/

async function recalculateAllPicks() {
  if (recalculationRunning) return;

  recalculationRunning = true;

  try {
    console.log(
      "🔄 POPS recalculating after starter update..."
    );

    rebuildGamesArray();

    if (typeof Pitchers !== "undefined") {
      Pitchers.box =
        document.getElementById("pitchersBox");

      if (
        typeof Pitchers.loadPitcherTargets ===
        "function"
      ) {
        await Pitchers.loadPitcherTargets();
      }
    }

    await loadHRPicks();
    await loadHitPicks();

    if (
      typeof Moneyline !== "undefined" &&
      typeof Moneyline.load === "function"
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
INITIALIZE APP
=========================================================
*/

async function init() {
  hrPicksBox.innerHTML =
    "<p>Starting POPS Pickz 10.0...</p>";

  await loadTodayData();

  /*
  Check the live MLB feed immediately instead of waiting
  five minutes for the first refresh.
  */
  await checkForStarterUpdates();

  /*
  If no starter changed, perform the regular initial load.
  checkForStarterUpdates() performs this automatically
  when a change is detected.
  */
  if (!recalculationRunning) {
    if (typeof Pitchers !== "undefined") {
      Pitchers.box =
        document.getElementById("pitchersBox");

      if (
        typeof Pitchers.loadPitcherTargets ===
        "function"
      ) {
        await Pitchers.loadPitcherTargets();
      }
    }

    await loadHRPicks();
    await loadHitPicks();

    if (
      typeof Moneyline !== "undefined" &&
      typeof Moneyline.load === "function"
    ) {
      await Moneyline.load(games);
    }
  }

  if (hasPregameGamesRemaining()) {
    startStarterRefresh();
  }
}

init().catch(err => {
  console.error("POPS app error:", err);

  hrPicksBox.innerHTML = `
    <div class="pick-card">
      <h3>⚠️ Site loading error</h3>
      <p>${err.message}</p>
    </div>
  `;
});
