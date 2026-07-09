const gamesBox = document.getElementById("gamesBox");
const hrPicksBox = document.getElementById("hrPicksBox");
const hitPicksBox = document.getElementById("hitPicksBox");
const moneylineBox = document.getElementById("moneylineBox");

let games = [];
let targets = [];
let hrPicks = [];
let hitPicks = [];

const cache = {
  playerInfo: {},
  batterStats: {},
  bvp: {},
  lineup: {}
};

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

async function getBatterStats(playerId, playerName) {
  if (!playerId) return {};

  if (!cache.batterStats[playerId]) {
    const seasonStats = await safe(() => API.getBatterStats(playerId), {});

    const manualStatcast =
      typeof StatcastData !== "undefined"
        ? StatcastData[playerName] || {}
        : {};

    const liveStatcast =
      typeof StatcastAPI !== "undefined"
        ? await safe(() => StatcastAPI.getPlayerPowerStats(playerId), {})
        : {};

    cache.batterStats[playerId] = {
      ...seasonStats,
      ...manualStatcast,
      ...liveStatcast
    };
  }

  return cache.batterStats[playerId];
}

async function getPlayerInfo(playerId) {
  if (!playerId) return {};

  if (!cache.playerInfo[playerId]) {
    cache.playerInfo[playerId] = await safe(
      () => API.getPlayerInfo ? API.getPlayerInfo(playerId) : {},
      {}
    );
  }

  return cache.playerInfo[playerId];
}

async function getBvPStats(batterId, pitcherId) {
  if (!batterId || !pitcherId) {
    return { atBats: 0, hits: 0, avg: ".000", homeRuns: 0 };
  }

  const key = `bvpstats-${batterId}-${pitcherId}`;

  if (cache.bvp[key] === undefined) {
    cache.bvp[key] = await safe(
      () => API.getBvPStats ? API.getBvPStats(batterId, pitcherId) : {
        atBats: 0,
        hits: 0,
        avg: ".000",
        homeRuns: 0
      },
      {
        atBats: 0,
        hits: 0,
        avg: ".000",
        homeRuns: 0
      }
    );
  }

  return cache.bvp[key];
}

async function loadGames() {
  gamesBox.innerHTML = "";
  games = await safe(() => API.getSchedule(), []);
}

async function buildTargets() {
  targets = [];

  for (const game of games) {
    if (game.awayPitcherId) {
      const stats = await safe(() => API.getPlayerStats(game.awayPitcherId), {});
      targets.push({
        game,
        pitcher: game.awayPitcher,
        pitcherId: game.awayPitcherId,
        targetTeam: game.homeTeam,
        targetTeamId: game.homeTeamId,
        risk: Formula.pitcherRisk(stats)
      });
    }

    if (game.homePitcherId) {
      const stats = await safe(() => API.getPlayerStats(game.homePitcherId), {});
      targets.push({
        game,
        pitcher: game.homePitcher,
        pitcherId: game.homePitcherId,
        targetTeam: game.awayTeam,
        targetTeamId: game.awayTeamId,
        risk: Formula.pitcherRisk(stats)
      });
    }
  }
}

async function getLineup(target) {
  const key = `${target.game.id}-${target.targetTeamId}`;

  if (cache.lineup[key]) return cache.lineup[key];

  let lineup = await safe(
    () => API.getLineup(target.game.id, target.targetTeamId),
    []
  );

  if (lineup.length) {
    lineup = lineup.map(p => ({
      ...p,
      team: target.targetTeam,
      confirmed: true
    }));
  } else {
    const roster = await safe(() => API.getRoster(target.targetTeamId), []);

    lineup = roster
  .filter(p => !["P", "SP", "RP"].includes(p.position))
  .sort((a, b) => a.name.localeCompare(b.name))
  .slice(0, 9)
  .map((p, index) => ({
    ...p,
    team: target.targetTeam,
    lineupSpot: index + 1,
    confirmed: false
  }));
    
  }

  cache.lineup[key] = lineup;
  return lineup;
}

