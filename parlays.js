/*
=========================================================
POPS PICKZ HR PARLAY BUILDER
File: parlays.js
=========================================================

Required HTML element:

<div id="parlayBox"></div>

Recommended script order:

<script src="api.js"></script>
<script src="formula.js"></script>
<script src="parlays.js"></script>
<script src="app.js"></script>

After app.js finishes calculating hrPicks, call:

Parlays.render(hrPicks);

=========================================================
*/

const Parlays = {
  settings: {
    minimumScore: 70,
    safeMinimumScore: 85,
    balancedMinimumScore: 78,
    valueMinimumScore: 70,

    requireConfirmedLineup: false,
    preferDifferentGames: true,
    preferDifferentTeams: true,

    safeLegs: 2,
    balancedLegs: 3,
    valueLegs: 3,
    longshotLegs: 4
  },

  /*
  =======================================================
  BASIC HELPERS
  =======================================================
  */

  num(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  },

  text(value, fallback = "") {
    if (value === null || value === undefined) {
      return fallback;
    }

    return String(value).trim() || fallback;
  },

  escapeHTML(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  uniqueBy(items = [], getKey) {
    const seen = new Set();

    return items.filter(item => {
      const key = getKey(item);

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  },

  shuffle(items = []) {
    const copy = [...items];

    for (let i = copy.length - 1; i > 0; i -= 1) {
      const randomIndex = Math.floor(Math.random() * (i + 1));

      [copy[i], copy[randomIndex]] = [
        copy[randomIndex],
        copy[i]
      ];
    }

    return copy;
  },

  /*
  =======================================================
  PLAYER FIELD NORMALIZATION

  This supports several possible property names from app.js.
  =======================================================
  */

  getPlayerName(player = {}) {
    return this.text(
      player.name ||
      player.playerName ||
      player.batterName ||
      player.fullName ||
      player.player?.fullName,
      "Unknown Player"
    );
  },

  getPlayerId(player = {}) {
    return this.text(
      player.id ||
      player.playerId ||
      player.batterId ||
      player.personId ||
      player.player?.id ||
      this.getPlayerName(player)
    );
  },

  getScore(player = {}) {
    return this.num(
      player.score ??
      player.hrScore ??
      player.popsScore ??
      player.rating ??
      player.totalScore,
      0
    );
  },

  getTeam(player = {}) {
    return this.text(
      player.team ||
      player.teamName ||
      player.batterTeam ||
      player.club ||
      player.player?.currentTeam?.name,
      "Team TBD"
    );
  },

  getOpponent(player = {}) {
    return this.text(
      player.opponent ||
      player.opponentName ||
      player.vs ||
      player.opposingTeam,
      "Opponent TBD"
    );
  },

  getPitcher(player = {}) {
    return this.text(
      player.pitcher ||
      player.pitcherName ||
      player.opposingPitcher ||
      player.opponentPitcher,
      "Pitcher TBD"
    );
  },

  getGameKey(player = {}) {
    const gamePk = this.text(
      player.gamePk ||
      player.gameId ||
      player.gameID ||
      player.game?.gamePk
    );

    if (gamePk) {
      return gamePk;
    }

    const matchup = this.text(
      player.game ||
      player.matchup ||
      player.gameName
    );

    if (matchup) {
      return matchup.toLowerCase();
    }

    const team = this.getTeam(player);
    const opponent = this.getOpponent(player);

    return [team, opponent]
      .sort()
      .join("-")
      .toLowerCase();
  },

  getISO(player = {}) {
    const iso = this.num(
      player.iso ??
      player.ISO ??
      player.stats?.iso,
      0
    );

    return iso > 0 ? iso.toFixed(3) : "";
  },

  getHRX(player = {}) {
    const hrx = this.num(
      player.hrx ??
      player.HRX ??
      player.expectedHomeRuns ??
      player.xHR,
      0
    );

    return hrx > 0 ? hrx.toFixed(1) : "";
  },

  getLineupSpot(player = {}) {
    return this.num(
      player.lineupSpot ??
      player.battingOrder ??
      player.order ??
      player.spot,
      0
    );
  },

  getBvpHomeRuns(player = {}) {
    return this.num(
      player.bvpHR ??
      player.bvpHomeRuns ??
      player.homeRunsVsPitcher ??
      player.vsPitcherHR,
      0
    );
  },

  isConfirmed(player = {}) {
    if (
      player.confirmed === true ||
      player.lineupConfirmed === true ||
      player.isConfirmed === true
    ) {
      return true;
    }

    if (
      player.confirmed === false ||
      player.lineupConfirmed === false ||
      player.isConfirmed === false
    ) {
      return false;
    }

    return this.getLineupSpot(player) > 0;
  },

  /*
  =======================================================
  PLAYER LABELS AND REASONS
  =======================================================
  */

  getTier(score = 0) {
    if (score >= 92) return "Elite";
    if (score >= 86) return "Excellent";
    if (score >= 80) return "Very Strong";
    if (score >= 74) return "Strong";
    return "Upside";
  },

  getReasons(player = {}) {
    const reasons = [];

    const score = this.getScore(player);
    const iso = this.num(player.iso ?? player.ISO, 0);
    const hrx = this.num(
      player.hrx ??
      player.HRX ??
      player.expectedHomeRuns ??
      player.xHR,
      0
    );

    const lineupSpot = this.getLineupSpot(player);
    const bvpHR = this.getBvpHomeRuns(player);

    const pitcherRisk = this.num(
      player.pitcherRisk ??
      player.pitcherHRRisk ??
      player.opposingPitcherRisk,
      0
    );

    const streak = this.num(
      player.hitStreak ??
      player.streak ??
      player.currentHitStreak,
      0
    );

    if (score >= 90) {
      reasons.push("Elite POPS HR score");
    } else if (score >= 84) {
      reasons.push("Excellent POPS HR score");
    } else if (score >= 78) {
      reasons.push("Strong POPS HR score");
    }

    if (iso >= 0.250) {
      reasons.push("Elite ISO power");
    } else if (iso >= 0.200) {
      reasons.push("Strong ISO power");
    }

    if (hrx >= 20) {
      reasons.push("High expected HR production");
    }

    if (pitcherRisk >= 75) {
      reasons.push("High-risk opposing pitcher");
    }

    if (bvpHR >= 2) {
      reasons.push(`${bvpHR} career HR vs pitcher`);
    } else if (bvpHR === 1) {
      reasons.push("Previous HR vs pitcher");
    }

    if (lineupSpot >= 1 && lineupSpot <= 4) {
      reasons.push(`Batting ${lineupSpot}${this.ordinalSuffix(lineupSpot)}`);
    }

    if (streak >= 5) {
      reasons.push(`${streak}-game hit streak`);
    }

    if (this.isConfirmed(player)) {
      reasons.push("Confirmed lineup");
    }

    return reasons.slice(0, 3);
  },

  ordinalSuffix(number) {
    const value = Number(number);

    if (value % 100 >= 11 && value % 100 <= 13) {
      return "th";
    }

    if (value % 10 === 1) return "st";
    if (value % 10 === 2) return "nd";
    if (value % 10 === 3) return "rd";

    return "th";
  },

  /*
  =======================================================
  PREPARE ELIGIBLE PLAYERS
  =======================================================
  */

  normalizePlayers(hrPicks = []) {
    if (!Array.isArray(hrPicks)) {
      return [];
    }

    const normalized = hrPicks
      .filter(Boolean)
      .map(player => ({
        ...player,

        _parlayName: this.getPlayerName(player),
        _parlayId: this.getPlayerId(player),
        _parlayScore: this.getScore(player),
        _parlayTeam: this.getTeam(player),
        _parlayOpponent: this.getOpponent(player),
        _parlayPitcher: this.getPitcher(player),
        _parlayGameKey: this.getGameKey(player),
        _parlayConfirmed: this.isConfirmed(player)
      }))
      .filter(player =>
        player._parlayName !== "Unknown Player" &&
        player._parlayScore >= this.settings.minimumScore
      );

    const uniquePlayers = this.uniqueBy(
      normalized,
      player => player._parlayId
    );

    return uniquePlayers.sort(
      (a, b) => b._parlayScore - a._parlayScore
    );
  },

  filterConfirmed(players = []) {
    if (!this.settings.requireConfirmedLineup) {
      return players;
    }

    return players.filter(player => player._parlayConfirmed);
  },

  /*
  =======================================================
  COMBINATION GENERATOR
  =======================================================
  */

  canAddPlayer(player, selected = [], options = {}) {
    const {
      uniqueGames = true,
      uniqueTeams = true
    } = options;

    const playerAlreadyUsed = selected.some(
      selectedPlayer =>
        selectedPlayer._parlayId === player._parlayId
    );

    if (playerAlreadyUsed) {
      return false;
    }

    if (uniqueGames) {
      const gameAlreadyUsed = selected.some(
        selectedPlayer =>
          selectedPlayer._parlayGameKey === player._parlayGameKey
      );

      if (gameAlreadyUsed) {
        return false;
      }
    }

    if (uniqueTeams) {
      const teamAlreadyUsed = selected.some(
        selectedPlayer =>
          selectedPlayer._parlayTeam === player._parlayTeam
      );

      if (teamAlreadyUsed) {
        return false;
      }
    }

    return true;
  },

  createCombination(players = [], legCount = 2, options = {}) {
    const {
      minimumScore = this.settings.minimumScore,
      uniqueGames = this.settings.preferDifferentGames,
      uniqueTeams = this.settings.preferDifferentTeams,
      randomize = false,
      excludedPlayerIds = []
    } = options;

    let pool = players.filter(player =>
      player._parlayScore >= minimumScore &&
      !excludedPlayerIds.includes(player._parlayId)
    );

    if (randomize) {
      pool = this.shuffle(pool);
    }

    const selected = [];

    for (const player of pool) {
      if (
        this.canAddPlayer(player, selected, {
          uniqueGames,
          uniqueTeams
        })
      ) {
        selected.push(player);
      }

      if (selected.length === legCount) {
        break;
      }
    }

    /*
    If strict game and team rules prevent a complete parlay,
    relax team uniqueness first.
    */

    if (selected.length < legCount) {
      for (const player of pool) {
        if (
          this.canAddPlayer(player, selected, {
            uniqueGames,
            uniqueTeams: false
          })
        ) {
          selected.push(player);
        }

        if (selected.length === legCount) {
          break;
        }
      }
    }

    /*
    If there still are not enough players,
    allow multiple players from the same game.
    */

    if (selected.length < legCount) {
      for (const player of pool) {
        if (
          this.canAddPlayer(player, selected, {
            uniqueGames: false,
            uniqueTeams: false
          })
        ) {
          selected.push(player);
        }

        if (selected.length === legCount) {
          break;
        }
      }
    }

    return selected;
  },

  combinationKey(players = []) {
    return players
      .map(player => player._parlayId)
      .sort()
      .join("|");
  },

  /*
  =======================================================
  BUILD ALL PARLAYS
  =======================================================
  */

  build(hrPicks = []) {
    let players = this.normalizePlayers(hrPicks);
    players = this.filterConfirmed(players);

    const usedCombinationKeys = new Set();

    const safe = this.createCombination(
      players,
      this.settings.safeLegs,
      {
        minimumScore: this.settings.safeMinimumScore,
        uniqueGames: true,
        uniqueTeams: true
      }
    );

    if (safe.length === this.settings.safeLegs) {
      usedCombinationKeys.add(this.combinationKey(safe));
    }

    let balanced = this.createCombination(
      players,
      this.settings.balancedLegs,
      {
        minimumScore: this.settings.balancedMinimumScore,
        uniqueGames: true,
        uniqueTeams: true,
        excludedPlayerIds: safe
          .slice(0, 1)
          .map(player => player._parlayId)
      }
    );

    if (
      usedCombinationKeys.has(this.combinationKey(balanced))
    ) {
      balanced = this.createCombination(
        this.shuffle(players),
        this.settings.balancedLegs,
        {
          minimumScore: this.settings.balancedMinimumScore,
          uniqueGames: true,
          uniqueTeams: true,
          randomize: true
        }
      );
    }

    if (balanced.length === this.settings.balancedLegs) {
      usedCombinationKeys.add(this.combinationKey(balanced));
    }

    const valuePool = players
      .filter(player =>
        player._parlayScore >= this.settings.valueMinimumScore &&
        player._parlayScore < this.settings.safeMinimumScore
      )
      .sort((a, b) => {
        const aValue = this.getValueScore(a);
        const bValue = this.getValueScore(b);

        return bValue - aValue;
      });

    let value = this.createCombination(
      valuePool.length >= this.settings.valueLegs
        ? valuePool
        : players,
      this.settings.valueLegs,
      {
        minimumScore: this.settings.valueMinimumScore,
        uniqueGames: true,
        uniqueTeams: true
      }
    );

    if (
      usedCombinationKeys.has(this.combinationKey(value))
    ) {
      value = this.createCombination(
        this.shuffle(valuePool.length ? valuePool : players),
        this.settings.valueLegs,
        {
          minimumScore: this.settings.valueMinimumScore,
          uniqueGames: true,
          uniqueTeams: true,
          randomize: true
        }
      );
    }

    if (value.length === this.settings.valueLegs) {
      usedCombinationKeys.add(this.combinationKey(value));
    }

    let longshot = this.createCombination(
      this.shuffle(players),
      this.settings.longshotLegs,
      {
        minimumScore: this.settings.minimumScore,
        uniqueGames: true,
        uniqueTeams: true,
        randomize: true
      }
    );

    let attempts = 0;

    while (
      longshot.length === this.settings.longshotLegs &&
      usedCombinationKeys.has(this.combinationKey(longshot)) &&
      attempts < 10
    ) {
      longshot = this.createCombination(
        this.shuffle(players),
        this.settings.longshotLegs,
        {
          minimumScore: this.settings.minimumScore,
          uniqueGames: true,
          uniqueTeams: true,
          randomize: true
        }
      );

      attempts += 1;
    }

    return {
      safe,
      balanced,
      value,
      longshot,
      playerCount: players.length,
      generatedAt: new Date()
    };
  },

  getValueScore(player = {}) {
    const popsScore = player._parlayScore;
    const iso = this.num(player.iso ?? player.ISO, 0);
    const bvpHR = this.getBvpHomeRuns(player);
    const pitcherRisk = this.num(
      player.pitcherRisk ??
      player.pitcherHRRisk ??
      player.opposingPitcherRisk,
      0
    );

    return (
      popsScore +
      iso * 50 +
      bvpHR * 3 +
      pitcherRisk * 0.08
    );
  },

  /*
  =======================================================
  DISPLAY HELPERS
  =======================================================
  */

  getAverageScore(players = []) {
    if (!players.length) {
      return 0;
    }

    const total = players.reduce(
      (sum, player) => sum + player._parlayScore,
      0
    );

    return Math.round(total / players.length);
  },

  renderPlayer(player = {}, index = 0) {
    const name = this.escapeHTML(player._parlayName);
    const team = this.escapeHTML(player._parlayTeam);
    const opponent = this.escapeHTML(player._parlayOpponent);
    const pitcher = this.escapeHTML(player._parlayPitcher);
    const score = Math.round(player._parlayScore);
    const iso = this.getISO(player);
    const hrx = this.getHRX(player);
    const tier = this.getTier(score);
    const reasons = this.getReasons(player);

    const statParts = [];

    if (iso) {
      statParts.push(`ISO ${iso}`);
    }

    if (hrx) {
      statParts.push(`HRX ${hrx}`);
    }

    const statsHTML = statParts.length
      ? `<span class="parlay-player-stats">${statParts.join(" • ")}</span>`
      : "";

    const matchupText =
      opponent !== "Opponent TBD"
        ? `${team} vs ${opponent}`
        : team;

    const pitcherText =
      pitcher !== "Pitcher TBD"
        ? `<span class="parlay-pitcher">vs ${pitcher}</span>`
        : "";

    const reasonsHTML = reasons.length
      ? `
        <div class="parlay-reasons">
          ${reasons
            .map(reason => `<span>✓ ${this.escapeHTML(reason)}</span>`)
            .join("")}
        </div>
      `
      : "";

    return `
      <div class="parlay-player">
        <div class="parlay-leg-number">${index + 1}</div>

        <div class="parlay-player-info">
          <div class="parlay-player-name-row">
            <strong class="parlay-player-name">${name}</strong>
            <span class="parlay-score">${score}</span>
          </div>

          <div class="parlay-player-matchup">
            <span>${matchupText}</span>
            ${pitcherText}
          </div>

          <div class="parlay-player-tags">
            <span class="parlay-tier">${tier}</span>
            ${statsHTML}
            ${
              player._parlayConfirmed
                ? `<span class="parlay-confirmed">Confirmed</span>`
                : `<span class="parlay-projected">Projected</span>`
            }
          </div>

          ${reasonsHTML}
        </div>
      </div>
    `;
  },

  renderCard({
    title,
    icon,
    label,
    description,
    players = [],
    requiredLegs = 2,
    className = ""
  }) {
    if (players.length < requiredLegs) {
      return `
        <article class="parlay-card ${className} parlay-unavailable">
          <div class="parlay-card-header">
            <div>
              <span class="parlay-label">${label}</span>
              <h3>${icon} ${title}</h3>
            </div>
          </div>

          <p class="parlay-description">${description}</p>

          <div class="parlay-empty">
            Not enough qualified hitters are available yet.
          </div>
        </article>
      `;
    }

    const averageScore = this.getAverageScore(players);

    return `
      <article class="parlay-card ${className}">
        <div class="parlay-card-header">
          <div>
            <span class="parlay-label">${label}</span>
            <h3>${icon} ${title}</h3>
          </div>

          <div class="parlay-average">
            <span>AVG</span>
            <strong>${averageScore}</strong>
          </div>
        </div>

        <p class="parlay-description">${description}</p>

        <div class="parlay-player-list">
          ${players
            .map((player, index) =>
              this.renderPlayer(player, index)
            )
            .join("")}
        </div>
      </article>
    `;
  },

  /*
  =======================================================
  MAIN RENDER FUNCTION
  =======================================================
  */

  render(hrPicks = [], elementId = "parlayBox") {
    const box = document.getElementById(elementId);

    if (!box) {
      console.warn(
        `POPS Parlays: #${elementId} was not found in index.html.`
      );

      return;
    }

    const results = this.build(hrPicks);

    if (results.playerCount < 2) {
      box.innerHTML = `
        <div class="parlay-message">
          <h3>🔥 POPS HR Parlay Builder</h3>
          <p>
            Waiting for enough qualified home run picks.
            Parlays will generate automatically when the HR rankings load.
          </p>
        </div>
      `;

      return;
    }

    box.innerHTML = `
      <div class="parlay-builder-header">
        <div>
          <span class="parlay-builder-kicker">
            Automatic Daily Combinations
          </span>

          <h2>🔥 POPS HR Parlay Builder</h2>

          <p>
            Generated from today's POPS HR rankings, pitcher matchups,
            power statistics and confirmed lineup information.
          </p>
        </div>

        <button
          type="button"
          class="parlay-refresh-button"
          id="refreshParlaysButton"
        >
          ↻ New Combinations
        </button>
      </div>

      <div class="parlay-grid">
        ${this.renderCard({
          title: "Safer 2-Leg",
          icon: "🟢",
          label: "Highest Rated",
          description:
            "Two of the strongest qualified hitters from separate matchups.",
          players: results.safe,
          requiredLegs: this.settings.safeLegs,
          className: "parlay-safe"
        })}

        ${this.renderCard({
          title: "Balanced 3-Leg",
          icon: "🟡",
          label: "Balanced Card",
          description:
            "Three strong home run candidates with matchup diversity.",
          players: results.balanced,
          requiredLegs: this.settings.balancedLegs,
          className: "parlay-balanced"
        })}

        ${this.renderCard({
          title: "Value 3-Leg",
          icon: "🟠",
          label: "Upside Value",
          description:
            "Power hitters with strong upside who may rank below the top names.",
          players: results.value,
          requiredLegs: this.settings.valueLegs,
          className: "parlay-value"
        })}

        ${this.renderCard({
          title: "Longshot 4-Leg",
          icon: "🚀",
          label: "High Risk",
          description:
            "Four qualified home run candidates built for maximum upside.",
          players: results.longshot,
          requiredLegs: this.settings.longshotLegs,
          className: "parlay-longshot"
        })}
      </div>

      <div class="parlay-disclaimer">
        <strong>POPS Note:</strong>
        These are model-generated combinations, not guaranteed outcomes.
        Confirm lineups and betting availability before using any selection.
      </div>
    `;

    const refreshButton = document.getElementById(
      "refreshParlaysButton"
    );

    if (refreshButton) {
      refreshButton.addEventListener("click", () => {
        this.render(hrPicks, elementId);
      });
    }
  }
};

/*
=========================================================
GLOBAL HELPER

This allows app.js to call:

buildHrParlays(hrPicks);

or:

Parlays.render(hrPicks);
=========================================================
*/

function buildHrParlays(hrPicks = []) {
  Parlays.render(hrPicks);
}

/*
=========================================================
OPTIONAL CUSTOM EVENT

app.js can also run:

window.dispatchEvent(
  new CustomEvent("popsHrPicksUpdated", {
    detail: { hrPicks }
  })
);

The parlay section will update automatically.
=========================================================
*/

window.addEventListener("popsHrPicksUpdated", event => {
  const updatedPicks = event.detail?.hrPicks;

  if (Array.isArray(updatedPicks)) {
    Parlays.render(updatedPicks);
  }
});

/*
=========================================================
MAKE AVAILABLE GLOBALLY
=========================================================
*/

window.Parlays = Parlays;
window.buildHrParlays = buildHrParlays;
