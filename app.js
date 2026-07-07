const pitcherTargetsBox = document.getElementById("pitcherTargetsBox");
const battersBox = document.getElementById("battersBox");
const moneylineBox = document.getElementById("moneylineBox");
const matchupsBox = document.getElementById("matchupsBox");

function scrollToSection(id) {
  document.getElementById(id).scrollIntoView({ behavior: "smooth" });
}

function teamName(game, side) {
  return game.teams[side].team.name;
}

function probablePitcher(game, side) {
  return game.teams[side].probablePitcher?.fullName || "TBD";
}

function probablePitcherId(game, side) {
  return game.teams[side].probablePitcher?.id || null;
}

async function pitcherRisk(name, id) {
  if (!id) return { name, era: "N/A", hr9: "0.00", hrAllowed: 0, ip: 0, risk: 50 };

  try {
    const data = await API.getPitcherStats(id);
    const split = data.stats?.[0]?.splits?.[0];

    if (!split) return { name, era: "N/A", hr9: "0.00", hrAllowed: 0, ip: 0, risk: 50 };

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
    console.log("Pitcher risk error:", err);
    return { name, era: "N/A", hr9: "0.00", hrAllowed: 0, ip: 0, risk: 50 };
  }
}

async function loadPitcherTargets(games) {
  let pitchers = [];

  for (const game of games) {
    const away = teamName(game, "away");
    const home = teamName(game, "home");

    const awayRisk = await pitcherRisk(probablePitcher(game, "away"), probablePitcherId(game, "away"));
    const homeRisk = await pitcherRisk(probablePitcher(game, "home"), probablePitcherId(game, "home"));

    pitchers.push({ ...awayRisk, game: `${away} vs ${home}`, targetTeam: home });
    pitchers.push({ ...homeRisk, game: `${away} vs ${home}`, targetTeam: away });
  }

  pitchers = pitchers.sort((a, b) => b.risk - a.risk);

  pitcherTargetsBox.innerHTML = pitchers.map((p, i) => `
    <div class="pick-card">
      <span class="rank-badge">#${i + 1}</span>
      <h3>🎯 ${p.name}</h3>
      <p><strong>Target Bats:</strong> ${p.targetTeam}</p>
      <p><strong>Game:</strong> ${p.game}</p>
      <p><strong>Risk:</strong> <span class="hr-score">${p.risk}/100</span></p>
      <p>ERA: ${p.era} | HR/9: ${p.hr9} | HR Allowed: ${p.hrAllowed} | IP: ${p.ip}</p>
    </div>
  `).join("");
}

async function loadBatters(games) {
  let targets = [];

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

      if (awayOrder.length) {
        awayOrder.forEach((id, index) => {
          const player = players["ID" + id];
          if (!player) return;

          const result = Formula.getHrScore(player.fullName, index + 1, homeRisk);

          targets.push({
            name: player.fullName,
            team: away,
            game: `${away} vs ${home}`,
            pitcher: homePitcher,
            score: result.score,
            reasons: result.reasons,
            type: "Confirmed lineup"
          });
        });
      }

      if (homeOrder.length) {
        homeOrder.forEach((id, index) => {
          const player = players["ID" + id];
          if (!player) return;

          const result = Formula.getHrScore(player.fullName, index + 1, awayRisk);

          targets.push({
            name: player.fullName,
            team: home,
            game: `${away} vs ${home}`,
            pitcher: awayPitcher,
            score: result.score,
            reasons: result.reasons,
            type: "Confirmed lineup"
          });
        });
      }

    } catch (err) {
      console.log("Batter load error:", err);
    }
  }

  if (!targets.length) {
    battersBox.innerHTML = `
      <div class="pick-card">
        <h3>Waiting for official MLB lineups</h3>
        <p>Once lineups post, POPS will automatically rank batters vs the opposing pitcher.</p>
      </div>
    `;
    return;
  }

  targets = targets.sort((a, b) => b.score - a.score).slice(0, 25);

  battersBox.innerHTML = targets.map((p, i) => `
    <div class="pick-card">
      <span class="rank-badge">#${i + 1}</span>
      <h3>💣 ${p.name}</h3>
      <p><strong>Team:</strong> ${p.team}</p>
      <p><strong>Game:</strong> ${p.game}</p>
      <p><strong>Vs Pitcher:</strong> ${p.pitcher}</p>
      <p><strong>POPS Score:</strong> <span class="hr-score">${p.score}/100</span></p>
      <p class="small">${p.type} | ${p.reasons}</p>
    </div>
  `).join("");
}

