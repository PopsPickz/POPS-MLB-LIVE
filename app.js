const pitcherTargetsBox = document.getElementById("pitcherTargetsBox");
const hrPicksBox = document.getElementById("hrPicksBox");
const hitPicksBox = document.getElementById("hitPicksBox");
const moneylineBox = document.getElementById("moneylineBox");
const gameBreakdownBox = document.getElementById("gameBreakdownBox");

let firstLoad = true;
let lastHTML = {
  pitchers: "",
  hr: "",
  hits: "",
  moneyline: "",
  games: ""
};

const SEASON = new Date().getFullYear();

function scrollToSection(id) {
  const section = document.getElementById(id);
  if (section) section.scrollIntoView({ behavior: "smooth" });
}

function updateBox(box, key, html) {
  if (!box) return;
  if (lastHTML[key] !== html) {
    lastHTML[key] = html;
    box.innerHTML = html;
  }
}

function teamName(game, side) {
  return game.teams[side].team.name;
}

function teamId(game, side) {
  return game.teams[side].team.id;
}

function probablePitcher(game, side) {
  return game.teams[side].probablePitcher?.fullName || "TBD";
}

function probablePitcherId(game, side) {
  return game.teams[side].probablePitcher?.id || null;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fetch failed: " + url);
  return await res.json();
}

/* ---------- PITCHER RISK ---------- */

