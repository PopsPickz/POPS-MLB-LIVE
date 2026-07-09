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
    cache.batterStats[playerId] = await safe(
      () => API.getBatterStats(playerId),
      {}
    );
  }

  const statcast =
    typeof StatcastData !== "undefined"
      ? StatcastData[playerName] || {}
      : {};

  return {
    ...cache.batterStats[playerId],
    ...statcast
  };
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

async function getBvPHR(batterId, pitcherId) {
  if (!batterId || !pitcherId) return 0;

  const key = `${batterId}-${pitcherId}`;

  if (cache.bvp[key] === undefined) {
    cache.bvp[key] = await safe(
      () => API.getBvPHR ? API.getBvPHR(batterId, pitcherId) : 0,
      0
    );
  }

  return Number(cache.bvp[key] || 0);
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
  .sort((a, b) =>
    Number(Formula.isKnownPowerBat(b.name)) -
    Number(Formula.isKnownPowerBat(a.name))
  )
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

  for (const target of targets.slice(0, 10)) {
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

      const bvpHR = await getBvPHR(batter.id, target.pitcherId);

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
        hitStreak,
        score: result.score,
        reasons: result.reasons
      });
    }
  }

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
      <p><strong>Lineup:</strong> ${pick.confirmed ? "✅ Confirmed" : "🟡 Projected"}</p>
      <p><strong>Batter Hand:</strong> ${pick.batterHand || "N/A"}</p>
      <p><strong>Pitcher Hand:</strong> ${pick.pitcherHand || "N/A"}</p>
      <p><strong>Platoon Edge:</strong> ${pick.hasPlatoonAdvantage ? "✅ Yes" : "❌ No"}</p>
      <p><strong>Previous HR vs Pitcher:</strong> ${pick.bvpHR}</p>
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

      const bvpHR = await getBvPHR(batter.id, target.pitcherId);
      const stats = await getBatterStats(batter.id, batter.name);

      if (hitStreak >= 2 || bvpHR > 0) {
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
          score
        });
      }
    }
  }

  hitPicks.sort((a, b) =>
    b.hitStreak - a.hitStreak ||
    b.bvpHR - a.bvpHR ||
    b.score - a.score
  );

  if (!hitPicks.length) {
    hitPicksBox.innerHTML = `
      <div class="pick-card">
        <h3>No Hit Pickz Found</h3>
        <p>No lineup batters currently have a 2+ game hit streak or previous HR vs pitcher.</p>
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
      <p>⚾ vs ${pick.pitcher}</p>
      <p>📍 Batting spot: ${pick.lineupSpot}</p>
      <p>${pick.confirmed ? "✅ Confirmed lineup" : "🟡 Projected lineup"}</p>
    </div>
  `).join("");
}

