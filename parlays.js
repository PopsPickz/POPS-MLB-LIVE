/*
=========================================================
POPS PICKZ 11.0 HR PARLAY BUILDER
File: parlays.js
=========================================================

Uses the same hrPicks array displayed in:

POPS Home Run Pickz

Required HTML:

<div id="parlayBox"></div>

Required script order:

<script src="api.js"></script>
<script src="formula.js"></script>
<script src="parlays.js"></script>
<script src="app.js"></script>

After app.js finishes calculating HR picks:

Parlays.render(hrPicks);
=========================================================
*/

const Parlays = {
  settings: {
    /*
    Use every hitter appearing in the POPS HR Pickz list.
    The ranking order determines parlay priority.
    */
    minimumScore: 0,
    safeMinimumScore: 0,
    balancedMinimumScore: 0,
    valueMinimumScore: 0,

    requireConfirmedLineup: false,

    preferDifferentGames: true,
    preferDifferentTeams: true,

    maximumPlayerPool: 20,

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

    for (
      let index = copy.length - 1;
      index > 0;
      index -= 1
    ) {
      const randomIndex =
        Math.floor(
          Math.random() * (index + 1)
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

    return `${this.getPlayerName(player)}-${this.getTeam(player)}`
      .toLowerCase();
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

  getOpponent(player = {}) {
    return this.text(
      player.opponent ||
      player.opponentName ||
      player.vs ||
      player.opposingTeam,
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
    const gamePk = this.text(
      player.gamePk ||
      player.gameId ||
      player.gameID ||
      player.game?.gamePk
    );

    if (gamePk) {
      return gamePk;
    }

    const matchup = this.getGame(player);

    if (matchup !== "Game TBD") {
      return matchup.toLowerCase();
    }

    const team = this.getTeam(player);
    const opponent = this.getOpponent(player);

    if (opponent) {
      return [team, opponent]
        .sort()
        .join("-")
        .toLowerCase();
    }

    return team.toLowerCase();
  },

  getISO(player = {}) {
    const iso = this.num(
      player.iso ??
      player.ISO ??
      player.hitting?.iso ??
      player.stats?.iso ??
      player.recentForm?.iso,
      0
    );

    return iso > 0
      ? iso.toFixed(3)
      : "";
  },

  getHRX(player = {}) {
    const hrx = this.num(
      player.hrx ??
      player.HRX ??
      player.expectedHomeRuns ??
      player.xHR,
      0
    );

    return hrx > 0
      ? hrx.toFixed(1)
      : "";
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

    return this.getLineupSpot(player) > 0;
  },

  /*
  =======================================================
  PLAYER LABELS
  =======================================================
  */

  getTier(score = 0) {
    if (score >= 92) {
      return "Elite";
    }

    if (score >= 86) {
      return "Excellent";
    }

    if (score >= 80) {
      return "Very Strong";
    }

    if (score >= 74) {
      return "Strong";
    }

    return "POPS HR Pick";
  },

  ordinalSuffix(number) {
    const value = Number(number);

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

    const lineupSpot =
      this.getLineupSpot(player);

    const bvpHR =
      this.getBvpHomeRuns(player);

    const hitStreak =
      this.getHitStreak(player);

    const hrLast10 =
      this.getHrLast10(player);

    const barrelRate =
      this.getBarrelRate(player);

    const hardHitRate =
      this.getHardHitRate(player);

    const iso = this.num(
      player.iso ??
      player.ISO ??
      player.hitting?.iso ??
      player.recentForm?.iso,
      0
    );

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

    if (hrLast10 >= 3) {
      reasons.push(
        `${hrLast10} HR in last 10 games`
      );
    } else if (hrLast10 >= 1) {
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

    /*
    Copy the array before sorting so the original
    POPS HR rankings are not accidentally changed.
    */
    const topHrPicks = [...hrPicks]
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

    const normalized = topHrPicks.map(
      player => ({
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

        _parlayOpponent:
          this.getOpponent(player),

        _parlayPitcher:
          this.getPitcher(player),

        _parlayGameKey:
          this.getGameKey(player),

        _parlayConfirmed:
          this.isConfirmed(player)
      })
    );

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
  COMBINATION HELPERS
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

    const alreadySelected =
      selected.some(
        selectedPlayer =>
          selectedPlayer._parlayId ===
          player._parlayId
      );

    if (alreadySelected) {
      return false;
    }

    if (uniqueGames) {
      const gameAlreadyUsed =
        selected.some(
          selectedPlayer =>
            selectedPlayer
              ._parlayGameKey ===
            player._parlayGameKey
        );

      if (gameAlreadyUsed) {
        return false;
      }
    }

    if (uniqueTeams) {
      const teamAlreadyUsed =
        selected.some(
          selectedPlayer =>
            selectedPlayer
              ._parlayTeam ===
            player._parlayTeam
        );

      if (teamAlreadyUsed) {
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
      minimumScore =
        this.settings.minimumScore,

      uniqueGames =
        this.settings
          .preferDifferentGames,

      uniqueTeams =
        this.settings
          .preferDifferentTeams,

      randomize = false,

      excludedPlayerIds = []
    } = options;

    let pool = players.filter(
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

    /*
    First attempt:
    different games and different teams.
    */
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
        selected.length === legCount
      ) {
        return selected;
      }
    }

    /*
    Second attempt:
    allow multiple players from one team,
    but keep different games.
    */
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
        selected.length === legCount
      ) {
        return selected;
      }
    }

    /*
    Final attempt:
    allow players from the same game.
    */
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
        selected.length === legCount
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

  /*
  =======================================================
  VALUE RANKING
  =======================================================
  */

  getValueScore(player = {}) {
    const popsScore =
      player._parlayScore;

    const iso = this.num(
      player.iso ??
      player.ISO ??
      player.hitting?.iso ??
      player.recentForm?.iso,
      0
    );

    const bvpHR =
      this.getBvpHomeRuns(player);

    const hrLast10 =
      this.getHrLast10(player);

    const barrelRate =
      this.getBarrelRate(player);

    const hardHitRate =
      this.getHardHitRate(player);

    return (
      popsScore +
      iso * 50 +
      bvpHR * 4 +
      hrLast10 * 2 +
      barrelRate * 0.15 +
      hardHitRate * 0.05
    );
  },

  /*
  =======================================================
  BUILD PARLAYS FROM POPS HR PICKS
  =======================================================
  */

  build(hrPicks = []) {
    let sourcePicks = hrPicks;

    /*
    If no array is passed directly,
    use the public HR picks array from app.js.
    */
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

    const usedCombinationKeys =
      new Set();

    /*
    Safer parlay:
    Top-ranked POPS hitters.
    */
    const safe =
      this.createCombination(
        players,
        this.settings.safeLegs,
        {
          minimumScore:
            this.settings
              .safeMinimumScore,

          uniqueGames: true,
          uniqueTeams: true
        }
      );

    if (
      safe.length ===
      this.settings.safeLegs
    ) {
      usedCombinationKeys.add(
        this.combinationKey(safe)
      );
    }

    /*
    Balanced parlay:
    Avoid using the first safe pick
    when enough alternatives exist.
    */
    let balanced =
      this.createCombination(
        players,
        this.settings.balancedLegs,
        {
          minimumScore:
            this.settings
              .balancedMinimumScore,

          uniqueGames: true,
          uniqueTeams: true,

          excludedPlayerIds:
            players.length >
            this.settings.balancedLegs
              ? safe
                  .slice(0, 1)
                  .map(
                    player =>
                      player._parlayId
                  )
              : []
        }
      );

    if (
      balanced.length !==
      this.settings.balancedLegs
    ) {
      balanced =
        this.createCombination(
          players,
          this.settings.balancedLegs,
          {
            minimumScore:
              this.settings
                .balancedMinimumScore,

            uniqueGames: true,
            uniqueTeams: true
          }
        );
    }

    if (
      balanced.length ===
      this.settings.balancedLegs
    ) {
      usedCombinationKeys.add(
        this.combinationKey(
          balanced
        )
      );
    }

    /*
    Value parlay:
    Uses POPS score plus ISO, BvP,
    recent HRs and contact quality.
    */
    const valuePool = [...players]
      .sort(
        (a, b) =>
          this.getValueScore(b) -
          this.getValueScore(a)
      );

    let value =
      this.createCombination(
        valuePool,
        this.settings.valueLegs,
        {
          minimumScore:
            this.settings
              .valueMinimumScore,

          uniqueGames: true,
          uniqueTeams: true
        }
      );

    if (
      usedCombinationKeys.has(
        this.combinationKey(value)
      )
    ) {
      value =
        this.createCombination(
          this.shuffle(valuePool),
          this.settings.valueLegs,
          {
            minimumScore:
              this.settings
                .valueMinimumScore,

            uniqueGames: true,
            uniqueTeams: true,
            randomize: true
          }
        );
    }

    if (
      value.length ===
      this.settings.valueLegs
    ) {
      usedCombinationKeys.add(
        this.combinationKey(value)
      );
    }

    /*
    Longshot parlay:
    Uses four ranked POPS hitters
    with randomized combinations.
    */
    let longshot =
      this.createCombination(
        this.shuffle(players),
        this.settings.longshotLegs,
        {
          minimumScore:
            this.settings.minimumScore,

          uniqueGames: true,
          uniqueTeams: true,
          randomize: true
        }
      );

    let attempts = 0;

    while (
      longshot.length ===
        this.settings.longshotLegs &&
      usedCombinationKeys.has(
        this.combinationKey(longshot)
      ) &&
      attempts < 10
    ) {
      longshot =
        this.createCombination(
          this.shuffle(players),
          this.settings.longshotLegs,
          {
            minimumScore:
              this.settings
                .minimumScore,

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

      playerCount:
        players.length,

      generatedAt:
        new Date()
    };
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
      (sum, player) =>
        sum +
        player._parlayScore,
      0
    );

    return Math.round(
      total / players.length
    );
  },

  renderPlayer(
    player = {},
    index = 0
  ) {
    const name = this.escapeHTML(
      player._parlayName
    );

    const team = this.escapeHTML(
      player._parlayTeam
    );

    const game = this.escapeHTML(
      player._parlayGame
    );

    const gameTime = this.escapeHTML(
      player._parlayGameTime
    );

    const pitcher = this.escapeHTML(
      player._parlayPitcher
    );

    const score = Math.round(
      player._parlayScore
    );

    const tier =
      this.getTier(score);

    const iso =
      this.getISO(player);

    const hrx =
      this.getHRX(player);

    const reasons =
      this.getReasons(player);

    const statParts = [];

    if (iso) {
      statParts.push(
        `ISO ${iso}`
      );
    }

    if (hrx) {
      statParts.push(
        `HRX ${hrx}`
      );
    }

    const statsHTML =
      statParts.length
        ? `
          <span class="parlay-player-stats">
            ${statParts.join(" • ")}
          </span>
        `
        : "";

    const gameHTML =
      game !== "Game TBD"
        ? `
          <span>
            ${game}
          </span>
        `
        : `
          <span>
            ${team}
          </span>
        `;

    const timeHTML =
      gameTime
        ? `
          <span class="parlay-game-time">
            ${gameTime}
          </span>
        `
        : "";

    const pitcherHTML =
      pitcher !== "Pitcher TBD"
        ? `
          <span class="parlay-pitcher">
            vs ${pitcher}
          </span>
        `
        : "";

    const reasonsHTML =
      reasons.length
        ? `
          <div class="parlay-reasons">
            ${reasons
              .map(
                reason => `
                  <span>
                    ✓ ${this.escapeHTML(
                      reason
                    )}
                  </span>
                `
              )
              .join("")}
          </div>
        `
        : "";

    return `
      <div class="parlay-player">
        <div class="parlay-leg-number">
          ${index + 1}
        </div>

        <div class="parlay-player-info">
          <div class="parlay-player-name-row">
            <strong class="parlay-player-name">
              ${name}
            </strong>

            <span class="parlay-score">
              ${score}
            </span>
          </div>

          <div class="parlay-player-matchup">
            ${gameHTML}
            ${timeHTML}
            ${pitcherHTML}
          </div>

          <div class="parlay-player-tags">
            <span class="parlay-tier">
              ${tier}
            </span>

            ${statsHTML}

            ${
              player._parlayConfirmed
                ? `
                  <span class="parlay-confirmed">
                    Confirmed
                  </span>
                `
                : `
                  <span class="parlay-projected">
                    Projected
                  </span>
                `
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
    if (
      players.length <
      requiredLegs
    ) {
      return `
        <article
          class="
            parlay-card
            ${className}
            parlay-unavailable
          "
        >
          <div class="parlay-card-header">
            <div>
              <span class="parlay-label">
                ${label}
              </span>

              <h3>
                ${icon} ${title}
              </h3>
            </div>
          </div>

          <p class="parlay-description">
            ${description}
          </p>

          <div class="parlay-empty">
            Not enough POPS HR picks
            are available yet.
          </div>
        </article>
      `;
    }

    const averageScore =
      this.getAverageScore(players);

    return `
      <article
        class="
          parlay-card
          ${className}
        "
      >
        <div class="parlay-card-header">
          <div>
            <span class="parlay-label">
              ${label}
            </span>

            <h3>
              ${icon} ${title}
            </h3>
          </div>

          <div class="parlay-average">
            <span>AVG</span>

            <strong>
              ${averageScore}
            </strong>
          </div>
        </div>

        <p class="parlay-description">
          ${description}
        </p>

        <div class="parlay-player-list">
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
      </article>
    `;
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

    if (
      results.playerCount < 2
    ) {
      box.innerHTML = `
        <div class="parlay-message">
          <h3>
            🔥 POPS HR Parlay Builder
          </h3>

          <p>
            Waiting for the POPS Home Run
            Pickz rankings to load.
          </p>
        </div>
      `;

      return;
    }

    box.innerHTML = `
      <div class="parlay-builder-header">
        <div>
          <span class="parlay-builder-kicker">
            Built From POPS HR Pickz
          </span>

          <h2>
            🔥 POPS HR Parlay Builder
          </h2>

          <p>
            These combinations use the same
            ranked hitters displayed in the
            POPS Home Run Pickz section.
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
          label: "Top POPS Picks",

          description:
            "Two of the highest-ranked POPS HR picks from different matchups.",

          players:
            results.safe,

          requiredLegs:
            this.settings.safeLegs,

          className:
            "parlay-safe"
        })}

        ${this.renderCard({
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
            "parlay-balanced"
        })}

        ${this.renderCard({
          title: "Value 3-Leg",
          icon: "🟠",
          label: "Power Upside",

          description:
            "Three POPS HR picks ranked using power, recent form and BvP upside.",

          players:
            results.value,

          requiredLegs:
            this.settings.valueLegs,

          className:
            "parlay-value"
        })}

        ${this.renderCard({
          title: "Longshot 4-Leg",
          icon: "🚀",
          label: "High Risk",

          description:
            "Four hitters selected from today's ranked POPS HR Pickz.",

          players:
            results.longshot,

          requiredLegs:
            this.settings.longshotLegs,

          className:
            "parlay-longshot"
        })}
      </div>

      <div class="parlay-disclaimer">
        <strong>POPS Note:</strong>
        These are model-generated combinations,
        not guaranteed outcomes. Confirm lineups
        before using any selection.
      </div>
    `;

    const refreshButton =
      document.getElementById(
        "refreshParlaysButton"
      );

    if (refreshButton) {
      refreshButton.addEventListener(
        "click",
        () => {
          const latestPicks =
            Array.isArray(
              window.hrPicks
            )
              ? window.hrPicks
              : hrPicks;

          this.render(
            latestPicks,
            elementId
          );
        }
      );
    }
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
MAKE PARLAY BUILDER GLOBAL
=========================================================
*/

window.Parlays = Parlays;
window.buildHrParlays =
  buildHrParlays;
