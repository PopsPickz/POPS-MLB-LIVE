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

async function loadApp() {
  const currentScroll = window.scrollY;

  if (firstLoad) {
    pitcherTargetsBox.innerHTML = "Loading pitcher targets...";
    hrPicksBox.innerHTML = "Loading HR picks...";
    hitPicksBox.innerHTML = "Loading hit picks...";
    moneylineBox.innerHTML = "Loading moneyline edges...";
    gameBreakdownBox.innerHTML = "Loading game breakdowns...";
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

    if (typeof loadGameBreakdown === "function") {
      loadGameBreakdown(games);
    }

    if (typeof loadPitcherTargets === "function") {
      await loadPitcherTargets(games);
    }

    if (typeof loadHRPicks === "function") {
      await loadHRPicks(games);
    }

    if (typeof loadHitPicks === "function") {
      await loadHitPicks(games);
    }

    if (typeof loadMoneyline === "function") {
      await loadMoneyline(games);
    }

  } catch (err) {
    console.log("POPS Pickz Auto Error:", err);
  }

  firstLoad = false;

  window.scrollTo({
    top: currentScroll,
    behavior: "instant"
  });
}

loadApp();
setInterval(loadApp, 120000);
