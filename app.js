const pitcherTargetsBox = document.getElementById("pitcherTargetsBox");
const battersBox = document.getElementById("battersBox");
const moneylineBox = document.getElementById("moneylineBox");
const matchupsBox = document.getElementById("matchupsBox");

let firstLoad = true;
let lastHTML = {
  pitchers: "",
  batters: "",
  moneyline: "",
  matchups: ""
};

function scrollToSection(id) {
  document.getElementById(id).scrollIntoView({ behavior: "smooth" });
}

function updateBox(box, key, html) {
  if (lastHTML[key] !== html) {
    lastHTML[key] = html;
    box.innerHTML = html;
  }
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
  if (!id) {
    return { name, id, era: "N/A", hr9: "0.00", hrAllowed: 0, ip: 0, risk: 50 };
  }

  try {
    const data = await API.getPitcherStats(id);
    const split = data.stats?.[0]?.splits?.[0];

    if (!split) {
      return { name, id, era: "N/A", hr9: "0.00", hrAllowed: 0, ip: 0, risk: 50 };
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

    return { name, id, era, hr9, hrAllowed, ip, risk };

  } catch (err) {
    console.log("Pitcher risk error:", err);
    return { name, id, era: "N/A", hr9: "0.00", hrAllowed: 0, ip: 0, risk: 50 };
  }
}

async function getBatterVsPitcherHR(batterId, pitcherId) {
  if (!batterId || !pitcherId) return 0;

  try {
    const url =
      `https://statsapi.mlb.com/api/v1/people/${batterId}/stats?stats=vsPlayer&group=hitting&opposingPlayerId=${pitcherId}`;

    const res = await fetch(url);
    const data = await res.json();
    const stat = data.stats?.[0]?.splits?.[0]?.stat;

    return Number(stat?.homeRuns || 0);

  } catch (err) {
    console.log("BvP HR error:", err);
    return 0;
  }
}

async function getLineupBvpHR(liveGame, side, opposingPitcherId) {
  const order = liveGame.liveData.boxscore.teams[side].battingOrder || [];
  const players = liveGame.gameData.players || [];

  if (!order.length || !opposingPitcherId) {
    return "Batter vs pitcher HR history loads after official lineups post.";
  }

  let hitters = [];

  for (const id of order) {
    const player = players["ID" + id];
    if (!player) continue;

    const hr = await getBatterVsPitcherHR(id, opposingPitcherId);

    if (hr > 0) {
      hitters.push(`${player.fullName}: ${hr} HR`);
    }
  }

  return hitters.length ? hitters.join("<br>") : "No listed lineup batter has a previous HR vs this pitcher.";
}

async function loadPitcherTargets(games) {
  let pitchers = [];

  for (const game of games) {
    try {
      const live = await API.getGame(game.gamePk);

      const away = live.gameData.teams.away.name;
      const home = live.gameData.teams.home.name;

      const awayPitcherObj = live.gameData.probablePitchers?.away || null;
      const homePitcherObj = live.gameData.probablePitchers?.home || null;

      const awayRisk = await pitcherRisk(awayPitcherObj?.fullName || "TBD", awayPitcherObj?.id);
      const homeRisk = await pitcherRisk(homePitcherObj?.fullName || "TBD", homePitcherObj?.id);

      const awayBvp = await getLineupBvpHR(live, "home", awayPitcherObj?.id);
      const homeBvp = await getLineupBvpHR(live, "away", homePitcherObj?.id);

      pitchers.push({
        ...awayRisk,
        game: `${away} vs ${home}`,
        targetTeam: home,
        bvp: awayBvp
      });

      pitchers.push({
        ...homeRisk,
        game: `${away} vs ${home}`,
        targetTeam: away,
        bvp: homeBvp
      });

    } catch (err) {
      console.log("Pitcher target error:", err);
    }
  }

  pitchers = pitchers
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 10);

  const html = pitchers.map((p, i) => `
    <div class="pick-card">
      <span class="rank-badge">#${i + 1}</span>
      <h3>🎯 ${p.name}</h3>
      <p><strong>Target Bats:</strong> ${p.targetTeam}</p>
      <p><strong>Game:</strong> ${p.game}</p>
      <p><strong>Risk:</strong> <span class="hr-score">${p.risk}/100</span></p>
      <p>ERA: ${p.era} | HR/9: ${p.hr9} | HR Allowed: ${p.hrAllowed} | IP: ${p.ip}</p>

      <hr>

      <p><strong>Previous HR vs Pitcher:</strong></p>
      <p class="small">${p.bvp}</p>
    </div>
  `).join("");

  updateBox(pitcherTargetsBox, "pitchers", html);
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
        for (let index = 0; index < awayOrder.length; index++) {
          const id = awayOrder[index];
          const player = players["ID" + id];
          if (!player) continue;

          const result = Formula.getHrScore(player.fullName, index + 1, homeRisk);
          const bvpHR = await getBatterVsPitcherHR(id, homePitcherObj?.id);

          targets.push({
            name: player.fullName,
            team: away,
            game: `${away} vs ${home}`,
            pitcher: homePitcher,
            score: result.score + Math.min(bvpHR * 3, 9),
            bvpHR,
            reasons: result.reasons,
            type: "Confirmed lineup"
          });
        }
      }

      if (homeOrder.length) {
        for (let index = 0; index < homeOrder.length; index++) {
          const id = homeOrder[index];
          const player = players["ID" + id];
          if (!player) continue;

          const result = Formula.getHrScore(player.fullName, index + 1, awayRisk);
          const bvpHR = await getBatterVsPitcherHR(id, awayPitcherObj?.id);

          targets.push({
            name: player.fullName,
            team: home,
            game: `${away} vs ${home}`,
            pitcher: awayPitcher,
            score: result.score + Math.min(bvpHR * 3, 9),
            bvpHR,
            reasons: result.reasons,
            type: "Confirmed lineup"
          });
        }
      }

    } catch (err) {
      console.log("Batter load error:", err);
    }
  }

  if (!targets.length) {
    updateBox(battersBox, "batters", `
      <div class="pick-card">
        <h3>Waiting for official MLB lineups</h3>
        <p>Once lineups post, POPS will automatically rank batters vs the opposing pitcher.</p>
      </div>
    `);
    return;
  }

  targets = targets
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);

  const html = targets.map((p, i) => `
    <div class="pick-card">
      <span class="rank-badge">#${i + 1}</span>
      <h3>💣 ${p.name}</h3>
      <p><strong>Team:</strong> ${p.team}</p>
      <p><strong>Game:</strong> ${p.game}</p>
      <p><strong>Vs Pitcher:</strong> ${p.pitcher}</p>
      <p><strong>Previous HR vs Pitcher:</strong> ${p.bvpHR}</p>
      <p><strong>POPS Score:</strong> <span class="hr-score">${Math.min(p.score, 100)}/100</span></p>
      <p class="small">${p.type} | ${p.reasons}</p>
    </div>
  `).join("");

  updateBox(battersBox, "batters", html);
}

