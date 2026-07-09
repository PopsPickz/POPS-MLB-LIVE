const gamesBox = document.getElementById("gamesBox");
const hrPicksBox = document.getElementById("hrPicksBox");
const hitPicksBox = document.getElementById("hitPicksBox");
const moneylineBox = document.getElementById("moneylineBox");

let todayData = null;
let games = [];
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

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.warn("POPS safe error:", err);
    return fallback;
  }
}

async function loadTodayData() {
  const res = await fetch(`data/today.json?cache=${Date.now()}`);
  if (!res.ok) throw new Error("Could not load data/today.json");
  todayData = await res.json();

  games = todayData.games.map(game => ({
    id: game.gamePk,
    gamePk: game.gamePk,
    date: game.date,
    venue: game.venue,

    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    awayTeamId: game.awayTeamId,
    homeTeamId: game.homeTeamId,

    awayPitcher: game.awayPitcher,
    homePitcher: game.homePitcher,
    awayPitcherId: game.awayPitcherId,
    homePitcherId: game.homePitcherId,

    awayPitcherStats: game.awayPitcherStats || {},
    homePitcherStats: game.homePitcherStats || {}
  }));
}

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
    iso: slg && avg ? Number((slg - avg).toFixed(3)) : 0
  };
}

function addHRPick(game, batter, pitcherName, pitcherStats, pitcherHand = "") {
  const batterStats = mergeBatterStats(batter);
  const bvpStats = batter.bvp || { atBats: 0, hits: 0, avg: ".000", homeRuns: 0 };
  const bvpHR = Number(bvpStats.homeRuns || 0);
  const hitStreak = Number(batter.hitStreak || 0);
  const batterHand = batter.batSide || "";

  const hasPlatoonAdvantage =
    batterHand === "S" ||
    (batterHand === "L" && pitcherHand === "R") ||
    (batterHand === "R" && pitcherHand === "L");

  const risk = Formula.pitcherRisk(pitcherStats);

  const result = Formula.getHrScore(
    batter.name,
    batter.lineupSpot,
    risk,
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
    pitcher: pitcherName,
    game: `${game.awayTeam} vs ${game.homeTeam}`,
    gameTime: formatTime(game.date),
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

async function loadHRPicks() {
  hrPicksBox.innerHTML = "<p>Loading HR Pickz...</p>";
  hrPicks = [];

  for (const game of todayData.games) {
    const awayPitcherInfo = game.awayPitcherId && API?.getPlayerInfo
      ? await safe(() => API.getPlayerInfo(game.awayPitcherId), {})
      : {};

    const homePitcherInfo = game.homePitcherId && API?.getPlayerInfo
      ? await safe(() => API.getPlayerInfo(game.homePitcherId), {})
      : {};

    const awayLineup = (game.awayLineup || []).map(b => ({
      ...b,
      team: game.awayTeam
    }));

    const homeLineup = (game.homeLineup || []).map(b => ({
      ...b,
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
    if (!uniquePlayers[key] || pick.score > uniquePlayers[key].score) {
      uniquePlayers[key] = pick;
    }
  });

  hrPicks = Object.values(uniquePlayers).sort((a, b) => b.score - a.score);

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

function addHitPick(game, batter, pitcherName) {
  const stats = mergeBatterStats(batter);
  const bvpStats = batter.bvp || { atBats: 0, hits: 0, avg: ".000", homeRuns: 0 };
  const bvpHR = Number(bvpStats.homeRuns || 0);
  const hitStreak = Number(batter.hitStreak || 0);

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
      pitcher: pitcherName,
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
  hitPicksBox.innerHTML = "<p>Loading Hit Pickz...</p>";
  hitPicks = [];

  for (const game of todayData.games) {
    const awayLineup = (game.awayLineup || []).map(b => ({
      ...b,
      team: game.awayTeam
    }));

    const homeLineup = (game.homeLineup || []).map(b => ({
      ...b,
      team: game.homeTeam
    }));

    awayLineup.forEach(batter => addHitPick(game, batter, game.homePitcher));
    homeLineup.forEach(batter => addHitPick(game, batter, game.awayPitcher));
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
  hrPicksBox.innerHTML = "<p>Starting POPS Pickz 10.0...</p>";

  await loadTodayData();
  await loadHRPicks();
  await loadHitPicks();

  if (typeof Moneyline !== "undefined") {
    await Moneyline.load(games);
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