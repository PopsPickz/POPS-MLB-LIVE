const pitcherTargetsBox = document.getElementById("pitcherTargetsBox");
const hrPicksBox = document.getElementById("hrPicksBox");
const hitPicksBox = document.getElementById("hitPicksBox");
const moneylineBox = document.getElementById("moneylineBox");

let firstLoad = true;
let lastHTML = { pitchers: "", hr: "", hits: "", moneyline: "" };

function showTab(sectionId) {
  ["pitchersSection", "hrSection", "hitsSection", "moneylineSection", "weatherSection", "scoutingSection"].forEach(id => {
    const section = document.getElementById(id);
    if (section) section.style.display = id === sectionId ? "block" : "none";
  });
}

function scrollToSection(id) {
  showTab(id);
}

function updateBox(box, key, html) {
  if (!box) return;
  if (lastHTML[key] !== html) {
    lastHTML[key] = html;
    box.innerHTML = html;
  }
}

function teamName(game, side) {
  return game.teams?.[side]?.team?.name || "TBD";
}

function teamId(game, side) {
  return game.teams?.[side]?.team?.id || null;
}

function probablePitcher(game, side) {
  return game.teams?.[side]?.probablePitcher?.fullName || "TBD";
}

function probablePitcherId(game, side) {
  return game.teams?.[side]?.probablePitcher?.id || null;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fetch failed: " + url);
  return await res.json();
}

function yesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

