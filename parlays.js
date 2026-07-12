/*
=========================================================
POPS PICKZ 11.0 HR PARLAY BUILDER
DESIGN OPTION 2
File: parlays.js
=========================================================

Uses the exact same ranked hrPicks array displayed
inside the POPS Home Run Pickz section.

Required HTML:

<section
  class="card tab-section"
  id="parlays"
>
  <h2>🎯 POPS HR Parlays</h2>

  <div id="parlayBox">
    <p>Generating today's HR parlays...</p>
  </div>
</section>

Required script order:

<script src="parlays.js"></script>
<script src="app.js"></script>

At the end of loadHRPicks() in app.js:

if (
  typeof Parlays !== "undefined" &&
  typeof Parlays.render === "function"
) {
  Parlays.render(hrPicks);
}
=========================================================
*/

const Parlays = {
  /*
  =======================================================
  CURRENT GENERATED PARLAYS
  =======================================================
  */

  currentParlays: {
    safe: [],
    balanced: [],
    value: [],
    longshot: []
  },

  /*
  =======================================================
  SETTINGS
  =======================================================
  */

  settings: {
    maximumPlayerPool: 20,

    minimumScore: 0,
    safeMinimumScore: 0,
    balancedMinimumScore: 0,
    valueMinimumScore: 0,

    requireConfirmedLineup: false,

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

    return Number.isFinite(number)
      ? number
      : fallback;
  },

  text(value, fallback = "") {
    if (
      value === null ||
      value === undefined
    ) {
      return fallback;
    }

    const result = String(value).trim();

    return result || fallback;
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
    const usedKeys = new Set();

    return items.filter(item => {
      const key = getKey(item);

      if (!key || usedKeys.has(key)) {
        return false;
      }

      usedKeys.add(key);

      return true;
    });
  },

  /*
  Creates one daily seed.

  This keeps the random combinations the same throughout
  the day, even when the page is refreshed.
  */

  getDailySeed() {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      now.getDate()
    ).padStart(2, "0");

    return Number(
      `${year}${month}${day}`
    );
  },

  /*
  Creates repeatable random numbers using today's date.
  */

  createSeededRandom(
    seed = this.getDailySeed()
  ) {
    let value =
      Number(seed) % 2147483647;

    if (value <= 0) {
      value += 2147483646;
    }

    return function seededRandom() {
      value =
        value * 16807 %
        2147483647;

      return (
        value - 1
      ) / 2147483646;
    };
  },

  /*
  Randomizes the players while keeping today's
  combinations stable for the entire day.
  */

  shuffle(
    items = [],
    extraSeed = 0
  ) {
    /*
    Put players into the exact same starting order
    on every phone, computer and browser.
    */

    const copy = [...items].sort((a, b) => {
      const scoreDifference =
        this.getScore(b) -
        this.getScore(a);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const nameA =
        this.getPlayerName(a)
          .toLowerCase();

      const nameB =
        this.getPlayerName(b)
          .toLowerCase();

      const nameDifference =
        nameA.localeCompare(nameB);

      if (nameDifference !== 0) {
        return nameDifference;
      }

      return this.getTeam(a)
        .toLowerCase()
        .localeCompare(
          this.getTeam(b)
            .toLowerCase()
        );
    });

    const random =
      this.createSeededRandom(
        this.getDailySeed() +
        Number(extraSeed || 0)
      );

    for (
      let index = copy.length - 1;
      index > 0;
      index -= 1
    ) {
      const randomIndex =
        Math.floor(
          random() *
          (index + 1)
        );

      [
        copy[index],
        copy[randomIndex]
      ] = [
        copy[randomIndex],
        copy[index]
      ];
    }

    return copy;
  },

  /*
  =======================================================
  POPS HR PICK FIELD HELPERS
  =======================================================
  */

  getPlayerName(player = {}) {
    if (
      typeof player.player === "string"
    ) {
      return this.text(
        player.player,
        "Unknown Player"
      );
    }

    return this.text(
      player.name ||
      player.playerName ||
      player.batterName ||
      player.fullName ||
      player.player?.fullName,
      "Unknown Player"
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

  getPlayerId(player = {}) {
    const directId =
      player.id ||
      player.playerId ||
      player.batterId ||
      player.personId ||
      player.player?.id;

    if (directId) {
      return this.text(directId);
    }

    return (
      `${this.getPlayerName(player)}-${this.getTeam(player)}`
        .toLowerCase()
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

  getGame(player = {}) {
    return this.text(
      player.game ||
      player.matchup ||
      player.gameName,
      "Game TBD"
    );
  },

  getGameTime(player = {}) {
    return this.text(
      player.gameTime ||
      player.dateTime ||
      player.startTime,
      ""
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
    const gameId = this.text(
      player.gamePk ||
      player.gameId ||
      player.gameID ||
      player.game?.gamePk
    );

    if (gameId) {
      return gameId;
    }

    const game =
      this.getGame(player);

    if (game !== "Game TBD") {
      return game.toLowerCase();
    }

    return this.getTeam(player)
      .toLowerCase();
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

  getISOValue(player = {}) {
    return this.num(
      player.iso ??
      player.ISO ??
      player.hitting?.iso ??
      player.stats?.iso ??
      player.recentForm?.iso ??
      player.isoLast10,
      0
    );
  },

  getISO(player = {}) {
    const iso =
      this.getISOValue(player);

    return iso > 0
      ? iso.toFixed(3)
      : "";
  },

  getBvpHomeRuns(player = {}) {
    return this.num(
      player.bvpHR ??
      player.bvpHomeRuns ??
      player.homeRunsVsPitcher ??
      player.vsPitcherHR ??
      player.bvpStats?.homeRuns ??
      player.bvp?.homeRuns,
      0
    );
  },

  getHitStreak(player = {}) {
    return this.num(
      player.hitStreak ??
      player.streak ??
      player.currentHitStreak,
      0
    );
  },

  getHrLast10(player = {}) {
    return this.num(
      player.hrLast10 ??
      player.recentForm?.homeRuns,
      0
    );
  },

  getBarrelRate(player = {}) {
    return this.num(
      player.barrelRate ??
      player.statcast?.barrelRate ??
      player.statcast?.barrelPct,
      0
    );
  },

  getHardHitRate(player = {}) {
    return this.num(
      player.hardHitRate ??
      player.statcast?.hardHitRate ??
      player.statcast?.hardHitPct,
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

    return (
      this.getLineupSpot(player) > 0
    );
  },

  /*
  =======================================================
  PLAYER LABELS
  =======================================================
  */

  getTier(score = 0) {
    if (score >= 90) {
      return "Elite";
    }

    if (score >= 84) {
      return "Excellent";
    }

    if (score >= 78) {
      return "Very Strong";
    }

    if (score >= 72) {
      return "Strong";
    }

    return "POPS HR Pick";
  },

  ordinalSuffix(number) {
    const value =
      Number(number);

    if (
      value % 100 >= 11 &&
      value % 100 <= 13
    ) {
      return "th";
    }

    if (value % 10 === 1) {
      return "st";
    }

    if (value % 10 === 2) {
      return "nd";
    }

    if (value % 10 === 3) {
      return "rd";
    }

    return "th";
  },

  getReasons(player = {}) {
    const reasons = [];

    const score =
      this.getScore(player);

    const bvpHR =
      this.getBvpHomeRuns(player);

    const hrLast10 =
      this.getHrLast10(player);

    const iso =
      this.getISOValue(player);

    const barrelRate =
      this.getBarrelRate(player);

    const hardHitRate =
      this.getHardHitRate(player);

    const hitStreak =
      this.getHitStreak(player);

    const lineupSpot =
      this.getLineupSpot(player);

    if (score >= 90) {
      reasons.push(
        "Elite POPS HR score"
      );
    } else if (score >= 84) {
      reasons.push(
        "Excellent POPS HR score"
      );
    } else if (score >= 78) {
      reasons.push(
        "Strong POPS HR score"
      );
    } else {
      reasons.push(
        "Ranked POPS HR pick"
      );
    }

    if (bvpHR >= 2) {
      reasons.push(
        `${bvpHR} previous HR vs pitcher`
      );
    } else if (bvpHR === 1) {
      reasons.push(
        "Previous HR vs pitcher"
      );
    }

    if (hrLast10 > 0) {
      reasons.push(
        `${hrLast10} HR in last 10 games`
      );
    }

    if (iso >= 0.250) {
      reasons.push(
        "Elite ISO power"
      );
    } else if (iso >= 0.200) {
      reasons.push(
        "Strong ISO power"
      );
    }

    if (barrelRate >= 12) {
      reasons.push(
        "Strong barrel rate"
      );
    }

    if (hardHitRate >= 45) {
      reasons.push(
        "Strong hard-hit rate"
      );
    }

    if (
      lineupSpot >= 1 &&
      lineupSpot <= 4
    ) {
      reasons.push(
        `Batting ${lineupSpot}${this.ordinalSuffix(lineupSpot)}`
      );
    }

    if (hitStreak >= 5) {
      reasons.push(
        `${hitStreak}-game hit streak`
      );
    }

    if (this.isConfirmed(player)) {
      reasons.push(
        "Confirmed lineup"
      );
    }

    return reasons.slice(0, 3);
  },

  /*
  =======================================================
  NORMALIZE POPS HR PICKS
  =======================================================
  */

  normalizePlayers(hrPicks = []) {
    if (!Array.isArray(hrPicks)) {
      return [];
    }

    const rankedPicks =
      [...hrPicks]
        .filter(Boolean)
        .sort(
          (a, b) =>
            this.getScore(b) -
            this.getScore(a)
        )
        .slice(
          0,
          this.settings.maximumPlayerPool
        );

    const normalized =
      rankedPicks.map(player => ({
        ...player,

        _parlayName:
          this.getPlayerName(player),

        _parlayId:
          this.getPlayerId(player),

        _parlayScore:
          this.getScore(player),

        _parlayTeam:
          this.getTeam(player),

        _parlayGame:
          this.getGame(player),

        _parlayGameTime:
          this.getGameTime(player),

        _parlayPitcher:
          this.getPitcher(player),

        _parlayGameKey:
          this.getGameKey(player),

        _parlayConfirmed:
          this.isConfirmed(player)
      }));

    return this.uniqueBy(
      normalized,
      player => player._parlayId
    ).sort(
      (a, b) =>
        b._parlayScore -
        a._parlayScore
    );
  },

  filterConfirmed(players = []) {
    if (
      !this.settings
        .requireConfirmedLineup
    ) {
      return players;
    }

    return players.filter(
      player =>
        player._parlayConfirmed
    );
  },

  /*
  =======================================================
  COMBINATION GENERATOR
  =======================================================
  */

  canAddPlayer(
    player,
    selected = [],
    options = {}
  ) {
    const {
      uniqueGames = true,
      uniqueTeams = true
    } = options;

    const alreadyUsed =
      selected.some(
        selectedPlayer =>
          selectedPlayer._parlayId ===
          player._parlayId
      );

    if (alreadyUsed) {
      return false;
    }

    if (uniqueGames) {
      const gameUsed =
        selected.some(
          selectedPlayer =>
            selectedPlayer._parlayGameKey ===
            player._parlayGameKey
        );

      if (gameUsed) {
        return false;
      }
    }

    if (uniqueTeams) {
      const teamUsed =
        selected.some(
          selectedPlayer =>
            selectedPlayer._parlayTeam ===
            player._parlayTeam
        );

      if (teamUsed) {
        return false;
      }
    }

    return true;
  },

  createCombination(
    players = [],
    legCount = 2,
    options = {}
  ) {
    const {
      minimumScore = 0,
      uniqueGames = true,
      uniqueTeams = true,
      randomize = false,
      excludedPlayerIds = []
    } = options;

    let pool =
      players.filter(
        player =>
          player._parlayScore >=
            minimumScore &&
          !excludedPlayerIds.includes(
            player._parlayId
          )
      );

    if (randomize) {
      pool = this.shuffle(pool);
    }

    const selected = [];

    for (const player of pool) {
      if (
        this.canAddPlayer(
          player,
          selected,
          {
            uniqueGames,
            uniqueTeams
          }
        )
      ) {
        selected.push(player);
      }

      if (
        selected.length ===
        legCount
      ) {
        return selected;
      }
    }

    for (const player of pool) {
      if (
        this.canAddPlayer(
          player,
          selected,
          {
            uniqueGames,
            uniqueTeams: false
          }
        )
      ) {
        selected.push(player);
      }

      if (
        selected.length ===
        legCount
      ) {
        return selected;
      }
    }

    for (const player of pool) {
      if (
        this.canAddPlayer(
          player,
          selected,
          {
            uniqueGames: false,
            uniqueTeams: false
          }
        )
      ) {
        selected.push(player);
      }

      if (
        selected.length ===
        legCount
      ) {
        return selected;
      }
    }

    return selected;
  },

  combinationKey(players = []) {
    return players
      .map(
        player =>
          player._parlayId
      )
      .sort()
      .join("|");
  },

  getValueScore(player = {}) {
    const score =
      player._parlayScore;

    const iso =
      this.getISOValue(player);

    const bvpHR =
      this.getBvpHomeRuns(player);

    const hrLast10 =
      this.getHrLast10(player);

    const barrelRate =
      this.getBarrelRate(player);

    const hardHitRate =
      this.getHardHitRate(player);

    return (
      score +
      iso * 50 +
      bvpHR * 4 +
      hrLast10 * 2 +
      barrelRate * 0.15 +
      hardHitRate * 0.05
    );
  },

  /*
  =======================================================
  BUILD PARLAYS
  =======================================================
  */

  build(hrPicks = []) {
    let sourcePicks =
      hrPicks;

    if (
      !Array.isArray(sourcePicks) ||
      !sourcePicks.length
    ) {
      sourcePicks =
        Array.isArray(window.hrPicks)
          ? window.hrPicks
          : [];
    }

    let players =
      this.normalizePlayers(
        sourcePicks
      );

    players =
      this.filterConfirmed(players);

    /*
    Randomize the full player pool once per day.

    Every parlay pulls from this same shuffled pool,
    but each selected player is permanently marked used.
    */

    const randomizedPlayers =
      this.shuffle(players, 1100);

    const usedPlayerIds =
      new Set();

    /*
    Takes only players who have not already appeared
    in another parlay.
    */

    const takeUniquePlayers = (
      legCount = 2,
      minimumScore = 0
    ) => {
      const eligiblePlayers =
        randomizedPlayers.filter(
          player =>
            player._parlayScore >=
              minimumScore &&
            !usedPlayerIds.has(
              player._parlayId
            )
        );

      let selected =
        this.createCombination(
          eligiblePlayers,
          legCount,
          {
            minimumScore,
            uniqueGames: true,
            uniqueTeams: true,
            randomize: false
          }
        );

      /*
      If matchup diversity prevents the parlay
      from filling, relax team restrictions.
      */

      if (
        selected.length <
        legCount
      ) {
        selected =
          this.createCombination(
            eligiblePlayers,
            legCount,
            {
              minimumScore,
              uniqueGames: true,
              uniqueTeams: false,
              randomize: false
            }
          );
      }

      /*
      Final fallback: allow players from the same game,
      but still never reuse a player already selected
      in another parlay.
      */

      if (
        selected.length <
        legCount
      ) {
        selected =
          this.createCombination(
            eligiblePlayers,
            legCount,
            {
              minimumScore,
              uniqueGames: false,
              uniqueTeams: false,
              randomize: false
            }
          );
      }

      selected.forEach(player => {
        usedPlayerIds.add(
          player._parlayId
        );
      });

      return selected;
    };

    const safe =
      takeUniquePlayers(
        this.settings.safeLegs,
        this.settings.safeMinimumScore
      );

    const balanced =
      takeUniquePlayers(
        this.settings.balancedLegs,
        this.settings.balancedMinimumScore
      );

    const value =
      takeUniquePlayers(
        this.settings.valueLegs,
        this.settings.valueMinimumScore
      );

    const longshot =
      takeUniquePlayers(
        this.settings.longshotLegs,
        this.settings.minimumScore
      );

    return {
      safe,
      balanced,
      value,
      longshot,

      playerCount:
        players.length,

      usedPlayerCount:
        usedPlayerIds.size
    };
  },

  /*
  =======================================================
  ADD COMPLETE PARLAY TO GAMBLY
  =======================================================
  */

  addParlayToGambly(
    parlayKey,
    button = null
  ) {
    const players =
      this.currentParlays?.[parlayKey];

    if (
      !Array.isArray(players) ||
      !players.length
    ) {
      console.warn(
        `POPS could not find the ${parlayKey} parlay.`
      );

      if (button) {
        button.textContent =
          "⚠️ Parlay unavailable";
      }

      return;
    }

    if (
      typeof Gambly === "undefined" ||
      typeof Gambly.addPick !== "function"
    ) {
      console.warn(
        "The Gambly module is unavailable."
      );

      if (button) {
        button.textContent =
          "⚠️ Gambly unavailable";
      }

      return;
    }

    let addedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    players.forEach(player => {
      const playerName =
        this.getPlayerName(player);

      const result =
        Gambly.addPick({
          playerId:
            this.getPlayerId(player),

          playerName,

          team:
            this.getTeam(player),

          market:
            "Home Run",

          selection:
            `${playerName} to hit a home run`,

          game:
            this.getGame(player),

          gamePk:
            player.gamePk ||
            player.gameId ||
            player.gameID ||
            "",

          source:
            `POPS ${parlayKey} HR Parlay`
        });

      if (result?.success) {
        addedCount += 1;
      } else if (
        result?.reason === "duplicate"
      ) {
        duplicateCount += 1;
      } else {
        failedCount += 1;
      }
    });

    if (!button) {
      return;
    }

    if (
      addedCount > 0 &&
      failedCount === 0
    ) {
      button.textContent =
        `✅ ${addedCount} Pick${
          addedCount === 1
            ? ""
            : "s"
        } Added`;

      button.classList.add(
        "gambly-added"
      );

      return;
    }

    if (
      addedCount === 0 &&
      duplicateCount ===
        players.length
    ) {
      button.textContent =
        "✅ Parlay Already Added";

      button.classList.add(
        "gambly-added"
      );

      return;
    }

    if (
      addedCount > 0 ||
      duplicateCount > 0
    ) {
      button.textContent =
        `✅ ${
          addedCount +
          duplicateCount
        } of ${players.length} Added`;

      button.classList.add(
        "gambly-added"
      );

      return;
    }

    button.textContent =
      "⚠️ Could Not Add Parlay";
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

    const total =
      players.reduce(
        (sum, player) =>
          sum +
          player._parlayScore,
        0
      );

    return Math.round(
      total / players.length
    );
  },

  renderReasonTags(player = {}) {
    const reasons =
      this.getReasons(player);

    if (!reasons.length) {
      return "";
    }

    return `
      <div class="parlay-reason-list">
        ${reasons
          .map(
            reason => `
              <span class="parlay-reason">
                ✓ ${this.escapeHTML(reason)}
              </span>
            `
          )
          .join("")}
      </div>
    `;
  },

  renderPlayer(
    player = {},
    index = 0
  ) {
    const name =
      this.escapeHTML(
        player._parlayName
      );

    const team =
      this.escapeHTML(
        player._parlayTeam
      );

    const game =
      this.escapeHTML(
        player._parlayGame
      );

    const gameTime =
      this.escapeHTML(
        player._parlayGameTime
      );

    const pitcher =
      this.escapeHTML(
        player._parlayPitcher
      );

    const score =
      Math.round(
        player._parlayScore
      );

    const iso =
      this.getISO(player);

    const hrLast10 =
      this.getHrLast10(player);

    const tier =
      this.getTier(score);

    return `
      <article class="parlay-player-row">

        <div class="parlay-player-rank">
          ${index + 1}
        </div>

        <div class="parlay-player-main">

          <div class="parlay-player-top">

            <h4>
              ${name}
            </h4>

            <span class="parlay-player-score">
              ${score}
            </span>

          </div>

          <div class="parlay-player-game">
            ${
              game !== "Game TBD"
                ? game
                : team
            }
          </div>

          ${
            gameTime
              ? `
                <div class="parlay-player-detail">
                  ${gameTime}
                </div>
              `
              : ""
          }

          ${
            pitcher !== "Pitcher TBD"
              ? `
                <div class="parlay-player-detail">
                  vs ${pitcher}
                </div>
              `
              : ""
          }

          <div class="parlay-player-badges">

            <span class="parlay-badge">
              ${tier}
            </span>

            ${
              iso
                ? `
                  <span class="parlay-badge">
                    ISO ${iso}
                  </span>
                `
                : ""
            }

            ${
              hrLast10 > 0
                ? `
                  <span class="parlay-badge">
                    ${hrLast10} HR / 10
                  </span>
                `
                : ""
            }

            <span class="
              parlay-badge
              ${
                player._parlayConfirmed
                  ? "confirmed"
                  : "projected"
              }
            ">
              ${
                player._parlayConfirmed
                  ? "Confirmed"
                  : "Projected"
              }
            </span>

          </div>

          ${this.renderReasonTags(player)}

        </div>

      </article>
    `;
  },

  renderParlayCard({
    key,
    title,
    icon,
    label,
    description,
    players = [],
    requiredLegs = 2,
    className = "",
    expanded = false
  }) {
    const available =
      players.length >=
      requiredLegs;

    const average =
      this.getAverageScore(players);

    return `
      <article
        class="
          parlay-card-v2
          ${className}
          ${expanded ? "open" : ""}
          ${available ? "" : "unavailable"}
        "
        data-parlay-card="${key}"
      >

        <button
          type="button"
          class="parlay-card-toggle"
          data-parlay-toggle="${key}"
          aria-expanded="${expanded}"
        >

          <div class="parlay-card-title">

            <span class="parlay-card-icon">
              ${icon}
            </span>

            <div>

              <span class="parlay-card-label">
                ${label}
              </span>

              <h3>
                ${title}
              </h3>

            </div>

          </div>

          <div class="parlay-card-right">

            <span class="parlay-card-average">
              AVG ${average}
            </span>

            <span class="parlay-chevron">
              ⌄
            </span>

          </div>

        </button>

        <div class="parlay-card-content">

          <p class="parlay-card-description">
            ${description}
          </p>

          ${
            available
              ? `
                <div class="parlay-player-list-v2">

                  ${players
                    .map(
                      (player, index) =>
                        this.renderPlayer(
                          player,
                          index
                        )
                    )
                    .join("")}

                </div>

                <button
                  type="button"
                  class="
                    gambly-add-button
                    gambly-parlay-button
                  "
                  onclick="
                    event.stopPropagation();
                    Parlays.addParlayToGambly(
                      '${key}',
                      this
                    );
                  "
                >
                  🤖 Add Entire Parlay to Gambly
                </button>
              `
              : `
                <div class="parlay-empty-v2">
                  Not enough POPS HR picks
                  are available yet.
                </div>
              `
          }

        </div>

      </article>
    `;
  },

  /*
  =======================================================
  ACCORDION EVENTS
  =======================================================
  */

  bindAccordionEvents() {
    document
      .querySelectorAll(
        "[data-parlay-toggle]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            const key =
              button.dataset
                .parlayToggle;

            const card =
              document.querySelector(
                `[data-parlay-card="${key}"]`
              );

            if (!card) {
              return;
            }

            const isOpen =
              card.classList.contains(
                "open"
              );

            document
              .querySelectorAll(
                ".parlay-card-v2"
              )
              .forEach(otherCard => {
                otherCard.classList.remove(
                  "open"
                );

                const otherButton =
                  otherCard.querySelector(
                    ".parlay-card-toggle"
                  );

                if (otherButton) {
                  otherButton.setAttribute(
                    "aria-expanded",
                    "false"
                  );
                }
              });

            if (!isOpen) {
              card.classList.add(
                "open"
              );

              button.setAttribute(
                "aria-expanded",
                "true"
              );
            }
          }
        );
      });
  },

  /*
  =======================================================
  MAIN RENDER
  =======================================================
  */

  render(
    hrPicks = [],
    elementId = "parlayBox"
  ) {
    const box =
      document.getElementById(
        elementId
      );

    if (!box) {
      console.warn(
        `POPS Parlays: #${elementId} was not found.`
      );

      return;
    }

    const results =
      this.build(hrPicks);

    /*
    Save every generated parlay so the Gambly buttons
    know which players belong to each card.
    */

    this.currentParlays = {
      safe:
        results.safe || [],

      balanced:
        results.balanced || [],

      value:
        results.value || [],

      longshot:
        results.longshot || []
    };

    if (
      results.playerCount < 2
    ) {
      box.innerHTML = `
        <div class="parlay-waiting-v2">

          <div class="parlay-waiting-icon">
            🔥
          </div>

          <h3>
            POPS HR Parlay Builder
          </h3>

          <p>
            Waiting for the POPS Home Run
            Pickz rankings to finish loading.
          </p>

        </div>
      `;

      return;
    }

    box.innerHTML = `
      <div class="parlay-hero-v2">

        <div class="parlay-hero-copy">

          <span class="parlay-kicker-v2">
            Built From POPS HR Pickz
          </span>

          <h2>
            🔥 POPS HR Parlay Builder
          </h2>

          <p>
            Automatically generated daily
            from today's POPS Home Run Pickz.
            Every hitter is used only once.
          </p>

        </div>

        <div class="parlay-hero-ball">
          ⚾
        </div>

      </div>

      <div class="parlay-stack-v2">

        ${this.renderParlayCard({
          key: "safe",
          title: "Safer 2-Leg",
          icon: "🟢",
          label: "Top POPS Picks",
          description:
            "Two of the strongest ranked hitters from different matchups.",
          players:
            results.safe,
          requiredLegs:
            this.settings.safeLegs,
          className:
            "parlay-safe-v2",
          expanded: true
        })}

        ${this.renderParlayCard({
          key: "balanced",
          title: "Balanced 3-Leg",
          icon: "🟡",
          label: "Balanced Card",
          description:
            "Three ranked POPS HR picks with matchup diversity.",
          players:
            results.balanced,
          requiredLegs:
            this.settings.balancedLegs,
          className:
            "parlay-balanced-v2"
        })}

        ${this.renderParlayCard({
          key: "value",
          title: "Value 3-Leg",
          icon: "🟠",
          label: "Power Upside",
          description:
            "Three hitters ranked using POPS score, power and recent production.",
          players:
            results.value,
          requiredLegs:
            this.settings.valueLegs,
          className:
            "parlay-value-v2"
        })}

        ${this.renderParlayCard({
          key: "longshot",
          title: "Longshot 4-Leg",
          icon: "🔴",
          label: "High Risk",
          description:
            "Four ranked hitters combined for maximum upside.",
          players:
            results.longshot,
          requiredLegs:
            this.settings.longshotLegs,
          className:
            "parlay-longshot-v2"
        })}

      </div>

      <div class="parlay-note-v2">

        <span>⭐</span>

        <p>
          <strong>POPS Note:</strong>
          These are model-generated
          combinations and are not
          guaranteed outcomes. Confirm
          lineups before using any pick.
        </p>

      </div>
    `;

    this.bindAccordionEvents();
  }
};

/*
=========================================================
GLOBAL HELPER
=========================================================
*/

function buildHrParlays(
  hrPicks = []
) {
  Parlays.render(hrPicks);
}

/*
=========================================================
OPTIONAL AUTOMATIC UPDATE EVENT
=========================================================
*/

window.addEventListener(
  "popsHrPicksUpdated",
  event => {
    const updatedPicks =
      event.detail?.hrPicks;

    if (
      Array.isArray(updatedPicks)
    ) {
      Parlays.render(
        updatedPicks
      );
    }
  }
);

/*
=========================================================
MAKE GLOBAL
=========================================================
*/

window.Parlays =
  Parlays;

window.buildHrParlays =
  buildHrParlays;