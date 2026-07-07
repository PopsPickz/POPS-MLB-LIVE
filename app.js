const scoresBox = document.getElementById("scoresBox");
const hrBox = document.getElementById("hrBox");
const scoutingBox = document.getElementById("scoutingBox");
const leadersBox = document.getElementById("leadersBox");
const liveHrBox = document.getElementById("liveHrBox");
const tickerBox = document.getElementById("tickerBox");

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

async function pitcherRisk(name, id) {
  if (!id) {
    return { name, era: "N/A", hr9: "0.00", hrAllowed: 0, ip: 0, risk: 50 };
  }

  try {
    const data = await API.getPitcherStats(id);
    const split = data.stats?.[0]?.splits?.[0];

    if (!split) {
      return { name, era: "N/A", hr9: "0.00", hrAllowed: 0, ip: 0, risk: 50 };
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

    return { name, era, hr9, hrAllowed, ip, risk };

  } catch (err) {
    console.log(err);
    return { name, era: "N/A", hr9: "0.00", hrAllowed: 0, ip: 0, risk: 50 };
  }
}

async function buildRealHRTargets(games) {
  let allTargets = [];

  for (const game of games) {
    try {
      const live = await API.getGame(game.gamePk);

      const away = live.gameData.teams.away.name;
      const home = live.gameData.teams.home.name;

      const players = live.gameData.players || {};
      const awayOrder = live.liveData.boxscore.teams.away.battingOrder || [];
      const homeOrder = live.liveData.boxscore.teams.home.battingOrder || [];

      const awayPitcherObj = live.gameData.probablePitchers?.away || null;
      const homePitcherObj = live.gameData.probablePitchers?.home || null;

      const awayPitcher = awayPitcherObj?.fullName || "TBD";
      const homePitcher = homePitcherObj?.fullName || "TBD";

      const awayRisk = await pitcherRisk(awayPitcher, awayPitcherObj?.id);
      const homeRisk = await pitcherRisk(homePitcher, homePitcherObj?.id);

      // AWAY hitters vs HOME pitcher
      if (awayOrder.length) {
        awayOrder.forEach((id, index) => {
          const player = players["ID" + id];
          if (!player) return;

          const result = Formula.getHrScore(player.fullName, index + 1, homeRisk);

          allTargets.push({
            name: player.fullName,
            team: away,
            game: away + " vs " + home,
            pitcher: homePitcher,
            pitcherRisk: homeRisk.risk,
            score: result.score,
            reasons: result.reasons,
            type: "Confirmed lineup"
          });
        });
      } else {
        Formula.getProjectedPowerBats(away).forEach((name, index) => {
          const result = Formula.getHrScore(name, index + 2, homeRisk);

          allTargets.push({
            name,
            team: away,
            game: away + " vs " + home,
            pitcher: homePitcher,
            pitcherRisk: homeRisk.risk,
            score: result.score,
            reasons: result.reasons,
            type: "Projected lineup"
          });
        });
      }

      // HOME hitters vs AWAY pitcher
      if (homeOrder.length) {
        homeOrder.forEach((id, index) => {
          const player = players["ID" + id];
          if (!player) return;

          const result = Formula.getHrScore(player.fullName, index + 1, awayRisk);

          allTargets.push({
            name: player.fullName,
            team: home,
            game: away + " vs " + home,
            pitcher: awayPitcher,
            pitcherRisk: awayRisk.risk,
            score: result.score,
            reasons: result.reasons,
            type: "Confirmed lineup"
          });
        });
      } else {
        Formula.getProjectedPowerBats(home).forEach((name, index) => {
          const result = Formula.getHrScore(name, index + 2, awayRisk);

          allTargets.push({
            name,
            team: home,
            game: away + " vs " + home,
            pitcher: awayPitcher,
            pitcherRisk: awayRisk.risk,
            score: result.score,
            reasons: result.reasons,
            type: "Projected lineup"
          });
        });
      }

    } catch (err) {
      console.log("HR target game error:", err);
    }
  }

  allTargets = allTargets
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  hrBox.innerHTML = allTargets.map((p, i) => `
    <div class="pick-card">
      <span class="rank-badge">#${i + 1}</span>
      <h3>💣 ${p.name}</h3>
      <p><strong>Team:</strong> ${p.team}</p>
      <p><strong>Game:</strong> ${p.game}</p>
      <p><strong>Vs Pitcher:</strong> ${p.pitcher}</p>
      <p><strong>Pitcher HR Risk:</strong> ${p.pitcherRisk}/100</p>
      <p><strong>POPS HR Score:</strong> <span class="hr-score">${p.score}/100</span></p>
      <p class="small">${p.type} | ${p.reasons}</p>
    </div>
  `).join("");
}

function buildTicker(games) {
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

async function loadScouting(gamePk) {
  scoutingBox.innerHTML = "Loading scouting report...";

  try {
    const data = await API.getGame(gamePk);

    const away = data.gameData.teams.away.name;
    const home = data.gameData.teams.home.name;

    const awayPitcherObj = data.gameData.probablePitchers?.away || null;
    const homePitcherObj = data.gameData.probablePitchers?.home || null;

    const awayPitcher = awayPitcherObj?.fullName || "TBD";
    const homePitcher = homePitcherObj?.fullName || "TBD";

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

        <h3>👥 ${away} Lineup</h3>
        <ol>${lineupHTML(awayOrder, players)}</ol>

        <h3>👥 ${home} Lineup</h3>
        <ol>${lineupHTML(homeOrder, players)}</ol>
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
      <p><strong>Risk:</strong> ${p.risk}/100</p>
      <p><span class="badge">${Pitchers.getTier(p.risk)}</span></p>
      <p>ERA: ${p.era} | HR/9: ${p.hr9} | HR Allowed: ${p.hrAllowed} | IP: ${p.ip}</p>
    </div>
  `;
}

function lineupHTML(order, players) {
  if (!order || !order.length) return "<li>Lineup not posted yet</li>";

  return order.map(id => {
    const player = players["ID" + id];
    return `<li>${player ? player.fullName : "Unknown Player"}</li>`;
  }).join("");
}

function loadLeaders() {
  leadersBox.innerHTML = `
    <div class="pick-card">
      <h3>👑 POPS HR Formula</h3>
      <p>Uses confirmed lineup spot + opposing pitcher HR risk + known power bat boost.</p>
      <p class="small">More Statcast data will be added in the next upgrade.</p>
    </div>
  `;
}

async function loadApp() {
  scoresBox.innerHTML = "Loading games...";
  hrBox.innerHTML = "Generating real POPS HR targets...";
  liveHrBox.innerHTML = "Loading live home runs...";

  try {
    const data = await API.getSchedule();
    const games = data.dates?.[0]?.games || [];

    if (!games.length) {
      scoresBox.innerHTML = "No MLB games found today.";
      hrBox.innerHTML = "No HR targets today.";
      tickerBox.innerHTML = "No MLB games today.";
      loadLeaders();
      return;
    }

    buildTicker(games);
    buildGameCards(games);
    await buildRealHRTargets(games);

    const homeRuns = await HomeRuns.collectFromGames(games);
    HomeRuns.render(homeRuns, liveHrBox);

    loadLeaders();

  } catch (err) {
    console.log("POPS error:", err);
    scoresBox.innerHTML = "Could not load MLB games.";
    hrBox.innerHTML = "Could not load HR targets.";
    liveHrBox.innerHTML = "Could not load home run tracker.";
    tickerBox.innerHTML = "API loading error.";
    loadLeaders();
  }
}

loadApp();
setInterval(loadApp, 60000);