async function loadMoneyline(games) {
  let cards = [];

  const powerTeams = [
    "New York Yankees",
    "Los Angeles Dodgers",
    "Philadelphia Phillies",
    "Atlanta Braves",
    "New York Mets",
    "Texas Rangers",
    "Boston Red Sox",
    "Chicago Cubs",
    "Toronto Blue Jays",
    "Seattle Mariners",
    "Milwaukee Brewers",
    "Houston Astros"
  ];

  for (const game of games) {
    const away = teamName(game, "away");
    const home = teamName(game, "home");

    const awayPitcher = probablePitcher(game, "away");
    const homePitcher = probablePitcher(game, "home");

    const awayRisk = await pitcherRisk(awayPitcher, probablePitcherId(game, "away"));
    const homeRisk = await pitcherRisk(homePitcher, probablePitcherId(game, "home"));

    let awayChecks = 0;
    let homeChecks = 0;

    const awayBetterStarter = awayRisk.risk < homeRisk.risk;
    const homeBetterStarter = homeRisk.risk < awayRisk.risk;

    if (awayBetterStarter) awayChecks++;
    if (homeBetterStarter) homeChecks++;

    const awayPower = powerTeams.includes(away);
    const homePower = powerTeams.includes(home);

    if (awayPower) {
      awayChecks++;
      awayChecks++;
    }

    if (homePower) {
      homeChecks++;
      homeChecks++;
    }

    homeChecks++;

    let pick = "No Clear Edge";
    if (awayChecks > homeChecks) pick = away;
    if (homeChecks > awayChecks) pick = home;

    cards.push(`
      <div class="pick-card">
        <h3>💰 ${away} vs ${home}</h3>

        <p><strong>POPS Moneyline Pick:</strong> <span class="gold">${pick}</span></p>

        <hr>

        <p><strong>${away}</strong></p>
        <p>Better Starting Pitcher ${awayBetterStarter ? "✅" : "❌"}</p>
        <p>Better Bullpen ⬜</p>
        <p>Better Offense ${awayPower ? "✅" : "❌"}</p>
        <p>Better Run Support ${awayPower ? "✅" : "❌"}</p>

        <hr>

        <p><strong>${home}</strong></p>
        <p>Better Starting Pitcher ${homeBetterStarter ? "✅" : "❌"}</p>
        <p>Better Bullpen ⬜</p>
        <p>Better Offense ${homePower ? "✅" : "❌"}</p>
        <p>Better Run Support ${homePower ? "✅" : "❌"}</p>

        <p class="small">Starter edge uses pitcher HR risk. Offense/run support uses POPS power-team model.</p>
      </div>
    `);
  }

  moneylineBox.innerHTML = cards.join("");
}

function loadMatchups(games) {
  matchupsBox.innerHTML = games.map(game => {
    const away = teamName(game, "away");
    const home = teamName(game, "home");

    return `
      <div class="game-card">
        <h3>${away} vs ${home}</h3>
        <p><strong>Pitchers:</strong> ${probablePitcher(game, "away")} vs ${probablePitcher(game, "home")}</p>
        <p class="small">Lineups auto-load once MLB posts them.</p>
      </div>
    `;
  }).join("");
}

async function loadApp() {
  pitcherTargetsBox.innerHTML = "Loading pitcher targets...";
  battersBox.innerHTML = "Checking official MLB lineups...";
  moneylineBox.innerHTML = "Loading moneyline model...";
  matchupsBox.innerHTML = "Loading matchups...";

  try {
    const data = await API.getSchedule();
    const games = data.dates?.[0]?.games || [];

    if (!games.length) {
      pitcherTargetsBox.innerHTML = "No MLB games today.";
      battersBox.innerHTML = "No lineups today.";
      moneylineBox.innerHTML = "No moneyline picks today.";
      matchupsBox.innerHTML = "No matchups today.";
      return;
    }

    loadMatchups(games);
    await loadPitcherTargets(games);
    await loadBatters(games);
    await loadMoneyline(games);

  } catch (err) {
    console.log("POPS 10.0 error:", err);
    pitcherTargetsBox.innerHTML = "Could not load pitcher targets.";
    battersBox.innerHTML = "Could not load batters.";
    moneylineBox.innerHTML = "Could not load moneyline.";
    matchupsBox.innerHTML = "Could not load matchups.";
  }
}

loadApp();
setInterval(loadApp, 60000);
