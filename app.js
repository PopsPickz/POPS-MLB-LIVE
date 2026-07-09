const gamesBox = document.getElementById("gamesBox");
const hrPicksBox = document.getElementById("hrPicksBox");
const hitPicksBox = document.getElementById("hitPicksBox");
const moneylineBox = document.getElementById("moneylineBox");

let games = [];
let pitcherTargets = [];
let hrPicks = [];
let hitPicks = [];

function formatTime(dateString) {
  return new Date(dateString).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

async function loadGames() {
  games = await API.getSchedule();
  gamesBox.innerHTML = "";
}

async function buildPitcherTargets() {
  pitcherTargets = [];

  for (const game of games) {
    if (game.awayPitcherId) {
      const stats = await API.getPlayerStats(game.awayPitcherId);
      pitcherTargets.push({
        gameId: game.id,
        pitcher: game.awayPitcher,
        pitcherId: game.awayPitcherId,
        targetTeam: game.homeTeam,
        targetTeamId: game.homeTeamId,
        risk: Formula.pitcherRisk(stats),
        stats
      });
    }

    if (game.homePitcherId) {
      const stats = await API.getPlayerStats(game.homePitcherId);
      pitcherTargets.push({
        gameId: game.id,
        pitcher: game.homePitcher,
        pitcherId: game.homePitcherId,
        targetTeam: game.awayTeam,
        targetTeamId: game.awayTeamId,
        risk: Formula.pitcherRisk(stats),
        stats
      });
    }
  }
}

async function getTeamLineup(gameId, teamId, teamName) {
  const lineup = await API.getLineup(gameId, teamId);

  return lineup.map(player => ({
    id: player.id,
    name: player.name,
    position: player.position,
    lineupSpot: player.lineupSpot,
    team: teamName,
    confirmed: true
  }));
}

async function getProjectedLineup(teamId, teamName) {
  const roster = await API.getRoster(teamId);
  const hitters = [];

  for (const player of roster) {
    if (["P", "SP", "RP"].includes(player.position)) continue;

    const stats = await API.getBatterStats(player.id);

    hitters.push({
      id: player.id,
      name: player.name,
      position: player.position,
      team: teamName,
      confirmed: false,
      stats,
      powerScore:
        Number(stats.homeRuns || 0) * 3 +
        Number(stats.ops || 0) * 100 +
        Number(stats.slg || 0) * 100
    });
  }

  return hitters
    .sort((a, b) => b.powerScore - a.powerScore)
    .slice(0, 9)
    .map((player, index) => ({
      ...player,
      lineupSpot: index + 1
    }));
}

async function getLineupForTarget(target) {
  let lineup = await getTeamLineup(
    target.gameId,
    target.targetTeamId,
    target.targetTeam
  );

  if (!lineup.length) {
    lineup = await getProjectedLineup(
      target.targetTeamId,
      target.targetTeam
    );
  }

  return lineup;
}

async function loadHRPicks() {
  hrPicksBox.innerHTML = "<p>Loading HR Pickz...</p>";
  hrPicks = [];

  for (const target of pitcherTargets) {
    const lineup = await getLineupForTarget(target);
    const game = games.find(g => String(g.id) === String(target.gameId));

    for (const batter of lineup) {
      const batterStats = batter.stats || await API.getBatterStats(batter.id);
      
     const batterInfo = await API.getPlayerInfo(batter.id);
     const pitcherInfo = await API.getPlayerInfo(target.pitcherId);

    const batterHand = batterInfo.batSide || "";
    const pitcherHand = pitcherInfo.pitchHand || "";

    const hasPlatoonAdvantage =
  (batterHand === "L" && pitcherHand === "R") ||
  (batterHand === "R" && pitcherHand === "L") ||
  batterHand === "S";

const bvpHR = API.getBvPHR
  ? await API.getBvPHR(batter.id, target.pitcherId)
  : 0;

const result = Formula.getHrScore(
  batter.name,
  batter.lineupSpot,
  target.risk,
  {
    batterStats,
    bvpHR,
    hasPlatoonAdvantage
  }
);

      hrPicks.push({
        player: batter.name,
        team: batter.team,
        position: batter.position,
        pitcher: target.pitcher,
        game: game ? `${game.awayTeam} vs ${game.homeTeam}` : "Today's matchup",
        gameTime: game ? formatTime(game.date) : "TBD",
        lineupSpot: batter.lineupSpot,
        confirmed: batter.confirmed,
        bvpHR,
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
      <p><strong>Position:</strong> ${pick.position || "N/A"}</p>
      <p><strong>Lineup:</strong> ${pick.confirmed ? "✅ Confirmed" : "🟡 Projected"}</p>
      <p><strong>Previous HR vs Pitcher:</strong> ${pick.bvpHR || 0}</p>

      <p><strong>POPS HR Score:</strong> <span class="score">${pick.score}/100</span></p>

      <p class="small">${pick.reasons}</p>
    </div>
  `).join("");
}

async function loadHitPicks() {
  hitPicksBox.innerHTML = "<p>Loading Hit Pickz...</p>";
  hitPicks = [];

  for (const target of pitcherTargets) {
    const lineup = await getLineupForTarget(target);

    for (const batter of lineup) {
      const hitStreak = await API.getHitStreak(batter.id);
      const batterStats = batter.stats || await API.getBatterStats(batter.id);

      const bvpHR = API.getBvPHR
        ? await API.getBvPHR(batter.id, target.pitcherId)
        : 0;

      if (hitStreak >= 2 || bvpHR > 0) {
        const score = Formula.getHitScore(
          batter.name,
          batter.lineupSpot,
          hitStreak,
          bvpHR,
          batterStats
        );

        hitPicks.push({
          player: batter.name,
          team: batter.team,
          position: batter.position,
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
      <p>💣 Previous HR vs Pitcher: <span class="score">${pick.bvpHR || 0}</span></p>
      <p>📊 Hit Score: <span class="score">${pick.score}/100</span></p>
      <p>⚾ vs ${pick.pitcher}</p>
      <p>📍 Batting spot: ${pick.lineupSpot}</p>
      <p>${pick.confirmed ? "✅ Confirmed lineup" : "🟡 Projected lineup"}</p>
    </div>
  `).join("");
}

async function loadMoneyline() {
  moneylineBox.innerHTML = "<p>Loading Moneyline Pickz...</p>";

  const picks = [];

  for (const game of games) {
    const awayStats = await API.getTeamStats(game.awayTeamId);
    const homeStats = await API.getTeamStats(game.homeTeamId);

    const awayStarterStats = await API.getPlayerStats(game.awayPitcherId);
    const homeStarterStats = await API.getPlayerStats(game.homePitcherId);

    const awaySPRisk = Formula.pitcherRisk(awayStarterStats).score;
    const homeSPRisk = Formula.pitcherRisk(homeStarterStats).score;

    const awayBullpenScore =
      Number(awayStats.pitching?.era || 99) +
      Number(awayStats.pitching?.whip || 99);

    const homeBullpenScore =
      Number(homeStats.pitching?.era || 99) +
      Number(homeStats.pitching?.whip || 99);

    const awayOffenseScore =
      Number(awayStats.hitting?.runs || 0) +
      Number(awayStats.hitting?.ops || 0) * 100;

    const homeOffenseScore =
      Number(homeStats.hitting?.runs || 0) +
      Number(homeStats.hitting?.ops || 0) * 100;

    const awayDefenseScore =
      Number(awayStats.pitching?.runsAllowed || 999) +
      Number(awayStats.pitching?.era || 99);

    const homeDefenseScore =
      Number(homeStats.pitching?.runsAllowed || 999) +
      Number(homeStats.pitching?.era || 99);

    let awayChecks = 0;
    let homeChecks = 0;

    const awayBetterSP = awaySPRisk < homeSPRisk;
    const homeBetterSP = homeSPRisk < awaySPRisk;

    const awayBetterBullpen = awayBullpenScore < homeBullpenScore;
    const homeBetterBullpen = homeBullpenScore < awayBullpenScore;

    const awayBetterOffense = awayOffenseScore > homeOffenseScore;
    const homeBetterOffense = homeOffenseScore > awayOffenseScore;

    const awayBetterDefense = awayDefenseScore < homeDefenseScore;
    const homeBetterDefense = homeDefenseScore < awayDefenseScore;

    if (awayBetterSP) awayChecks++;
    if (homeBetterSP) homeChecks++;

    if (awayBetterBullpen) awayChecks++;
    if (homeBetterBullpen) homeChecks++;

    if (awayBetterOffense) awayChecks++;
    if (homeBetterOffense) homeChecks++;

    if (awayBetterDefense) awayChecks++;
    if (homeBetterDefense) homeChecks++;

    if (awayChecks === homeChecks) {
      homeChecks += 0.5;
    }

    picks.push({
      game,
      pick: homeChecks >= awayChecks ? game.homeTeam : game.awayTeam,
      awayChecks,
      homeChecks,
      awayBetterSP,
      homeBetterSP,
      awayBetterBullpen,
      homeBetterBullpen,
      awayBetterOffense,
      homeBetterOffense,
      awayBetterDefense,
      homeBetterDefense
    });
  }

  moneylineBox.innerHTML = picks.map(item => `
    <div class="pick-card">
      <h3>${item.game.awayTeam} vs ${item.game.homeTeam}</h3>
      <p>⏰ ${formatTime(item.game.date)}</p>
      <p>💰 POPS Pick: <span class="score">${item.pick}</span></p>
      <p class="small">Checklist winner: ${item.awayChecks} - ${item.homeChecks}</p>

      <hr>

      <p><strong>${item.game.awayTeam}</strong></p>
      <p>Starting Pitcher ${item.awayBetterSP ? "✅" : "❌"}</p>
      <p>Better Bullpen ${item.awayBetterBullpen ? "✅" : "❌"}</p>
      <p>Offense ${item.awayBetterOffense ? "✅" : "❌"}</p>
      <p>Defense ${item.awayBetterDefense ? "✅" : "❌"}</p>

      <hr>

      <p><strong>${item.game.homeTeam}</strong></p>
      <p>Starting Pitcher ${item.homeBetterSP ? "✅" : "❌"}</p>
      <p>Better Bullpen ${item.homeBetterBullpen ? "✅" : "❌"}</p>
      <p>Offense ${item.homeBetterOffense ? "✅" : "❌"}</p>
      <p>Defense ${item.homeBetterDefense ? "✅" : "❌"}</p>
    </div>
  `).join("");
}

async function init() {
  try {
    await loadGames();
    await buildPitcherTargets();
    await loadHRPicks();
    await loadHitPicks();
    await loadMoneyline();
  } catch (err) {
    console.error("POPS app error:", err);

    hrPicksBox.innerHTML = `
      <div class="pick-card">
        <h3>⚠️ Site loading error</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
}

init();