async function loadMoneyline() {
  moneylineBox.innerHTML = "<p>Loading Moneyline Pickz...</p>";

  const cards = [];

  const num = value => {
    const n = Number(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const winner = (awayVal, homeVal, higherIsBetter = true) => {
    if (awayVal === homeVal) {
      return { away: false, home: false, tie: true };
    }

    if (higherIsBetter) {
      return {
        away: awayVal > homeVal,
        home: homeVal > awayVal,
        tie: false
      };
    }

    return {
      away: awayVal < homeVal,
      home: homeVal < awayVal,
      tie: false
    };
  };

  for (const game of games) {
    const awayStats = await safe(() => API.getTeamStats(game.awayTeamId), {
      hitting: {},
      pitching: {},
      fielding: {}
    });

    const homeStats = await safe(() => API.getTeamStats(game.homeTeamId), {
      hitting: {},
      pitching: {},
      fielding: {}
    });

    const awayPitcherStats = await safe(() => API.getPlayerStats(game.awayPitcherId), {});
    const homePitcherStats = await safe(() => API.getPlayerStats(game.homePitcherId), {});

    const awaySP = game.awayPitcherId
      ? num(Formula.pitcherRisk(awayPitcherStats).score)
      : 99;

    const homeSP = game.homePitcherId
      ? num(Formula.pitcherRisk(homePitcherStats).score)
      : 99;

    const awayOffense =
      num(awayStats.hitting?.runs) +
      num(awayStats.hitting?.ops) * 1000;

    const homeOffense =
      num(homeStats.hitting?.runs) +
      num(homeStats.hitting?.ops) * 1000;

    const awayBullpen =
      num(awayStats.pitching?.era) +
      num(awayStats.pitching?.whip);

    const homeBullpen =
      num(homeStats.pitching?.era) +
      num(homeStats.pitching?.whip);

    const awayDefense =
      num(awayStats.fielding?.fielding) * 1000 -
      num(awayStats.fielding?.errors);

    const homeDefense =
      num(homeStats.fielding?.fielding) * 1000 -
      num(homeStats.fielding?.errors);

    const sp = winner(awaySP, homeSP, false);
    const bullpen = winner(awayBullpen, homeBullpen, false);
    const offense = winner(awayOffense, homeOffense, true);
    const defense = winner(awayDefense, homeDefense, true);

    const awayChecks =
      Number(sp.away) +
      Number(bullpen.away) +
      Number(offense.away) +
      Number(defense.away);

    const homeChecks =
      Number(sp.home) +
      Number(bullpen.home) +
      Number(offense.home) +
      Number(defense.home);

    const pick =
      awayChecks > homeChecks
        ? game.awayTeam
        : homeChecks > awayChecks
        ? game.homeTeam
        : "No Clear Edge";

    cards.push({
      game,
      pick,
      awayChecks,
      homeChecks,
      sp,
      bullpen,
      offense,
      defense,
      values: {
        awaySP,
        homeSP,
        awayOffense,
        homeOffense,
        awayBullpen,
        homeBullpen,
        awayDefense,
        homeDefense
      }
    });
  }

  moneylineBox.innerHTML = cards.map(item => `
    <div class="pick-card">
      <h3>${item.game.awayTeam} vs ${item.game.homeTeam}</h3>
      <p>⏰ ${formatTime(item.game.date)}</p>
      <p>💰 POPS Pick: <span class="score">${item.pick}</span></p>
      <p class="small">Checklist: ${item.awayChecks} - ${item.homeChecks}</p>
      <hr>

      <p><strong>${item.game.awayTeam}</strong></p>
      <p>Starting Pitcher ${item.sp.away ? "✅" : item.sp.tie ? "➖" : "❌"} <span class="small">Risk: ${item.values.awaySP}</span></p>
      <p>Better Bullpen ${item.bullpen.away ? "✅" : item.bullpen.tie ? "➖" : "❌"} <span class="small">Score: ${item.values.awayBullpen.toFixed(2)}</span></p>
      <p>Offense ${item.offense.away ? "✅" : item.offense.tie ? "➖" : "❌"} <span class="small">Score: ${item.values.awayOffense.toFixed(1)}</span></p>
      <p>Defense ${item.defense.away ? "✅" : item.defense.tie ? "➖" : "❌"} <span class="small">Score: ${item.values.awayDefense.toFixed(1)}</span></p>

      <hr>

      <p><strong>${item.game.homeTeam}</strong></p>
      <p>Starting Pitcher ${item.sp.home ? "✅" : item.sp.tie ? "➖" : "❌"} <span class="small">Risk: ${item.values.homeSP}</span></p>
      <p>Better Bullpen ${item.bullpen.home ? "✅" : item.bullpen.tie ? "➖" : "❌"} <span class="small">Score: ${item.values.homeBullpen.toFixed(2)}</span></p>
      <p>Offense ${item.offense.home ? "✅" : item.offense.tie ? "➖" : "❌"} <span class="small">Score: ${item.values.homeOffense.toFixed(1)}</span></p>
      <p>Defense ${item.defense.home ? "✅" : item.defense.tie ? "➖" : "❌"} <span class="small">Score: ${item.values.homeDefense.toFixed(1)}</span></p>
    </div>
  `).join("");
}

async function init() {
  hrPicksBox.innerHTML = "<p>Starting POPS Pickz 8.1...</p>";

  await loadGames();
  await buildTargets();
  await loadHRPicks();

  setTimeout(async () => {
    await loadHitPicks();
    await loadMoneyline();
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
