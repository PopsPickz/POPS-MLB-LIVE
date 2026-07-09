const gamesBox = document.getElementById("gamesBox");
const pitcherTargetsBox = document.getElementById("pitcherTargetsBox");
const hrPicksBox = document.getElementById("hrPicksBox");
const hitPicksBox = document.getElementById("hitPicksBox");
const moneylineBox = document.getElementById("moneylineBox");
const scoutingBox = document.getElementById("scoutingBox");

let games = [];

function formatTime(dateString) {
  return new Date(dateString).toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  });
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

function showScouting(gameId) {
  const game = games.find(g => String(g.id) === String(gameId));

  if (!game) return;

  showTab("scouting");

  scoutingBox.innerHTML = `
    <div class="player-card">
      <h3>${game.awayTeam} vs ${game.homeTeam}</h3>
      <p>⏰ Game Time: ${formatTime(game.date)}</p>
      <p>📍 Stadium: ${game.venue}</p>
      <p>📊 Status: ${game.status}</p>
      <p>⚾ ${game.awayTeam} Pitcher: ${game.awayPitcher}</p>
      <p>⚾ ${game.homeTeam} Pitcher: ${game.homePitcher}</p>
      <p>🏟️ ${game.awayTeam}: ${game.awayRecord}</p>
      <p>🏟️ ${game.homeTeam}: ${game.homeRecord}</p>
    </div>
  `;
}

function loadPlaceholders() {
  pitcherTargetsBox.innerHTML = "<p>Pitcher targets coming in Phase 2.</p>";
  hrPicksBox.innerHTML = "<p>HR Pickz coming in Phase 3.</p>";
  hitPicksBox.innerHTML = "<p>Hit Pickz coming in Phase 4.</p>";
  moneylineBox.innerHTML = "<p>Moneyline model coming in Phase 5.</p>";
}

function init() {
  loadGames();
  loadPlaceholders();
}

init();