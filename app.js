const scoresBox = document.getElementById("scoresBox");
const hrBox = document.getElementById("hrBox");
const scoutingBox = document.getElementById("scoutingBox");
const leadersBox = document.getElementById("leadersBox");
const liveHrBox = document.getElementById("liveHrBox");
const tickerBox = document.getElementById("tickerBox");

let cachedGames = [];

function scrollToSection(id) {
  document.getElementById(id).scrollIntoView({ behavior: "smooth" });
}

function teamName(game, side) {
  return game.teams[side].team.name;
}

function teamScore(game, side) {
  return game.teams[side].score ?? 0;
}

function gameStatus(game) {
  return game.status?.detailedState || "Scheduled";
}

function probablePitcher(game, side) {
  return game.teams[side].probablePitcher?.fullName || "TBD";
}

function probablePitcherId(game, side) {
  return game.teams[side].probablePitcher?.id || null;
}

function buildTicker(games) {
  if (!games.length) {
    tickerBox.innerHTML = "No MLB games today.";
    return;
  }

  tickerBox.innerHTML = games.map(game => {
    const away = teamName(game, "away");
    const home = teamName(game, "home");
    return `⚾ ${away} ${teamScore(game, "away")} - ${teamScore(game, "home")} ${home} • ${gameStatus(game)}`;
  }).join(" &nbsp; | &nbsp; ");
}

function buildGameCards(games) {
  scoresBox.innerHTML = games.map(game => {
    const away = teamName(game, "away");
    const home = teamName(game, "home");

    return `
      <div class="game-card" onclick="loadScouting(${game.gamePk})">
        <h3>${away} vs ${home}</h3>
        <p class="score">${teamScore(game, "away")} - ${teamScore(game, "home")}</p>
        <p><span class="badge">${gameStatus(game)}</span></p>
        <p><strong>Pitchers:</strong> ${probablePitcher(game, "away")} vs ${probablePitcher(game, "home")}</p>
        <p class="small">Tap to view full POPS scouting report.</p>
      </div>
    `;
  }).join("");
}

function projectedTargetsForGame(game) {
  const away = teamName(game, "away");
  const home = teamName(game, "home");

  let targets = [];

  Formula.getProjectedPowerBats(away).forEach((name, index) => {
    const result = Formula.getHrScore(name, index + 2, { risk: 70 });
    targets.push({
      name,
      team: away,
      game: away + " vs " + home,
      pitcher: probablePitcher(game, "home"),
      score: result.score,
      reasons: result.reasons
    });
  });

  Formula.getProjectedPowerBats(home).forEach((name, index) => {
    const result = Formula.getHrScore(name, index + 2, { risk: 70 });
    targets.push({
      name,
      team: home,
      game: away + " vs " + home,
      pitcher: probablePitcher(game, "away"),
      score: result.score,
      reasons: result.reasons
    });
  });

  return targets.sort((a, b) => b.score - a.score);
}

function buildHRTargets(games) {
  let allTargets = [];

  games.forEach(game => {
    allTargets.push(...projectedTargetsForGame(game));
  });

  allTargets = allTargets.sort((a, b) => b.score - a.score).slice(0, 20);

  hrBox.innerHTML = allTargets.map((p, i) => `
    <div class="pick-card">
      <span class="rank-badge">#${i + 1}</span>
      <h3>💣 ${p.name}</h3>
      <p><strong>Team:</strong> ${p.team}</p>
      <p><strong>Game:</strong> ${p.game}</p>
      <p><strong>Vs Pitcher:</strong> ${p.pitcher}</p>
      <p><strong>POPS HR Score:</strong> <span class="hr-score">${p.score}/100</span></p>
      <p class="small">${p.reasons}</p>
    </div>
  `).join("");
}

async function pitcherRisk(name, id) {
  if (!id) {
    return {
      name,
      era: "N/A",
      hr9: "0.00",
      hrAllowed: 0,
      ip: 0,
      risk: 50
    };
  }

  try {
    const data = await API.getPitcherStats(id);
    const split = data.stats?.[0]?.splits?.[0];

    if (!split) {
      return {
        name,
        era: "N/A",
        hr9: "0.00",
        hrAllowed: 0,
        ip: 0,
        risk: 50
      };
    }

    const stat = split.stat;
    const hrAllowed = Number(stat.homeRuns || 0);
    const ip = parseFloat(stat.inningsPitched || 0);
    const era = stat.era || "N/A";
    const hr9 = ip > 0 ? ((hrAllowed / ip) * 9).toFixed(2) : "0.00";

    let risk = 55;
    if (hr9 >= 1.80) risk = 92;
    else if (hr9 >= 1.50) risk = 84;
    else if (hr9 >= 1.20) risk = 76;
    else if (hr9 >= 1.00) risk = 68;

    return {
      name,
      era,
      hr9,
      hrAllowed,
      ip,
      risk
    };

  } catch (err) {
    console.log(err);
    return {
      name,
      era: "N/A",
      hr9: "0.00",
      hrAllowed: 0,
      ip: 0,
      risk: 50
    };
  }
}