async function getPreviousLineup(teamIdValue) {
  try {
    const schedule = await fetchJSON(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${yesterdayDate()}&teamId=${teamIdValue}`);
    const gamePk = schedule.dates?.[0]?.games?.[0]?.gamePk;
    if (!gamePk) return [];

    const live = await API.getGame(gamePk);
    const homeId = live.gameData.teams.home.id;
    const side = Number(teamIdValue) === Number(homeId) ? "home" : "away";
    const players = live.liveData.boxscore.teams[side].players || {};

    return Object.values(players)
      .filter(p => p.battingOrder && p.person?.id && p.person?.fullName)
      .map(p => ({
        id: p.person.id,
        name: p.person.fullName,
        order: Number(p.battingOrder) / 100
      }))
      .sort((a, b) => a.order - b.order)
      .slice(0, 9);
  } catch {
    return [];
  }
}

async function pitcherRisk(name, id) {
  if (!id) return { name, id, era: "N/A", whip: "N/A", hr9: "0.00", hrAllowed: 0, ip: 0, risk: 50 };

  try {
    const data = await API.getPitcherStats(id);
    const stat = data.stats?.[0]?.splits?.[0]?.stat;
    if (!stat) return { name, id, era: "N/A", whip: "N/A", hr9: "0.00", hrAllowed: 0, ip: 0, risk: 50 };

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

    return { name, id, era, whip, hr9, hrAllowed, ip, risk: Math.min(100, Math.round(risk)) };
  } catch {
    return { name, id, era: "N/A", whip: "N/A", hr9: "0.00", hrAllowed: 0, ip: 0, risk: 50 };
  }
}

async function getBatterVsPitcherHR(batterId, pitcherId) {
  if (!batterId || !pitcherId) return 0;

  try {
    const data = await API.getBatterVsPitcher(batterId, pitcherId);
    return Number(data.stats?.[0]?.splits?.[0]?.stat?.homeRuns || 0);
  } catch {
    return 0;
  }
}

async function getHitStreak(playerId) {
  if (!playerId) return 0;

  try {
    const data = await API.getHitterGameLog(playerId);
    let games = data.stats?.[0]?.splits || [];

    games = games.sort((a, b) => new Date(b.date || b.gameDate) - new Date(a.date || a.gameDate));

    let streak = 0;
    for (const game of games) {
      if (Number(game.stat?.hits || 0) > 0) streak++;
      else break;
    }

    return streak;
  } catch {
    return 0;
  }
}

async function getHRLast5Games(playerId) {
  if (!playerId) return 0;

  try {
    const data = await API.getHitterGameLog(playerId);
    let games = data.stats?.[0]?.splits || [];

    games = games
      .sort((a, b) => new Date(b.date || b.gameDate) - new Date(a.date || a.gameDate))
      .slice(0, 5);

    return games.reduce((sum, game) => sum + Number(game.stat?.homeRuns || 0), 0);
  } catch {
    return 0;
  }
}

async function getBatterSeasonStats(playerId) {
  if (!playerId) return { barrelRate: 0, hardHitRate: 0, iso: 0, seasonHR: 0, recentHR: 0 };

  try {
    const data = await fetchJSON(`https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&group=hitting`);
    const stat = data.stats?.[0]?.splits?.[0]?.stat || {};

    const avg = Number(stat.avg || 0);
    const slg = Number(stat.slg || 0);
    const iso = Math.max(0, slg - avg);
    const seasonHR = Number(stat.homeRuns || 0);
    const recentHR = await getHRLast5Games(playerId);

    return { barrelRate: 0, hardHitRate: 0, iso, seasonHR, recentHR };
  } catch {
    return { barrelRate: 0, hardHitRate: 0, iso: 0, seasonHR: 0, recentHR: 0 };
  }
}

function addFallbackContactStats(name, batterStats, hitStreak) {
  const isPowerBat = Formula.isKnownPowerBat(name);
  const iso = Number(batterStats.iso || 0);
  const seasonHR = Number(batterStats.seasonHR || 0);
  const recentHR = Number(batterStats.recentHR || 0);

  if (!batterStats.barrelRate) {
    batterStats.barrelRate =
      isPowerBat ? 13 :
      seasonHR >= 20 ? 12 :
      seasonHR >= 15 ? 10 :
      iso >= 0.220 ? 9 :
      iso >= 0.170 ? 7 : 5;
  }

  if (!batterStats.hardHitRate) {
    batterStats.hardHitRate =
      isPowerBat ? 47 :
      seasonHR >= 20 ? 45 :
      seasonHR >= 15 ? 42 :
      iso >= 0.220 ? 40 :
      iso >= 0.170 ? 37 : 34;
  }

  batterStats.recentHardHitRate =
    recentHR >= 2 ? 50 :
    recentHR === 1 ? 45 :
    hitStreak >= 4 ? 42 :
    hitStreak >= 2 ? 40 :
    batterStats.hardHitRate;

  return batterStats;
}

async function addBatterTarget({ id, name, team, game, pitcher, pitcherId, pitcherRiskObj, lineupSpot, type, targets }) {
  try {
    const bvpHR = await getBatterVsPitcherHR(id, pitcherId);
    const hitStreak = await getHitStreak(id);

    let batterStats = await getBatterSeasonStats(id);
    batterStats = addFallbackContactStats(name, batterStats, hitStreak);

    const result = Formula.getHrScore(name, lineupSpot, pitcherRiskObj || {}, {
      bvpHR,
      previousHRvsPitcher: bvpHR,
      hitStreak,
      batterStats
    });

    targets.push({
      id,
      name,
      team,
      game,
      pitcher,
      score: result.score,
      bvpHR,
      hitStreak,
      batterStats,
      reasons: result.reasons,
      type
    });
  } catch (err) {
    console.log("Add batter target error:", name, err);
  }
}

async function buildBatterTargets(games) {
  let targets = [];

  for (const game of games) {
    try {
      const live = await API.getGame(game.gamePk);

      const away = live.gameData.teams.away.name;
      const home = live.gameData.teams.home.name;
      const gameName = `${away} vs ${home}`;

      const awayTeamId = live.gameData.teams.away.id;
      const homeTeamId = live.gameData.teams.home.id;

      const players = live.gameData.players || {};
      const awayOrder = live.liveData.boxscore.teams.away.battingOrder || [];
      const homeOrder = live.liveData.boxscore.teams.home.battingOrder || [];

      const awayPitcherObj = live.gameData.probablePitchers?.away || null;
      const homePitcherObj = live.gameData.probablePitchers?.home || null;

      const awayPitcher = awayPitcherObj?.fullName || "TBD";
      const homePitcher = homePitcherObj?.fullName || "TBD";

      const awayRisk = await pitcherRisk(awayPitcher, awayPitcherObj?.id);
      const homeRisk = await pitcherRisk(homePitcher, homePitcherObj?.id);

      const awayLineup = awayOrder.length
        ? awayOrder.map((id, index) => ({ id, name: players["ID" + id]?.fullName, order: index + 1 })).filter(p => p.name)
        : await getPreviousLineup(awayTeamId);

      const homeLineup = homeOrder.length
        ? homeOrder.map((id, index) => ({ id, name: players["ID" + id]?.fullName, order: index + 1 })).filter(p => p.name)
        : await getPreviousLineup(homeTeamId);

      for (const batter of awayLineup) {
        await addBatterTarget({
          id: batter.id,
          name: batter.name,
          team: away,
          game: gameName,
          pitcher: homePitcher,
          pitcherId: homePitcherObj?.id,
          pitcherRiskObj: homeRisk,
          lineupSpot: batter.order,
          type: awayOrder.length ? "Confirmed lineup" : "Yesterday lineup",
          targets
        });
      }

      for (const batter of homeLineup) {
        await addBatterTarget({
          id: batter.id,
          name: batter.name,
          team: home,
          game: gameName,
          pitcher: awayPitcher,
          pitcherId: awayPitcherObj?.id,
          pitcherRiskObj: awayRisk,
          lineupSpot: batter.order,
          type: homeOrder.length ? "Confirmed lineup" : "Yesterday lineup",
          targets
        });
      }

    } catch (err) {
      console.log("Batter target error:", err);
    }
  }

  return targets;
}

async function loadHRPicks(games) {
  let targets = await buildBatterTargets(games);

  targets = targets.sort((a, b) => b.score - a.score).slice(0, 20);

  const html = targets.map((p, i) => `
    <div class="pick-card">
      <span class="rank-badge">#${i + 1}</span>
      <h3>💣 ${p.name}</h3>
      <p><strong>Team:</strong> ${p.team}</p>
      <p><strong>Game:</strong> ${p.game}</p>
      <p><strong>Vs Pitcher:</strong> ${p.pitcher}</p>
      <p><strong>Previous HR vs Pitcher:</strong> ${p.bvpHR}</p>
      <p><strong>Hit Streak:</strong> ${p.hitStreak}+ games</p>
      <p><strong>POPS HR Score:</strong> <span class="score">${p.score}/100</span></p>
      <p class="small">${p.type} | ${p.reasons}</p>
    </div>
  `).join("");

  updateBox(hrPicksBox, "hr", html || "No HR picks loaded.");
}

async function loadHitPicks(games) {
  let targets = await buildBatterTargets(games);

  targets = targets
    .filter(p => Number(p.hitStreak || 0) >= 2 || Number(p.bvpHR || 0) > 0)
    .sort((a, b) => Number(b.hitStreak || 0) - Number(a.hitStreak || 0))
    .slice(0, 30);

  if (!targets.length) {
    updateBox(hitPicksBox, "hits", `
      <div class="pick-card">
        <h3>🔥 No Hit Pickz Loaded Yet</h3>
        <p>Hit Pickz will populate when a hitter has a 2+ game hit streak or previous HR vs today’s pitcher.</p>
      </div>
    `);
    return;
  }

  const html = targets.map((p, i) => `
    <div class="pick-card">
      <span class="rank-badge">#${i + 1}</span>
      <h3>🔥 ${p.name}</h3>
      <p><strong>Team:</strong> ${p.team}</p>
      <p><strong>Game:</strong> ${p.game}</p>
      <p><strong>Vs Pitcher:</strong> ${p.pitcher}</p>
      <p><strong>Hit Streak:</strong> ${p.hitStreak}+ games</p>
      <p><strong>Previous HR vs Pitcher:</strong> ${p.bvpHR}</p>
    </div>
  `).join("");

  updateBox(hitPicksBox, "hits", html);
}

async function getTeamStats(teamIdValue) {
  try {
    const data = await API.getTeamStats(teamIdValue);

    const hitting = data.stats?.find(s => s.group.displayName === "hitting")?.splits?.[0]?.stat || {};
    const pitching = data.stats?.find(s => s.group.displayName === "pitching")?.splits?.[0]?.stat || {};

    return {
      runs: Number(hitting.runs || 0),
      ops: Number(hitting.ops || 0),
      avg: Number(hitting.avg || 0),
      era: Number(pitching.era || 99),
      whip: Number(pitching.whip || 99)
    };
  } catch {
    return { runs: 0, ops: 0, avg: 0, era: 99, whip: 99 };
  }
}

async function loadMoneyline(games) {
  let cards = [];

  for (const game of games) {
    try {
      const away = teamName(game, "away");
      const home = teamName(game, "home");

      const awayStats = await getTeamStats(teamId(game, "away"));
      const homeStats = await getTeamStats(teamId(game, "home"));

      const awayPitcher = probablePitcher(game, "away");
      const homePitcher = probablePitcher(game, "home");

      const awayRisk = await pitcherRisk(awayPitcher, probablePitcherId(game, "away"));
      const homeRisk = await pitcherRisk(homePitcher, probablePitcherId(game, "home"));

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

      if (awayBetterStarter) awayScore += 35;
      if (homeBetterStarter) homeScore += 35;
      if (awayBetterBullpen) awayScore += 25;
      if (homeBetterBullpen) homeScore += 25;
      if (awayBetterOffense) awayScore += 25;
      if (homeBetterOffense) homeScore += 25;
      if (awayBetterRunSupport) awayScore += 15;
      if (homeBetterRunSupport) homeScore += 15;

      let pick = awayScore > homeScore ? away : homeScore > awayScore ? home : "No Clear Edge";
      let confidence = pick === "No Clear Edge" ? 50 : Math.max(55, Math.min(100, Math.max(awayScore, homeScore)));

      cards.push(`
        <div class="pick-card">
          <h3>💰 ${away} vs ${home}</h3>
          <p><strong>POPS Moneyline Pick:</strong> <span class="green">${pick}</span></p>
          <p><strong>Confidence:</strong> <span class="score">${confidence}%</span></p>
          <hr>
          <h4>${away}</h4>
          <p>Better Starting Pitcher ${awayBetterStarter ? "✅" : "❌"} — ${awayPitcher}</p>
          <p>Better Bullpen ${awayBetterBullpen ? "✅" : "❌"}</p>
          <p>Better Offense ${awayBetterOffense ? "✅" : "❌"}</p>
          <p>Better Run Support ${awayBetterRunSupport ? "✅" : "❌"}</p>
          <p class="small">OPS: ${awayStats.ops} | Runs: ${awayStats.runs} | ERA: ${awayStats.era} | WHIP: ${awayStats.whip}</p>
          <hr>
          <h4>${home}</h4>
          <p>Better Starting Pitcher ${homeBetterStarter ? "✅" : "❌"} — ${homePitcher}</p>
          <p>Better Bullpen ${homeBetterBullpen ? "✅" : "❌"}</p>
          <p>Better Offense ${homeBetterOffense ? "✅" : "❌"}</p>
          <p>Better Run Support ${homeBetterRunSupport ? "✅" : "❌"}</p>
          <p class="small">OPS: ${homeStats.ops} | Runs: ${homeStats.runs} | ERA: ${homeStats.era} | WHIP: ${homeStats.whip}</p>
        </div>
      `);
    } catch (err) {
      console.log("Moneyline game error:", err);
    }
  }

  updateBox(moneylineBox, "moneyline", cards.join("") || "No moneyline picks loaded.");
}

async function loadApp() {
  const currentScroll = window.scrollY;

  if (firstLoad) {
    if (pitcherTargetsBox) pitcherTargetsBox.innerHTML = "Loading pitcher targets...";
    if (hrPicksBox) hrPicksBox.innerHTML = "Loading HR picks...";
    if (hitPicksBox) hitPicksBox.innerHTML = "Loading hit picks...";
    if (moneylineBox) moneylineBox.innerHTML = "Loading moneyline edges...";
  }

  try {
    const data = await API.getSchedule();
    const games = data.dates?.[0]?.games || [];

    if (!games.length) {
      updateBox(pitcherTargetsBox, "pitchers", "No MLB games today.");
      updateBox(hrPicksBox, "hr", "No HR picks today.");
      updateBox(hitPicksBox, "hits", "No hit picks today.");
      updateBox(moneylineBox, "moneyline", "No moneyline picks today.");
      return;
    }

    if (typeof loadPitcherTargets === "function") {
      await loadPitcherTargets(games);
    }

    await loadHRPicks(games);
    await loadHitPicks(games);
    await loadMoneyline(games);

    if (typeof Weather !== "undefined" && Weather.load) {
      Weather.load(games);
    }

  } catch (err) {
    console.log("POPS auto error:", err);
    updateBox(hrPicksBox, "hr", "Error loading HR picks.");
    updateBox(hitPicksBox, "hits", "Error loading hit picks.");
    updateBox(moneylineBox, "moneyline", "Error loading moneyline picks.");
  }

  firstLoad = false;
  window.scrollTo({ top: currentScroll, behavior: "instant" });
}

loadApp();
showTab("pitchersSection");
setInterval(loadApp, 120000);