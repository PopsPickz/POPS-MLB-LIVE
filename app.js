const gamesBox = document.getElementById("gamesBox");
const pitcherTargetsBox = document.getElementById("pitcherTargetsBox");
const hrPicksBox = document.getElementById("hrPicksBox");
const hitPicksBox = document.getElementById("hitPicksBox");
const moneylineBox = document.getElementById("moneylineBox");
const scoutingBox = document.getElementById("scoutingBox");

let games = [];
let pitcherTargets = [];
let hrPicks = [];
let hitPicks = [];

function formatTime(dateString) {
  return new Date(dateString).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}

function makeCard(title, body) {
  return `
    <div class="pick-card">
      <h3>${title}</h3>
      ${body}
    </div>
  `;
}

async function loadGames() {
  gamesBox.innerHTML = "<p>Loading today's MLB games...</p>";

  games = await API.getSchedule();

  if (!games.length) {
    gamesBox.innerHTML = "<p>No MLB games found today.</p>";
    return;
  }

  gamesBox.innerHTML = games.map(game => `
    <div class="game-card" onclick="showScouting('${game.id}')">
      <h3>${game.awayTeam} vs ${game.homeTeam}</h3>
      <p>⏰ ${formatTime(game.date)}</p>
      <p>📍 ${game.venue}</p>
      <p>📊 ${game.status}</p>
      <p>⚾ ${game.awayPitcher} vs ${game.homePitcher}</p>
      <p>${game.awayTeam}: ${game.awayRecord} | ${game.homeTeam}: ${game.homeRecord}</p>
      <button>View Scouting Report</button>
    </div>
  `).join("");
}

