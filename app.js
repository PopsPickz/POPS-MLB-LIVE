const scoresBox = document.getElementById("scoresBox");
const hrBox = document.getElementById("hrBox");
const scoutingBox = document.getElementById("scoutingBox");
const leadersBox = document.getElementById("leadersBox");

function scrollToSection(id) {
  document.getElementById(id).scrollIntoView({ behavior: "smooth" });
}

const POWER_BATS = {
  "New York Yankees": [
    ["Aaron Judge", 98], ["Giancarlo Stanton", 88], ["Cody Bellinger", 78]
  ],
  "Los Angeles Dodgers": [
    ["Shohei Ohtani", 97], ["Mookie Betts", 86], ["Freddie Freeman", 82]
  ],
  "Texas Rangers": [
    ["Corey Seager", 90], ["Adolis García", 87], ["Wyatt Langford", 80]
  ],
  "Los Angeles Angels": [
    ["Mike Trout", 86], ["Taylor Ward", 80], ["Logan O'Hoppe", 78]
  ],
  "Atlanta Braves": [
    ["Matt Olson", 90], ["Austin Riley", 86], ["Ronald Acuña Jr.", 84]
  ],
  "Philadelphia Phillies": [
    ["Kyle Schwarber", 93], ["Bryce Harper", 88], ["Trea Turner", 78]
  ],
  "New York Mets": [
    ["Pete Alonso", 92], ["Francisco Lindor", 82], ["Juan Soto", 90]
  ]
};

function getFallbackBats(team) {
  return POWER_BATS[team] || [
    [`${team} Power Bat #1`, 76],
    [`${team} Power Bat #2`, 72],
    [`${team} Power Bat #3`, 68]
  ];
}

function statusText(game) {
  return game.status?.detailedState || "Scheduled";
}

function teamName(game, side) {
  return game.teams[side].team.name;
}

function teamScore(game, side) {
  return game.teams[side].score ?? 0;
}

function probablePitcher(game, side) {
  return game.teams[side].probablePitcher?.fullName || "TBD";
}

function probablePitcherId(game, side) {
  return game.teams[side].probablePitcher?.id || null;
}

function buildGameCards(games) {
  scoresBox.innerHTML = games.map(game => {
    const away = teamName(game, "away");
    const home = teamName(game, "home");

    return `
      <div class="game-card" onclick="loadScouting(${game.gamePk})">
        <h3>${away} vs ${home}</h3>
        <p class="score">${teamScore(game, "away")} - ${teamScore(game, "home")}</p>
        <p><span class="badge">${statusText(game)}</span></p>
        <p class="small">Tap for pitchers, lineups, HR risk, and POPS picks.</p>
      </div>
    `;
  }).join("");
}