async function loadHRPicks() {
  hrPicksBox.innerHTML = "<p>Loading HR Pickz...</p>";
  hrPicks = [];

  for (const target of targets) {
    const lineup = await getLineup(target);
    const pitcherInfo = await getPlayerInfo(target.pitcherId);
    const pitcherHand = pitcherInfo.pitchHand || "";

    for (const batter of lineup) {
      const batterStats = await getBatterStats(batter.id, batter.name);
      const batterInfo = await getPlayerInfo(batter.id);
      const batterHand = batterInfo.batSide || "";

      const hasPlatoonAdvantage =
        batterHand === "S" ||
        (batterHand === "L" && pitcherHand === "R") ||
        (batterHand === "R" && pitcherHand === "L");

      const bvpStats = await getBvPStats(batter.id, target.pitcherId);
      const bvpHR = Number(bvpStats.homeRuns || 0);

      const hitStreak = await safe(
        () => API.getHitStreak ? API.getHitStreak(batter.id) : 0,
        0
      );

      const result = Formula.getHrScore(
        batter.name,
        batter.lineupSpot,
        target.risk,
        {
          batterStats,
          bvpHR,
          hitStreak,
          hasPlatoonAdvantage
        }
      );

      hrPicks.push({
        player: batter.name,
        team: batter.team,
        position: batter.position,
        pitcher: target.pitcher,
        game: `${target.game.awayTeam} vs ${target.game.homeTeam}`,
        gameTime: formatTime(target.game.date),
        lineupSpot: batter.lineupSpot,
        confirmed: batter.confirmed,
        batterHand,
        pitcherHand,
        hasPlatoonAdvantage,
        bvpHR,
        bvpStats,
        hitStreak,
        score: result.score,
        reasons: result.reasons
      });
    }
  }

  const uniquePlayers = {};

  hrPicks.forEach(pick => {
    const key = `${pick.player}-${pick.team}`;

    if (!uniquePlayers[key] || pick.score > uniquePlayers[key].score) {
      uniquePlayers[key] = pick;
    }
  });

  hrPicks = Object.values(uniquePlayers);
  hrPicks.sort((a, b) => b.score - a.score);

  if (!hrPicks.length) {
    hrPicksBox.innerHTML = "<p>No HR Pickz found.</p>";
    return;
  }

  hrPicksBox.innerHTML = hrPicks.slice(0, 20).map((pick, index) => `
    <div class="hr-card">
      <div class="hr-rank">#${index + 1}</div>
      <h3>💣 ${pick.player}</h3>
      <p><strong>Team:</strong> ${pick.team}</p>
      <p><strong>Game:</strong> ${pick.game}</p>
      <p><strong>Date/Time:</strong> ${pick.gameTime}</p>
      <p><strong>Vs Pitcher:</strong> ${pick.pitcher}</p>
      <p><strong>Batting Spot:</strong> ${pick.lineupSpot}</p>
      <p><strong>Lineup:</strong> ${pick.confirmed ? "✅ Confirmed lineup" : "🟡 Projected lineup"}</p>
      <p><strong>Batter Hand:</strong> ${pick.batterHand || "N/A"}</p>
      <p><strong>Pitcher Hand:</strong> ${pick.pitcherHand || "N/A"}</p>
      <p><strong>Platoon Edge:</strong> ${pick.hasPlatoonAdvantage ? "✅ Yes" : "❌ No"}</p>
      <p><strong>Previous HR vs Pitcher:</strong> ${pick.bvpHR}</p>
      <p><strong>BvP History:</strong> ${pick.bvpStats?.hits || 0}/${pick.bvpStats?.atBats || 0}, AVG ${pick.bvpStats?.avg || ".000"}</p>
      <p><strong>Hit Streak:</strong> ${pick.hitStreak}+ games</p>
      <p><strong>POPS HR Score:</strong> <span class="score">${pick.score}/100</span></p>
      <p class="small">${pick.reasons}</p>
    </div>
  `).join("");
}

async function loadHitPicks() {
  hitPicksBox.innerHTML = "<p>Loading Hit Pickz...</p>";
  hitPicks = [];

  for (const target of targets.slice(0, 10)) {
    const lineup = await getLineup(target);

    for (const batter of lineup) {
      const hitStreak = await safe(
        () => API.getHitStreak ? API.getHitStreak(batter.id) : 0,
        0
      );

      const bvpStats = await getBvPStats(batter.id, target.pitcherId);
      const bvpHR = Number(bvpStats.homeRuns || 0);
      const stats = await getBatterStats(batter.id, batter.name);

      if (hitStreak >= 2 || bvpHR > 0 || Number(bvpStats.hits || 0) > 0) {
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
          pitcher: target.pitcher,
          lineupSpot: batter.lineupSpot,
          confirmed: batter.confirmed,
          hitStreak,
          bvpHR,
          bvpStats,
          score
        });
      }
    }
  }

  const uniqueHitPlayers = {};

  hitPicks.forEach(pick => {
    const key = `${pick.player}-${pick.team}`;

    if (!uniqueHitPlayers[key] || pick.score > uniqueHitPlayers[key].score) {
      uniqueHitPlayers[key] = pick;
    }
  });

  hitPicks = Object.values(uniqueHitPlayers);

  hitPicks.sort((a, b) =>
    b.hitStreak - a.hitStreak ||
    b.bvpHR - a.bvpHR ||
    Number(b.bvpStats?.hits || 0) - Number(a.bvpStats?.hits || 0) ||
    b.score - a.score
  );

  if (!hitPicks.length) {
    hitPicksBox.innerHTML = `
      <div class="pick-card">
        <h3>No Hit Pickz Found</h3>
        <p>No lineup batters currently have a 2+ game hit streak or previous success vs pitcher.</p>
      </div>
    `;
    return;
  }

  hitPicksBox.innerHTML = hitPicks.map((pick, index) => `
    <div class="pick-card">
      <span class="rank-badge">#${index + 1}</span>
      <h3>${pick.player} - ${pick.team}</h3>
      <p>🔥 Hit Streak: <span class="score">${pick.hitStreak} games</span></p>
      <p>💣 Previous HR vs Pitcher: <span class="score">${pick.bvpHR}</span></p>
      <p>📊 Hit Score: <span class="score">${pick.score}/100</span></p>
      <p>
        ⚾ vs ${pick.pitcher}<br>
        <span class="small">
          Previous vs Pitcher: ${pick.bvpStats?.hits || 0}/${pick.bvpStats?.atBats || 0},
          AVG ${pick.bvpStats?.avg || ".000"},
          HR ${pick.bvpStats?.homeRuns || 0}
        </span>
      </p>
      <p>📍 Batting spot: ${pick.lineupSpot}</p>
      <p>${pick.confirmed ? "✅ Confirmed lineup" : "🟡 Projected lineup"}</p>
    </div>
  `).join("");
}

async function init() {
  hrPicksBox.innerHTML = "<p>Starting POPS Pickz 9.0...</p>";

  await loadGames();
  await buildTargets();
  await loadHRPicks();

  setTimeout(async () => {
    await loadHitPicks();

    if (typeof Moneyline !== "undefined") {
      await Moneyline.load(games);
    }
  }, 500);
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