async function loadPitcherTargets() {
  pitcherTargetsBox.innerHTML = "<p>Loading pitcher targets...</p>";
  pitcherTargets = [];

  for (const game of games) {
    if (game.awayPitcherId) {
      const stats = await API.getPlayerStats(game.awayPitcherId);
      const risk = Formula.pitcherRisk(stats);

      pitcherTargets.push({
        gameId: game.id,
        pitcher: game.awayPitcher,
        pitcherId: game.awayPitcherId,
        targetTeam: game.homeTeam,
        targetTeamId: game.homeTeamId,
        risk,
        stats
      });
    }

    if (game.homePitcherId) {
      const stats = await API.getPlayerStats(game.homePitcherId);
      const risk = Formula.pitcherRisk(stats);

      pitcherTargets.push({
        gameId: game.id,
        pitcher: game.homePitcher,
        pitcherId: game.homePitcherId,
        targetTeam: game.awayTeam,
        targetTeamId: game.awayTeamId,
        risk,
        stats
      });
    }
  }

  pitcherTargets.sort((a, b) => b.risk.score - a.risk.score);

  if (!pitcherTargets.length) {
    pitcherTargetsBox.innerHTML = "<p>No probable pitchers found yet.</p>";
    return;
  }

  pitcherTargetsBox.innerHTML = pitcherTargets.slice(0, 10).map((item, index) => `
    <div class="pick-card">
      <span class="rank-badge">#${index + 1}</span>
      <h3>${item.targetTeam} vs ${item.pitcher}</h3>
      <p>🎯 Pitcher Risk: <span class="score">${item.risk.score}/100</span></p>
      <p>HR/9: ${item.risk.hr9.toFixed(2)}</p>
      <p>ERA: ${item.stats.era || "N/A"} | WHIP: ${item.stats.whip || "N/A"} | HR Allowed: ${item.stats.homeRuns || "N/A"}</p>
    </div>
  `).join("");
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

async function loadHRPicks() {
  hrPicksBox.innerHTML = "<p>Loading HR Pickz from confirmed lineups...</p>";
  hrPicks = [];

  for (const target of pitcherTargets) {
    let lineup = await getTeamLineup(
      target.gameId,
      target.targetTeamId,
      target.targetTeam
    );

    if (!lineup.length) {
    lineup = getProjectedLineup(target.targetTeam);
    }

      for (const batter of lineup) {
      const batterStats = await API.getBatterStats(batter.id);
      
        const result = Formula.getHrScore(
        batter.name,
        batter.lineupSpot,
        target.risk,
        {
       
          batterStats
        }
        );

      hrPicks.push({
        player: batter.name,
        team: batter.team,
        position: batter.position,
        pitcher: target.pitcher,
        lineupSpot: batter.lineupSpot,
        score: result.score,
        reasons: result.reasons
      });
    }
  }

  hrPicks.sort((a, b) => b.score - a.score);

  if (!lineup.length) {
  lineup = getProjectedLineup(target.targetTeam);
}

  hrPicksBox.innerHTML = hrPicks.slice(0, 20).map((pick, index) => `
    <div class="pick-card">
      <span class="rank-badge">#${index + 1}</span>
      <h3>${pick.player} - ${pick.team}</h3>
      <p>💣 HR Score: <span class="score">${pick.score}/100</span></p>
      <p>⚾ vs ${pick.pitcher}</p>
      <p>📍 Batting spot: ${pick.lineupSpot}</p>
      <p>🧢 Position: ${pick.position || "N/A"}</p>
      <p class="small">${pick.reasons}</p>
    </div>
  `).join("");
}

function loadHitPicks() {
  hitPicksBox.innerHTML = "<p>Loading Hit Pickz...</p>";
  hitPicks = [];

  hrPicks.forEach(pick => {
    const hitStreak = 0;
    const previousHR = 0;

    const score = Formula.getHitScore(
      pick.player,
      pick.lineupSpot,
      hitStreak,
      previousHR
    );

    hitPicks.push({
      ...pick,
      hitStreak,
      previousHR,
      score
    });
  });

  hitPicks.sort((a, b) => b.score - a.score);

  if (!hitPicks.length) {
    hitPicksBox.innerHTML = `
      <div class="pick-card">
        <h3>No Hit Pickz yet</h3>
        <p>Hit Pickz will appear once confirmed lineups are posted.</p>
      </div>
    `;
    return;
  }

  hitPicksBox.innerHTML = hitPicks.slice(0, 20).map((pick, index) => `
    <div class="pick-card">
      <span class="rank-badge">#${index + 1}</span>
      <h3>${pick.player} - ${pick.team}</h3>
      <p>🔥 Hit Score: <span class="score">${pick.score}/100</span></p>
      <p>⚾ vs ${pick.pitcher}</p>
      <p>📍 Batting spot: ${pick.lineupSpot}</p>
      <p>📈 Hit streak: ${pick.hitStreak} games</p>
      <p>💣 Previous HR vs pitcher: ${pick.previousHR > 0 ? "Yes" : "No"}</p>
    </div>
  `).join("");
}

async function loadMoneyline() {
  moneylineBox.innerHTML = "<p>Loading moneyline model...</p>";

  if (!games.length) {
    moneylineBox.innerHTML = "<p>No games found.</p>";
    return;
  }

  const picks = [];

  for (const game of games) {
    const awayStats = await API.getTeamStats(game.awayTeamId);
    const homeStats = await API.getTeamStats(game.homeTeamId);

    const awayScore = Formula.moneylineScore(awayStats, homeStats);
    const homeScore = Formula.moneylineScore(homeStats, awayStats) + 1;

    const pick = homeScore >= awayScore ? game.homeTeam : game.awayTeam;

    picks.push({
      game,
      awayScore,
      homeScore,
      pick
    });
  }

  moneylineBox.innerHTML = picks.map(item => `
    <div class="pick-card">
      <h3>${item.game.awayTeam} vs ${item.game.homeTeam}</h3>
      <p>💰 POPS Pick: <span class="score">${item.pick}</span></p>
      <p>${item.game.awayTeam}: ${item.awayScore} checks</p>
      <p>${item.game.homeTeam}: ${item.homeScore} checks</p>
      <p class="small">Checklist: runs, OPS, ERA, WHIP, home-field edge.</p>
    </div>
  `).join("");
}

async function showScouting(gameId) {
  const game = games.find(g => String(g.id) === String(gameId));
  if (!game) return;

  showTab("scouting");

  const awayLineup = await API.getLineup(game.id, game.awayTeamId);
  const homeLineup = await API.getLineup(game.id, game.homeTeamId);

  scoutingBox.innerHTML = makeCard(
    `${game.awayTeam} vs ${game.homeTeam}`,
    `
      <p>⏰ Game Time: ${formatTime(game.date)}</p>
      <p>📍 Stadium: ${game.venue}</p>
      <p>📊 Status: ${game.status}</p>
      <p>⚾ ${game.awayTeam} Pitcher: ${game.awayPitcher}</p>
      <p>⚾ ${game.homeTeam} Pitcher: ${game.homePitcher}</p>
      <hr>
      <h3>${game.awayTeam} Lineup</h3>
      ${
        awayLineup.length
          ? awayLineup.map(p => `<p>${p.lineupSpot}. ${p.name} ${p.position ? `(${p.position})` : ""}</p>`).join("")
          : "<p>Lineup not posted yet.</p>"
      }
      <hr>
      <h3>${game.homeTeam} Lineup</h3>
      ${
        homeLineup.length
          ? homeLineup.map(p => `<p>${p.lineupSpot}. ${p.name} ${p.position ? `(${p.position})` : ""}</p>`).join("")
          : "<p>Lineup not posted yet.</p>"
      }
    `
  );
}

async function init() {
  try {
    gamesBox.innerHTML = "<p>Starting POPS Pickz 8.0...</p>";

    await loadGames();
    await loadPitcherTargets();
    await loadHRPicks();
    loadHitPicks();
    await loadMoneyline();
  } catch (err) {
    console.error("POPS app error:", err);

    gamesBox.innerHTML = `
      <div class="pick-card">
        <h3>⚠️ Site loading error</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
}

init();