async function loadScouting(gamePk) {
  scoutingBox.innerHTML = "Loading scouting report...";

  try {
    const data = await API.getGame(gamePk);

    const away = data.gameData.teams.away.name;
    const home = data.gameData.teams.home.name;

    const awayPitcherObj = data.gameData.probablePitchers?.away || null;
    const homePitcherObj = data.gameData.probablePitchers?.home || null;

    const awayPitcher = awayPitcherObj ? awayPitcherObj.fullName : "TBD";
    const homePitcher = homePitcherObj ? homePitcherObj.fullName : "TBD";

    const awayRisk = await pitcherRisk(awayPitcher, awayPitcherObj?.id);
    const homeRisk = await pitcherRisk(homePitcher, homePitcherObj?.id);

    const players = data.gameData.players || {};
    const awayOrder = data.liveData.boxscore.teams.away.battingOrder || [];
    const homeOrder = data.liveData.boxscore.teams.home.battingOrder || [];

    scoutingBox.innerHTML = `
      <div class="report-card">
        <h3>${away} vs ${home}</h3>

        <p><strong>Starting Pitchers:</strong> ${awayPitcher} vs ${homePitcher}</p>

        <hr>

        <h3>🎯 Pitcher HR Risk</h3>

        ${pitcherRiskHTML(awayRisk)}
        ${pitcherRiskHTML(homeRisk)}

        <hr>

        <h3>💣 POPS Top 3 HR Targets</h3>
        ${gameTop3HTML(away, home, awayPitcher, homePitcher)}

        <hr>

        <h3>👥 ${away} Lineup</h3>
        <ol>${lineupHTML(awayOrder, players)}</ol>

        <h3>👥 ${home} Lineup</h3>
        <ol>${lineupHTML(homeOrder, players)}</ol>

        <hr>

        <h3>🌦 Weather</h3>
        <p class="small">Weather boost module coming next.</p>

        <h3>💰 Moneyline Edge</h3>
        <p class="small">Moneyline model coming next.</p>
      </div>
    `;

    scoutingBox.scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    console.log(err);
    scoutingBox.innerHTML = "Error loading scouting report.";
  }
}

function pitcherRiskHTML(p) {
  return `
    <div class="pick-card">
      <h3>${p.name}</h3>
      <p><strong>Risk:</strong> <span class="${Pitchers.getColorClass(p.risk)}">${p.risk}/100</span></p>
      <p><span class="badge">${Pitchers.getTier(p.risk)}</span></p>
      <p>ERA: ${p.era} | HR/9: ${p.hr9} | HR Allowed: ${p.hrAllowed} | IP: ${p.ip}</p>
    </div>
  `;
}

function gameTop3HTML(away, home, awayPitcher, homePitcher) {
  const fakeGame = {
    teams: {
      away: { team: { name: away }, probablePitcher: { fullName: awayPitcher } },
      home: { team: { name: home }, probablePitcher: { fullName: homePitcher } }
    }
  };

  const targets = projectedTargetsForGame(fakeGame).slice(0, 3);

  return targets.map((p, i) => `
    <div class="pick-card">
      <h3>${i + 1}. 💣 ${p.name}</h3>
      <p><strong>Team:</strong> ${p.team}</p>
      <p><strong>Vs Pitcher:</strong> ${p.pitcher}</p>
      <p><strong>POPS Score:</strong> <span class="hr-score">${p.score}/100</span></p>
      <p class="small">${p.reasons}</p>
    </div>
  `).join("");
}

function lineupHTML(order, players) {
  if (!order || !order.length) {
    return "<li>Lineup not posted yet</li>";
  }

  return order.map(id => {
    const player = players["ID" + id];
    return `<li>${player ? player.fullName : "Unknown Player"}</li>`;
  }).join("");
}

function loadLeaders() {
  leadersBox.innerHTML = `
    <div class="pick-card">
      <h3>👑 POPS HR Power Leaders</h3>
      <p>1. Aaron Judge — 98/100</p>
      <p>2. Shohei Ohtani — 97/100</p>
      <p>3. Kyle Schwarber — 93/100</p>
      <p>4. Pete Alonso — 92/100</p>
      <p>5. Matt Olson — 90/100</p>
    </div>

    <div class="pick-card">
      <h3>🎯 Pitchers To Target</h3>
      <p>Auto-ranking by HR/9 loads inside each scouting report.</p>
      <p class="small">Full daily pitcher target board coming next.</p>
    </div>
  `;
}

async function loadApp() {
  scoresBox.innerHTML = "Loading games...";
  hrBox.innerHTML = "Loading HR targets...";
  liveHrBox.innerHTML = "Loading live home runs...";

  try {
    const data = await API.getSchedule();
    const games = data.dates?.[0]?.games || [];
    cachedGames = games;

    if (!games.length) {
      scoresBox.innerHTML = "No MLB games found today.";
      hrBox.innerHTML = "No HR targets today.";
      liveHrBox.innerHTML = "No home run tracker today.";
      tickerBox.innerHTML = "No MLB games today.";
      loadLeaders();
      return;
    }

    buildTicker(games);
    buildGameCards(games);
    buildHRTargets(games);

    const homeRuns = await HomeRuns.collectFromGames(games);
    HomeRuns.render(homeRuns, liveHrBox);

    loadLeaders();

  } catch (err) {
    console.log("POPS 9.0 error:", err);
    scoresBox.innerHTML = "Could not load MLB games.";
    hrBox.innerHTML = "Could not load HR targets.";
    liveHrBox.innerHTML = "Could not load home run tracker.";
    tickerBox.innerHTML = "API loading error.";
    loadLeaders();
  }
}

loadApp();
setInterval(loadApp, 60000);