async function loadMoneyline(games) {
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

  let cards = [];

  for (const game of games) {
    const away = teamName(game, "away");
    const home = teamName(game, "home");

    const awayRisk = await pitcherRisk(probablePitcher(game, "away"), probablePitcherId(game, "away"));
    const homeRisk = await pitcherRisk(probablePitcher(game, "home"), probablePitcherId(game, "home"));

    const awayBetterStarter = awayRisk.risk < homeRisk.risk;
    const homeBetterStarter = homeRisk.risk < awayRisk.risk;

    const awayPower = powerTeams.includes(away);
    const homePower = powerTeams.includes(home);

    let awayChecks = 0;
    let homeChecks = 1;

    if (awayBetterStarter) awayChecks++;
    if (homeBetterStarter) homeChecks++;
    if (awayPower) awayChecks += 2;
    if (homePower) homeChecks += 2;

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
      </div>
    `);
  }

  updateBox(moneylineBox, "moneyline", cards.join(""));
}

function loadMatchups(games) {
  const html = games.map(game => {
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

  updateBox(matchupsBox, "matchups", html);
}

async function loadApp() {
  const currentScroll = window.scrollY;

  if (firstLoad) {
    pitcherTargetsBox.innerHTML = "Loading pitcher targets...";
    battersBox.innerHTML = "Checking official MLB lineups...";
    moneylineBox.innerHTML = "Loading moneyline model...";
    matchupsBox.innerHTML = "Loading matchups...";
  }

  try {
    const data = await API.getSchedule();
    const games = data.dates?.[0]?.games || [];

    if (!games.length) {
      updateBox(pitcherTargetsBox, "pitchers", "No MLB games today.");
      updateBox(battersBox, "batters", "No lineups today.");
      updateBox(moneylineBox, "moneyline", "No moneyline picks today.");
      updateBox(matchupsBox, "matchups", "No matchups today.");
      return;
    }

    loadMatchups(games);
    await loadPitcherTargets(games);
    await loadBatters(games);
    await loadMoneyline(games);

  } catch (err) {
    console.log("POPS 10.0 error:", err);
  }

  firstLoad = false;

  window.scrollTo({
    top: currentScroll,
    behavior: "instant"
  });
}

loadApp();
setInterval(loadApp, 120000);
