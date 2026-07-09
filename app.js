const gamesBox = document.getElementById("gamesBox");
const pitcherTargetsBox = document.getElementById("pitcherTargetsBox");
const hrPicksBox = document.getElementById("hrPicksBox");
const hitPicksBox = document.getElementById("hitPicksBox");
const moneylineBox = document.getElementById("moneylineBox");
const scoutingBox = document.getElementById("scoutingBox");

let games = [];
let pitcherTargets = [];
let hrPicks = [];

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

async function getProjectedPowerBats(teamName) {
  const bats = Formula.powerNames
    .filter(name => true)
    .slice(0, 12);

  return bats.map((name, index) => ({
    name,
    lineupSpot: index + 1,
    team: teamName
  }));
}

async function loadHRPicks() {
  hrPicksBox.innerHTML = "<p>Loading HR Pickz...</p>";
  hrPicks = [];

  for (const target of pitcherTargets) {
    const projectedBats = await getProjectedPowerBats(target.targetTeam);

    projectedBats.forEach(batter => {
      const result = Formula.getHrScore(
        batter.name,
        batter.lineupSpot,
        target.risk,
        {
          batterStats: {},
          bvpHR: 0,
          hitStreak: 0,
          hasPlatoonAdvantage: false
        }
      );

      hrPicks.push({
        player: batter.name,
        team: target.targetTeam,
        pitcher: target.pitcher,
        lineupSpot: batter.lineupSpot,
        score: result.score,
        reasons: result.reasons
      });
    });
  }

  hrPicks.sort((a, b) => b.score - a.score);

  if (!hrPicks.length) {
    hrPicksBox.innerHTML = "<p>No HR Pickz found yet.</p>";
    return;
  }

  hrPicksBox.innerHTML = hrPicks.slice(0, 20).map((pick, index) => `
    <div class="pick-card">
      <span class="rank-badge">#${index + 1}</span>
      <h3>${pick.player} - ${pick.team}</h3>
      <p>💣 HR Score: <span class="score">${pick.score}/100</span></p>
      <p>⚾ vs ${pick.pitcher}</p>
      <p>📍 Projected lineup spot: ${pick.lineupSpot}</p>
      <p class="small">${pick.reasons}</p>
    </div>
  `).join("");
}

function loadHitPicks() {
  hitPicksBox.innerHTML = "<p>Hit Pickz coming in Phase 4.</p>";
}

function loadMoneyline() {
  moneylineBox.innerHTML = "<p>Moneyline model coming in Phase 5.</p>";
}

function showScouting(gameId) {
  const game = games.find(g => String(g.id) === String(gameId));
  if (!game) return;

  showTab("scouting");

  scoutingBox.innerHTML = makeCard(
    `${game.awayTeam} vs ${game.homeTeam}`,
    `
      <p>⏰ Game Time: ${formatTime(game.date)}</p>
      <p>📍 Stadium: ${game.venue}</p>
      <p>📊 Status: ${game.status}</p>
      <p>⚾ ${game.awayTeam} Pitcher: ${game.awayPitcher}</p>
      <p>⚾ ${game.homeTeam} Pitcher: ${game.homePitcher}</p>
      <p>🏟️ ${game.awayTeam}: ${game.awayRecord}</p>
      <p>🏟️ ${game.homeTeam}: ${game.homeRecord}</p>
    `
  );
}

async function init() {
  await loadGames();
  await loadPitcherTargets();
  await loadHRPicks();
  loadHitPicks();
  loadMoneyline();
}

init();