async function pitcherRisk(name, id) {
  if (!id) {
    return {
      name,
      id,
      era: "N/A",
      whip: "N/A",
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
        id,
        era: "N/A",
        whip: "N/A",
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
    const whip = stat.whip || "N/A";
    const hr9 = ip > 0 ? ((hrAllowed / ip) * 9).toFixed(2) : "0.00";

    let risk = 55;

    if (Number(hr9) >= 1.8) risk += 30;
    else if (Number(hr9) >= 1.5) risk += 24;
    else if (Number(hr9) >= 1.2) risk += 18;
    else if (Number(hr9) >= 1.0) risk += 12;

    if (Number(era) >= 5.0) risk += 10;
    else if (Number(era) >= 4.5) risk += 7;
    else if (Number(era) >= 4.0) risk += 4;

    if (Number(whip) >= 1.4) risk += 6;

    risk = Math.min(100, Math.round(risk));

    return {
      name,
      id,
      era,
      whip,
      hr9,
      hrAllowed,
      ip,
      risk
    };

  } catch (err) {
    console.log("Pitcher risk error:", err);
    return {
      name,
      id,
      era: "N/A",
      whip: "N/A",
      hr9: "0.00",
      hrAllowed: 0,
      ip: 0,
      risk: 50
    };
  }
}

/* ---------- BVP + HIT STREAK ---------- */

async function getBatterVsPitcherHR(batterId, pitcherId) {
  if (!batterId || !pitcherId) return 0;

  try {
    const data = await API.getBatterVsPitcher(batterId, pitcherId);
    const stat = data.stats?.[0]?.splits?.[0]?.stat;
    return Number(stat?.homeRuns || 0);
  } catch {
    return 0;
  }
}

async function getHitStreak(playerId) {
  if (!playerId) return 0;

  try {
    const data = await API.getHitterGameLog(playerId);
    const games = data.stats?.[0]?.splits || [];

    let streak = 0;

    for (const game of games) {
      const hits = Number(game.stat?.hits || 0);
      if (hits > 0) streak++;
      else break;
    }

    return streak;
  } catch {
    return 0;
  }
}

async function getLineupBvpHR(liveGame, side, opposingPitcherId) {
  const order = liveGame.liveData.boxscore.teams[side].battingOrder || [];
  const players = liveGame.gameData.players || {};

  if (!order.length || !opposingPitcherId) {
    return "Loads after official lineups post.";
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

  return hitters.length ? hitters.join("<br>") : "No previous HR found vs this pitcher.";
}

/* ---------- PITCHERS TO TARGET ---------- */

async function loadPitcherTargets(games) {
  let pitchers = [];

  for (const game of games) {
    try {
      const live = await API.getGame(game.gamePk);

      const away = live.gameData.teams.away.name;
      const home = live.gameData.teams.home.name;

      const awayPitcherObj = live.gameData.probablePitchers?.away || null;
      const homePitcherObj = live.gameData.probablePitchers?.home || null;

      const awayRisk = await pitcherRisk(
        awayPitcherObj?.fullName || "TBD",
        awayPitcherObj?.id
      );

      const homeRisk = await pitcherRisk(
        homePitcherObj?.fullName || "TBD",
        homePitcherObj?.id
      );

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

  pitchers = pitchers.sort((a, b) => b.risk - a.risk).slice(0, 10);

  const html = pitchers.map((p, i) => `
    <div class="pick-card">
      <span class="rank-badge">#${i + 1}</span>
      <h3>🎯 ${p.name}</h3>

      <p><strong>Target Bats:</strong> ${p.targetTeam}</p>
      <p><strong>Game:</strong> ${p.game}</p>

      <p><strong>Risk:</strong>
        <span class="hr-score">${p.risk}/100</span>
      </p>

      <p>
        ERA: ${p.era} |
        WHIP: ${p.whip || "N/A"} |
        HR/9: ${p.hr9} |
        HR Allowed: ${p.hrAllowed} |
        IP: ${p.ip}
      </p>

      <hr>

      <p><strong>Previous HR vs Pitcher:</strong></p>
      <p class="small">${p.bvp}</p>
    </div>
  `).join("");

  updateBox(
    pitcherTargetsBox,
    "pitchers",
    html || "No pitcher targets loaded."
  );
}

/* ---------- BATTER TARGET BUILDER ---------- */

async function buildBatterTargets(games) {
  let targets = [];

  for (const game of games) {
    try {
      const live = await API.getGame(game.gamePk);

      const away = live.gameData.teams.away.name;
      const home = live.gameData.teams.home.name;
      const gameName = `${away} vs ${home}`;

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

          const bvpHR = await getBatterVsPitcherHR(id, homePitcherObj?.id);
          const hitStreak = await getHitStreak(id);

          const result = Formula.getHrScore(
            player.fullName,
            index + 1,
            homeRisk,
            { bvpHR, hitStreak }
          );

          targets.push({
            id,
            name: player.fullName,
            team: away,
            game: gameName,
            pitcher: homePitcher,
            score: result.score,
            bvpHR,
            hitStreak,
            reasons: result.reasons,
            type: "Confirmed lineup"
          });
        }
      } else {
        Formula.getProjectedPowerBats(away).forEach((name, index) => {
          const result = Formula.getHrScore(name, index + 2, homeRisk);

          targets.push({
            id: null,
            name,
            team: away,
            game: gameName,
            pitcher: homePitcher,
            score: result.score,
            bvpHR: 0,
            hitStreak: 0,
            reasons: result.reasons,
            type: "Projected lineup"
          });
        });
      }

      if (homeOrder.length) {
        for (let index = 0; index < homeOrder.length; index++) {
          const id = homeOrder[index];
          const player = players["ID" + id];
          if (!player) continue;

          const bvpHR = await getBatterVsPitcherHR(id, awayPitcherObj?.id);
          const hitStreak = await getHitStreak(id);

          const result = Formula.getHrScore(
            player.fullName,
            index + 1,
            awayRisk,
            { bvpHR, hitStreak }
          );

          targets.push({
            id,
            name: player.fullName,
            team: home,
            game: gameName,
            pitcher: awayPitcher,
            score: result.score,
            bvpHR,
            hitStreak,
            reasons: result.reasons,
            type: "Confirmed lineup"
          });
        }
      } else {
        Formula.getProjectedPowerBats(home).forEach((name, index) => {
          const result = Formula.getHrScore(name, index + 2, awayRisk);

          targets.push({
            id: null,
            name,
            team: home,
            game: gameName,
            pitcher: awayPitcher,
            score: result.score,
            bvpHR: 0,
            hitStreak: 0,
            reasons: result.reasons,
            type: "Projected lineup"
          });
        });
      }

    } catch (err) {
      console.log("Batter target error:", err);
    }
  }

  return targets;
}

/* ---------- HR PICKS ---------- */

async function loadHRPicks(games) {
  let targets = await buildBatterTargets(games);

  targets = targets
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const html = targets.map((p, i) => `
    <div class="pick-card">
      <span class="rank-badge">#${i + 1}</span>
      <h3>💣 ${p.name}</h3>

      <p><strong>Team:</strong> ${p.team}</p>
      <p><strong>Game:</strong> ${p.game}</p>
      <p><strong>Vs Pitcher:</strong> ${p.pitcher}</p>
      <p><strong>Previous HR vs Pitcher:</strong> ${p.bvpHR}</p>
      <p><strong>Hit Streak:</strong> ${p.hitStreak}+ games</p>

      <p><strong>POPS HR Score:</strong>
        <span class="hr-score">${p.score}/100</span>
      </p>

      <p class="small">${p.type} | ${p.reasons}</p>
    </div>
  `).join("");

  updateBox(hrPicksBox, "hr", html || "No HR picks loaded.");
}

/* ---------- HIT PICKS ---------- */

async function loadHitPicks(games) {
  let targets = await buildBatterTargets(games);

  targets = targets
    .filter(p => p.bvpHR > 0 || p.hitStreak >= 2)
    .map(p => {
      const hitResult = Formula.getHitScore(p);

      return {
        ...p,
        hitScore: hitResult.score,
        hitReasons: hitResult.reasons
      };
    })
    .sort((a, b) => b.hitScore - a.hitScore)
    .slice(0, 20);

  if (!targets.length) {
    updateBox(
      hitPicksBox,
      "hits",
      `
      <div class="pick-card">
        <h3>🔥 No Hit Pickz Loaded Yet</h3>
        <p class="small">
          Hit Pickz will populate when official lineups post and a hitter has a previous HR vs the pitcher or a 2+ game hit streak.
        </p>
      </div>
      `
    );
    return;
  }

  const html = targets.map((p, i) => `
    <div class="pick-card">
      <span class="rank-badge">#${i + 1}</span>
      <h3>🔥 ${p.name}</h3>

      <p><strong>Team:</strong> ${p.team}</p>
      <p><strong>Game:</strong> ${p.game}</p>
      <p><strong>Vs Pitcher:</strong> ${p.pitcher}</p>
      <p><strong>Previous HR vs Pitcher:</strong> ${p.bvpHR}</p>
      <p><strong>Hit Streak:</strong> ${p.hitStreak}+ games</p>

      <p><strong>POPS Hit Score:</strong>
        <span class="hr-score">${p.hitScore}/100</span>
      </p>

      <p class="small">
        ${p.bvpHR > 0 ? "Previous HR history ✅" : ""}
        ${p.hitStreak >= 2 ? " | 2+ game hit streak ✅" : ""}
        <br>${p.hitReasons}
      </p>
    </div>
  `).join("");

  updateBox(hitPicksBox, "hits", html);
}

/* ---------- TEAM STATS + MONEYLINE ---------- */

async function getTeamStats(teamId) {
  try {
    const data = await API.getTeamStats(teamId);

    const hitting =
      data.stats?.find(s => s.group.displayName === "hitting")
        ?.splits?.[0]?.stat || {};

    const pitching =
      data.stats?.find(s => s.group.displayName === "pitching")
        ?.splits?.[0]?.stat || {};

    return {
      runs: Number(hitting.runs || 0),
      ops: Number(hitting.ops || 0),
      avg: Number(hitting.avg || 0),
      era: Number(pitching.era || 99),
      whip: Number(pitching.whip || 99)
    };

  } catch {
    return {
      runs: 0,
      ops: 0,
      avg: 0,
      era: 99,
      whip: 99
    };
  }
}

async function loadMoneyline(games) {
  let cards = [];

  for (const game of games) {
    try {
      const away = teamName(game, "away");
      const home = teamName(game, "home");

      const awayID = teamId(game, "away");
      const homeID = teamId(game, "home");

      const awayPitcher = probablePitcher(game, "away");
      const homePitcher = probablePitcher(game, "home");

      const awayRisk = await pitcherRisk(awayPitcher, probablePitcherId(game, "away"));
      const homeRisk = await pitcherRisk(homePitcher, probablePitcherId(game, "home"));

      const awayStats = await getTeamStats(awayID);
      const homeStats = await getTeamStats(homeID);

      const awayBetterStarter = awayRisk.risk < homeRisk.risk;
      const homeBetterStarter = homeRisk.risk < awayRisk.risk;

      const awayBetterBullpen = awayStats.era < homeStats.era && awayStats.whip < homeStats.whip;
      const homeBetterBullpen = homeStats.era < awayStats.era && homeStats.whip < awayStats.whip;

      const awayBetterOffense = awayStats.ops > homeStats.ops;
      const homeBetterOffense = homeStats.ops > awayStats.ops;

      const awayBetterRunSupport = awayStats.runs > homeStats.runs;
      const homeBetterRunSupport = homeStats.runs > awayStats.runs;

      let awayScore = 0;
      let homeScore = 1;

      if (awayBetterStarter) awayScore++;
      if (homeBetterStarter) homeScore++;

      if (awayBetterBullpen) awayScore++;
      if (homeBetterBullpen) homeScore++;

      if (awayBetterOffense) awayScore++;
      if (homeBetterOffense) homeScore++;

      if (awayBetterRunSupport) awayScore++;
      if (homeBetterRunSupport) homeScore++;

      let pick = "No Clear Edge";
      let confidence = 50;

      if (awayScore > homeScore) {
        pick = away;
        confidence = 55 + (awayScore - homeScore) * 10;
      }

      if (homeScore > awayScore) {
        pick = home;
        confidence = 55 + (homeScore - awayScore) * 10;
      }

      confidence = Math.min(confidence, 90);

      cards.push(`
        <div class="pick-card">
          <h3>💰 ${away} vs ${home}</h3>

          <p><strong>POPS Moneyline Pick:</strong>
            <span class="gold">${pick}</span>
          </p>

          <p><strong>Confidence:</strong>
            <span class="hr-score">${confidence}%</span>
          </p>

          <hr>

          <p><strong>${away}</strong></p>
          <p>Better Starting Pitcher ${awayBetterStarter ? "✅" : "❌"} — ${awayPitcher}</p>
          <p>Better Bullpen ${awayBetterBullpen ? "✅" : "❌"}</p>
          <p>Better Offense ${awayBetterOffense ? "✅" : "❌"}</p>
          <p>Better Run Support ${awayBetterRunSupport ? "✅" : "❌"}</p>
          <p class="small">
            OPS: ${awayStats.ops} |
            Runs: ${awayStats.runs} |
            ERA: ${awayStats.era} |
            WHIP: ${awayStats.whip}
          </p>

          <hr>

          <p><strong>${home}</strong></p>
          <p>Better Starting Pitcher ${homeBetterStarter ? "✅" : "❌"} — ${homePitcher}</p>
          <p>Better Bullpen ${homeBetterBullpen ? "✅" : "❌"}</p>
          <p>Better Offense ${homeBetterOffense ? "✅" : "❌"}</p>
          <p>Better Run Support ${homeBetterRunSupport ? "✅" : "❌"}</p>
          <p class="small">
            OPS: ${homeStats.ops} |
            Runs: ${homeStats.runs} |
            ERA: ${homeStats.era} |
            WHIP: ${homeStats.whip}
          </p>
        </div>
      `);

    } catch (err) {
      console.log("Moneyline game error:", err);
    }
  }

  updateBox(moneylineBox, "moneyline", cards.join("") || "No moneyline picks loaded.");
}

/* ---------- GAMES ---------- */

function loadGameBreakdown(games) {
  const html = games.map(game => {
    const away = teamName(game, "away");
    const home = teamName(game, "home");

    return `
      <div class="game-card" onclick="Scouting.load(${game.gamePk})">
        <h3>${away} vs ${home}</h3>
        <p><strong>Pitchers:</strong>
          ${probablePitcher(game, "away")} vs ${probablePitcher(game, "home")}
        </p>
        <p class="small">
          Tap to open POPS scouting report.
        </p>
      </div>
    `;
  }).join("");

  updateBox(gameBreakdownBox, "games", html);
}

/* ---------- MAIN ---------- */

async function loadApp() {
  const currentScroll = window.scrollY;

  if (firstLoad) {
    if (pitcherTargetsBox) pitcherTargetsBox.innerHTML = "Loading pitcher targets...";
    if (hrPicksBox) hrPicksBox.innerHTML = "Loading HR picks...";
    if (hitPicksBox) hitPicksBox.innerHTML = "Loading hit picks...";
    if (moneylineBox) moneylineBox.innerHTML = "Loading moneyline edges...";
    if (gameBreakdownBox) gameBreakdownBox.innerHTML = "Loading game breakdowns...";
  }

  try {
    const data = await API.getSchedule();
    const games = data.dates?.[0]?.games || [];

    if (!games.length) {
      updateBox(pitcherTargetsBox, "pitchers", "No MLB games today.");
      updateBox(hrPicksBox, "hr", "No HR picks today.");
      updateBox(hitPicksBox, "hits", "No hit picks today.");
      updateBox(moneylineBox, "moneyline", "No moneyline picks today.");
      updateBox(gameBreakdownBox, "games", "No games today.");
      return;
    }

    loadGameBreakdown(games);
    await loadPitcherTargets(games);
    await loadHRPicks(games);
    await loadHitPicks(games);
    await loadMoneyline(games);

  } catch (err) {
    console.log("POPS auto error:", err);

    updateBox(pitcherTargetsBox, "pitchers", "Error loading pitcher targets.");
    updateBox(hrPicksBox, "hr", "Error loading HR picks.");
    updateBox(hitPicksBox, "hits", "Error loading hit picks.");
    updateBox(moneylineBox, "moneyline", "Error loading moneyline picks.");
    updateBox(gameBreakdownBox, "games", "Error loading games.");
  }

  firstLoad = false;

  window.scrollTo({
    top: currentScroll,
    behavior: "instant"
  });
}

loadApp();
setInterval(loadApp, 120000);
