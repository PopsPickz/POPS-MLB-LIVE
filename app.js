const pitcherTargetsBox = document.getElementById("pitcherTargetsBox");
const hrPicksBox = document.getElementById("hrPicksBox");
const hitPicksBox = document.getElementById("hitPicksBox");
const moneylineBox = document.getElementById("moneylineBox");

let firstLoad = true;
let lastHTML = { pitchers: "", hr: "", hits: "", moneyline: "" };

const playerHandCache = {};
const batterTargetCache = {};

function showTab(sectionId) {
  [
    "pitchersSection",
    "hrSection",
    "hitsSection",
    "moneylineSection",
    "scoutingSection"
  ].forEach(id => {
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

function gameDateTime(game) {
  if (!game.gameDate) return "Time TBD";

  return new Date(game.gameDate).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fetch failed: " + url);
  return await res.json();
}

async function getPlayerHandInfo(playerId) {
  if (!playerId) return { bats: "N/A", throws: "N/A" };
  if (playerHandCache[playerId]) return playerHandCache[playerId];

  try {
    const data = await fetchJSON(`https://statsapi.mlb.com/api/v1/people/${playerId}`);
    const person = data.people?.[0] || {};

    const info = {
      bats: person.batSide?.code || "N/A",
      throws: person.pitchHand?.code || person.throwHand?.code || "N/A"
    };

    playerHandCache[playerId] = info;
    return info;
  } catch {
    return { bats: "N/A", throws: "N/A" };
  }
}

function hasPlatoonEdge(batterHand, pitcherHand) {
  batterHand = String(batterHand || "").toUpperCase();
  pitcherHand = String(pitcherHand || "").toUpperCase();

  if (!batterHand || !pitcherHand) return false;
  if (batterHand === "S") return true;
  if (batterHand === "L" && pitcherHand === "R") return true;
  if (batterHand === "R" && pitcherHand === "L") return true;

  return false;
}

function yesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

async function getPreviousLineup(teamIdValue) {
  try {
    const schedule = await fetchJSON(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${yesterdayDate()}&teamId=${teamIdValue}`
    );

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
    const stat = data.stats?.[0]?.splits?.[0]?.stat;

    if (!stat) {
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

    return {
      name,
      id,
      era,
      whip,
      hr9,
      hrAllowed,
      ip,
      risk: Math.min(100, Math.round(risk))
    };
  } catch {
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

    games = games.sort(
      (a, b) => new Date(b.date || b.gameDate) - new Date(a.date || a.gameDate)
    );

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
  if (!playerId) {
    return { barrelRate: 0, hardHitRate: 0, iso: 0, seasonHR: 0, recentHR: 0 };
  }

  try {