function buildHRTargets(games) {
  let allTargets = [];

  games.forEach(game => {
    const away = teamName(game, "away");
    const home = teamName(game, "home");

    getFallbackBats(away).forEach(([name, score]) => {
      allTargets.push({
        name,
        team: away,
        matchup: `${away} vs ${home}`,
        score
      });
    });

    getFallbackBats(home).forEach(([name, score]) => {
      allTargets.push({
        name,
        team: home,
        matchup: `${away} vs ${home}`,
        score
      });
    });
  });

  allTargets = allTargets
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  hrBox.innerHTML = allTargets.map((p, i) => `
    <div class="pick-card">
      <h3>${i + 1}. 💣 ${p.name}</h3>
      <p><strong>Team:</strong> ${p.team}</p>
      <p><strong>Game:</strong> ${p.matchup}</p>
      <p><strong>POPS HR Score:</strong> <span class="gold">${p.score}/100</span></p>
      <p class="small">Projected from POPS 8.0 fallback power model.</p>
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

    return { name, era, hr9, hrAllowed, ip, risk };

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

    const awayPitcherObj = data.gameData.probablePitchers?.away;
    const homePitcherObj = data.gameData.probablePitchers?.home;

    const awayPitcher = awayPitcherObj?.fullName || "TBD";
    const homePitcher = homePitcherObj?.fullName || "TBD";

    const awayRisk = await pitcherRisk(awayPitcher, awayPitcherObj?.id);
    const homeRisk = await pitcherRisk(homePitcher, homePitcherObj?.id);

    const awayLineup = data.liveData.boxscore.teams.away.battingOrder || [];
    const homeLineup = data.liveData.boxscore.teams.home.battingOrder || [];
    const players = data.gameData.players || {};

    scoutingBox.innerHTML = `
      <div class="report-card">
        <h3>${away} vs ${home}</h3>

        <p><strong>Starting Pitchers:</strong> ${awayPitcher} vs ${homePitcher}</p>

        <hr>

        <h3>🎯 Pitcher HR Risk</h3>
        <p><strong>${awayRisk.name}:</strong> ${awayRisk.risk}/100</p>
        <p>ERA: ${awayRisk.era} | HR/9: ${awayRisk.hr9} | HR Allowed: ${awayRisk.hrAllowed} | IP: ${awayRisk.ip}</p>

        <p><strong>${homeRisk.name}:</strong> ${homeRisk.risk}/100</p>
        <p>ERA: ${homeRisk.era} | HR/9: ${homeRisk.hr9} | HR Allowed: ${homeRisk.hrAllowed} | IP: ${homeRisk.ip}</p>

        <hr>

        <h3>💣 POPS Top 3 HR Targets</h3>
        ${gameTop3HTML(away, home)}

        <hr>

        <h3>👥 ${away} Lineup</h3>
        <ol>${lineupHTML(awayLineup, players)}</ol>

        <h3>👥 ${home} Lineup</h3>
        <ol>${lineupHTML(homeLineup, players)}</ol>
      </div>
    `;

    scoutingBox.scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    console.log(err);
    scoutingBox.innerHTML = "Error loading scouting report.";
  }
}

function lineupHTML(order, players) {
  if (!order.length) return "<li>Lineup not posted yet</li>";

  return order.map(id => {
    const player = players["ID" + id];
    return `<li>${player ? player.fullName : "Unknown Player"}</li>`;
  }).join("");
}

function gameTop3HTML(away, home) {
  const targets = [
    ...getFallbackBats(away).map(([name, score]) => ({ name, team: away, score })),
    ...getFallbackBats(home).map(([name, score]) => ({ name, team: home, score }))
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return targets.map((p, i) => `
    <div class="pick-card">
      <h3>${i + 1}. 💣 ${p.name}</h3>
      <p>${p.team}</p>
      <p><strong>POPS Score:</strong> <span class="gold">${p.score}/100</span></p>
    </div>
  `).join("");
}

function loadLeaders() {
  leadersBox.innerHTML = `
    <div class="pick-card">
      <h3>👑 POPS 8.0 Leaders</h3>
      <p>1. Aaron Judge — 98/100</p>
      <p>2. Shohei Ohtani — 97/100</p>
      <p>3. Kyle Schwarber — 93/100</p>
      <p>4. Pete Alonso — 92/100</p>
      <p>5. Matt Olson — 90/100</p>
    </div>
  `;
}

async function loadApp() {
  scoresBox.innerHTML = "Loading games...";
  hrBox.innerHTML = "Loading HR targets...";

  try {
    const data = await API.getSchedule();
    const games = data.dates?.[0]?.games || [];

    if (!games.length) {
      scoresBox.innerHTML = "No MLB games found today.";
      hrBox.innerHTML = "No HR targets today.";
      return;
    }

    buildGameCards(games);
    buildHRTargets(games);
    loadLeaders();

  } catch (err) {
    console.log("POPS 8.0 Error:", err);
    scoresBox.innerHTML = "Could not load MLB games. Check API or console.";
    hrBox.innerHTML = "Could not load HR targets.";
    loadLeaders();
  }
}

loadApp();
setInterval(loadApp, 60000);
