/*
=========================================================
POPS PICKZ NRFI MODEL
File: nrfi.js
Version: 5.0
=========================================================

SIMPLE MODEL

This model focuses primarily on both starting pitchers:

- ERA
- WHIP
- HR/9
- K/9
- Starting pitcher confirmation
- Lineup confirmation

SCORING

Away starting pitcher: 45 points
Home starting pitcher: 45 points
Game confirmation context: 10 points

Maximum score: 100

Weather is NOT included.

REQUIRED SCRIPT ORDER

<script src="nrfi.js?v=5"></script>
<script src="app.js"></script>

app.js must call:

await NRFI.load(games);

=========================================================
*/

const NRFI = {
  box: null,

  settings: {
    eliteMinimum: 85,
    strongMinimum: 75,
    leanMinimum: 65,
    tossUpMinimum: 50,

    maximumPitcherScore: 45,
    maximumContextScore: 10,

    minimumConfirmedBatters: 7
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

  clamp(value, minimum, maximum) {
    return Math.min(
      maximum,
      Math.max(minimum, value)
    );
  },

  escapeHTML(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  formatNumber(
    value,
    places = 2,
    fallback = "N/A"
  ) {
    const number = Number(value);

    if (
      !Number.isFinite(number) ||
      number < 0
    ) {
      return fallback;
    }

    return number.toFixed(places);
  },

  normalizePitcherName(name) {
    const value = this.text(
      name,
      "TBD"
    );

    const normalized =
      value.toLowerCase();

    if (
      normalized === "tbd" ||
      normalized === "unknown" ||
      normalized === "to be determined"
    ) {
      return "TBD";
    }

    return value;
  },

  hasStarter(name, id) {
    return (
      this.normalizePitcherName(name) !==
        "TBD" &&
      this.num(id, 0) > 0
    );
  },

  getNestedValue(
    object = {},
    paths = []
  ) {
    for (const path of paths) {
      const parts =
        String(path).split(".");

      let current = object;
      let found = true;

      for (const part of parts) {
        if (
          current === null ||
          current === undefined ||
          typeof current !== "object" ||
          !(part in current)
        ) {
          found = false;
          break;
        }

        current = current[part];
      }

      if (
        found &&
        current !== null &&
        current !== undefined &&
        current !== ""
      ) {
        return current;
      }
    }

    return undefined;
  },

  getFirstNumber(
    object = {},
    paths = [],
    fallback = 0
  ) {
    const value = this.getNestedValue(
      object,
      paths
    );

    return this.num(
      value,
      fallback
    );
  },

  /*
  =======================================================
  INNINGS CONVERSION

  MLB innings are displayed like:

  100.0 = 100 innings
  100.1 = 100 innings and one out
  100.2 = 100 innings and two outs

  This helper converts those values correctly before
  calculating K/9 and HR/9.
  =======================================================
  */

  inningsToDecimal(value) {
    const textValue =
      String(value ?? "").trim();

    if (!textValue) {
      return 0;
    }

    const parts =
      textValue.split(".");

    const fullInnings =
      this.num(parts[0], 0);

    const outs =
      this.num(parts[1], 0);

    if (outs === 1) {
      return fullInnings + 1 / 3;
    }

    if (outs === 2) {
      return fullInnings + 2 / 3;
    }

    return this.num(
      value,
      0
    );
  },

  /*
  =======================================================
  PITCHER STAT HELPERS
  =======================================================
  */

  getPitcherERA(stats = {}) {
    return this.getFirstNumber(
      stats,
      [
        "era",
        "earnedRunAverage",
        "ERA",
        "season.era",
        "pitching.era"
      ],
      0
    );
  },

  getPitcherWHIP(stats = {}) {
    return this.getFirstNumber(
      stats,
      [
        "whip",
        "WHIP",
        "season.whip",
        "pitching.whip"
      ],
      0
    );
  },

  getPitcherInnings(stats = {}) {
    const value = this.getNestedValue(
      stats,
      [
        "inningsPitched",
        "innings",
        "ip",
        "season.inningsPitched",
        "pitching.inningsPitched"
      ]
    );

    return this.inningsToDecimal(
      value
    );
  },

  getPitcherStrikeouts(stats = {}) {
    return this.getFirstNumber(
      stats,
      [
        "strikeOuts",
        "strikeouts",
        "strikeOut",
        "so",
        "SO",
        "k",
        "season.strikeOuts",
        "season.strikeouts",
        "pitching.strikeOuts"
      ],
      0
    );
  },

  getPitcherHomeRuns(stats = {}) {
    return this.getFirstNumber(
      stats,
      [
        "homeRuns",
        "homeRunsAllowed",
        "hrAllowed",
        "hr",
        "season.homeRuns",
        "pitching.homeRuns"
      ],
      0
    );
  },

  getPitcherK9(stats = {}) {
    const directValue =
      this.getFirstNumber(
        stats,
        [
          "k9",
          "strikeoutsPer9",
          "strikeOutsPer9",
          "strikeoutsPerNine",
          "season.k9",
          "pitching.k9"
        ],
        0
      );

    if (directValue > 0) {
      return directValue;
    }

    const innings =
      this.getPitcherInnings(stats);

    const strikeouts =
      this.getPitcherStrikeouts(stats);

    if (
      innings <= 0 ||
      strikeouts <= 0
    ) {
      return 0;
    }

    return (
      strikeouts * 9
    ) / innings;
  },

  getPitcherHR9(stats = {}) {
    const directValue =
      this.getFirstNumber(
        stats,
        [
          "hr9",
          "homeRunsPer9",
          "homeRunsPerNine",
          "homeRunsPer9Inn",
          "season.hr9",
          "pitching.hr9"
        ],
        0
      );

    if (directValue > 0) {
      return directValue;
    }

    const innings =
      this.getPitcherInnings(stats);

    const homeRuns =
      this.getPitcherHomeRuns(stats);

    if (innings <= 0) {
      return 0;
    }

    return (
      homeRuns * 9
    ) / innings;
  },

  /*
  =======================================================
  LINEUP HELPERS
  =======================================================
  */

  getLineup(
    game = {},
    side = "away"
  ) {
    const lineup =
      side === "away"
        ? game.awayLineup
        : game.homeLineup;

    return Array.isArray(lineup)
      ? lineup
      : [];
  },

  isLineupConfirmed(lineup = []) {
    if (!lineup.length) {
      return false;
    }

    const confirmedCount =
      lineup.filter(
        batter =>
          batter?.confirmed === true
      ).length;

    return (
      confirmedCount >=
      this.settings.minimumConfirmedBatters
    );
  },

  /*
  =======================================================
  PITCHER SCORING
  Maximum: 45 points

  ERA: 15 points
  WHIP: 8 points
  HR/9: 12 points
  K/9: 10 points
  =======================================================
  */

  scorePitcher(
    pitcherName,
    pitcherId,
    stats = {}
  ) {
    const reasons = [];
    const warnings = [];

    const hasStarter =
      this.hasStarter(
        pitcherName,
        pitcherId
      );

    const era =
      this.getPitcherERA(stats);

    const whip =
      this.getPitcherWHIP(stats);

    const hr9 =
      this.getPitcherHR9(stats);

    const k9 =
      this.getPitcherK9(stats);

    const innings =
      this.getPitcherInnings(stats);

    const strikeouts =
      this.getPitcherStrikeouts(stats);

    const homeRuns =
      this.getPitcherHomeRuns(stats);

    if (!hasStarter) {
      return {
        score: 0,

        hasStarter: false,

        era,
        whip,
        hr9,
        k9,
        innings,
        strikeouts,
        homeRuns,

        eraPoints: 0,
        whipPoints: 0,
        hr9Points: 0,
        k9Points: 0,

        reasons: [],
        warnings: [
          "Starting pitcher is not confirmed"
        ]
      };
    }

    let eraPoints = 0;
    let whipPoints = 0;
    let hr9Points = 0;
    let k9Points = 0;

    /*
    ERA — maximum 15
    */

    if (
      era > 0 &&
      era <= 2.50
    ) {
      eraPoints = 15;

      reasons.push(
        `${pitcherName} has an elite ERA`
      );
    } else if (
      era > 0 &&
      era <= 3.00
    ) {
      eraPoints = 13;

      reasons.push(
        `${pitcherName} has an excellent ERA`
      );
    } else if (
      era > 0 &&
      era <= 3.50
    ) {
      eraPoints = 11;

      reasons.push(
        `${pitcherName} has a strong ERA`
      );
    } else if (
      era > 0 &&
      era <= 4.00
    ) {
      eraPoints = 8;
    } else if (
      era > 0 &&
      era <= 4.50
    ) {
      eraPoints = 5;
    } else if (
      era > 0 &&
      era <= 5.00
    ) {
      eraPoints = 2;
    } else if (era > 5) {
      warnings.push(
        `${pitcherName} has a high ERA`
      );
    }

    /*
    WHIP — maximum 8
    */

    if (
      whip > 0 &&
      whip <= 1.00
    ) {
      whipPoints = 8;

      reasons.push(
        `${pitcherName} allows very few baserunners`
      );
    } else if (
      whip > 0 &&
      whip <= 1.10
    ) {
      whipPoints = 7;
    } else if (
      whip > 0 &&
      whip <= 1.20
    ) {
      whipPoints = 6;
    } else if (
      whip > 0 &&
      whip <= 1.30
    ) {
      whipPoints = 4;
    } else if (
      whip > 0 &&
      whip <= 1.40
    ) {
      whipPoints = 2;
    } else if (whip > 1.40) {
      warnings.push(
        `${pitcherName} allows too many baserunners`
      );
    }

    /*
    HR/9 — maximum 12
    */

    if (
      hr9 > 0 &&
      hr9 <= 0.60
    ) {
      hr9Points = 12;

      reasons.push(
        `${pitcherName} strongly suppresses home runs`
      );
    } else if (
      hr9 > 0 &&
      hr9 <= 0.80
    ) {
      hr9Points = 10;

      reasons.push(
        `${pitcherName} has a low HR/9`
      );
    } else if (
      hr9 > 0 &&
      hr9 <= 1.00
    ) {
      hr9Points = 8;
    } else if (
      hr9 > 0 &&
      hr9 <= 1.20
    ) {
      hr9Points = 6;
    } else if (
      hr9 > 0 &&
      hr9 <= 1.40
    ) {
      hr9Points = 3;
    } else if (
      hr9 > 0 &&
      hr9 <= 1.60
    ) {
      hr9Points = 1;
    } else if (hr9 > 1.60) {
      warnings.push(
        `${pitcherName} has elevated home-run risk`
      );
    }

    /*
    K/9 — maximum 10
    */

    if (k9 >= 11) {
      k9Points = 10;

      reasons.push(
        `${pitcherName} has elite strikeout ability`
      );
    } else if (k9 >= 10) {
      k9Points = 9;

      reasons.push(
        `${pitcherName} has excellent strikeout ability`
      );
    } else if (k9 >= 9) {
      k9Points = 8;

      reasons.push(
        `${pitcherName} has a strong strikeout rate`
      );
    } else if (k9 >= 8) {
      k9Points = 6;
    } else if (k9 >= 7) {
      k9Points = 4;
    } else if (k9 >= 6) {
      k9Points = 2;
    } else if (
      k9 > 0 &&
      k9 < 6
    ) {
      warnings.push(
        `${pitcherName} has a low strikeout rate`
      );
    }

    let score =
      eraPoints +
      whipPoints +
      hr9Points +
      k9Points;

    /*
    Additional risk penalties
    */

    if (era >= 5.50) {
      score -= 5;
    } else if (era >= 5.00) {
      score -= 3;
    }

    if (whip >= 1.55) {
      score -= 5;
    } else if (whip >= 1.45) {
      score -= 3;
    }

    if (hr9 >= 1.80) {
      score -= 5;
    } else if (hr9 >= 1.60) {
      score -= 3;
    }

    if (
      k9 > 0 &&
      k9 < 5.50
    ) {
      score -= 2;
    }

    score = Math.round(
      this.clamp(
        score,
        0,
        this.settings.maximumPitcherScore
      )
    );

    return {
      score,

      hasStarter: true,

      era,
      whip,
      hr9,
      k9,
      innings,
      strikeouts,
      homeRuns,

      eraPoints,
      whipPoints,
      hr9Points,
      k9Points,

      reasons:
        [...new Set(reasons)],

      warnings:
        [...new Set(warnings)]
    };
  },

  /*
  =======================================================
  CONTEXT SCORE
  Maximum: 10 points
  =======================================================
  */

  scoreContext({
    awayPitcher,
    homePitcher,
    awayLineup,
    homeLineup,
    awayConfirmed,
    homeConfirmed
  }) {
    const reasons = [];
    const warnings = [];

    let score = 0;

    /*
    Starting pitcher confirmation: 6 points
    */

    if (
      awayPitcher.hasStarter &&
      homePitcher.hasStarter
    ) {
      score += 6;

      reasons.push(
        "Both starting pitchers are confirmed"
      );
    } else if (
      awayPitcher.hasStarter ||
      homePitcher.hasStarter
    ) {
      score += 2;

      warnings.push(
        "Only one starting pitcher is confirmed"
      );
    } else {
      warnings.push(
        "Starting pitchers are not confirmed"
      );
    }

    /*
    Lineup confirmation: 4 points
    */

    if (
      awayConfirmed &&
      homeConfirmed
    ) {
      score += 4;

      reasons.push(
        "Both starting lineups are confirmed"
      );
    } else if (
      awayConfirmed ||
      homeConfirmed
    ) {
      score += 3;
    } else if (
      awayLineup.length >= 7 &&
      homeLineup.length >= 7
    ) {
      score += 2;
    } else {
      warnings.push(
        "Lineup information is incomplete"
      );
    }

    return {
      score: this.clamp(
        score,
        0,
        this.settings.maximumContextScore
      ),

      reasons,
      warnings
    };
  },

  /*
  =======================================================
  GAME EVALUATION
  =======================================================
  */

  evaluateGame(game = {}) {
    const awayTeam = this.text(
      typeof game.awayTeam === "object"
        ? game.awayTeam?.name
        : game.awayTeam,
      "Away Team"
    );

    const homeTeam = this.text(
      typeof game.homeTeam === "object"
        ? game.homeTeam?.name
        : game.homeTeam,
      "Home Team"
    );

    const awayPitcherName =
      this.normalizePitcherName(
        game.awayPitcher
      );

    const homePitcherName =
      this.normalizePitcherName(
        game.homePitcher
      );

    const awayPitcher =
      this.scorePitcher(
        awayPitcherName,
        game.awayPitcherId,
        game.awayPitcherStats || {}
      );

    const homePitcher =
      this.scorePitcher(
        homePitcherName,
        game.homePitcherId,
        game.homePitcherStats || {}
      );

    const awayLineup =
      this.getLineup(
        game,
        "away"
      );

    const homeLineup =
      this.getLineup(
        game,
        "home"
      );

    const awayConfirmed =
      this.isLineupConfirmed(
        awayLineup
      );

    const homeConfirmed =
      this.isLineupConfirmed(
        homeLineup
      );

    const context =
      this.scoreContext({
        awayPitcher,
        homePitcher,
        awayLineup,
        homeLineup,
        awayConfirmed,
        homeConfirmed
      });

    let score =
      awayPitcher.score +
      homePitcher.score +
      context.score;

    const reasons = [
      ...awayPitcher.reasons,
      ...homePitcher.reasons,
      ...context.reasons
    ];

    const warnings = [
      ...awayPitcher.warnings,
      ...homePitcher.warnings,
      ...context.warnings
    ];

    /*
    A weak pitcher can ruin an NRFI matchup.
    */

    const weakestPitcherScore =
      Math.min(
        awayPitcher.score,
        homePitcher.score
      );

    if (weakestPitcherScore <= 12) {
      score -= 12;

      warnings.push(
        "One starting pitcher grades as a major first-inning risk"
      );
    } else if (
      weakestPitcherScore <= 18
    ) {
      score -= 7;

      warnings.push(
        "One starting pitcher grades below average"
      );
    } else if (
      weakestPitcherScore <= 22
    ) {
      score -= 3;
    }

    /*
    Bonus when both pitchers have strong numbers.
    */

    if (
      awayPitcher.score >= 38 &&
      homePitcher.score >= 38
    ) {
      score += 6;

      reasons.push(
        "Both starting pitchers have elite NRFI profiles"
      );
    } else if (
      awayPitcher.score >= 34 &&
      homePitcher.score >= 34
    ) {
      score += 4;

      reasons.push(
        "Both starting pitchers have strong NRFI profiles"
      );
    } else if (
      awayPitcher.score >= 30 &&
      homePitcher.score >= 30
    ) {
      score += 2;

      reasons.push(
        "Both starting pitchers grade above average"
      );
    }

    /*
    Missing starters should never receive a high rating.
    */

    if (
      !awayPitcher.hasStarter ||
      !homePitcher.hasStarter
    ) {
      score = Math.min(
        score,
        49
      );
    }

    score = Math.round(
      this.clamp(
        score,
        0,
        100
      )
    );

    const prediction =
      this.getPrediction(score);

    /*
    Data confidence is separate from the NRFI score.
    */

    const availableDataPoints = [
      awayPitcher.hasStarter,
      homePitcher.hasStarter,

      awayPitcher.era > 0,
      homePitcher.era > 0,

      awayPitcher.whip > 0,
      homePitcher.whip > 0,

      awayPitcher.hr9 > 0,
      homePitcher.hr9 > 0,

      awayPitcher.k9 > 0,
      homePitcher.k9 > 0,

      awayConfirmed,
      homeConfirmed
    ].filter(Boolean).length;

    const dataConfidence =
      Math.round(
        (
          availableDataPoints /
          12
        ) * 100
      );

    return {
      gamePk: this.num(
        game.gamePk ||
        game.id,
        0
      ),

      awayTeam,
      homeTeam,

      matchup:
        `${awayTeam} vs ${homeTeam}`,

      gameTime: this.text(
        game.date ||
        game.gameDate,
        ""
      ),

      venue: this.text(
        typeof game.venue === "object"
          ? game.venue?.name
          : game.venue,
        "Venue TBD"
      ),

      score,
      prediction,
      dataConfidence,

      awayPitcherName,
      homePitcherName,

      awayPitcher,
      homePitcher,

      context,

      awayConfirmed,
      homeConfirmed,

      reasons:
        [...new Set(reasons)]
          .slice(0, 8),

      warnings:
        [...new Set(warnings)]
          .slice(0, 8)
    };
  },

  /*
  =======================================================
  PREDICTION TIERS
  =======================================================
  */

  getPrediction(score = 0) {
    if (
      score >=
      this.settings.eliteMinimum
    ) {
      return {
        key: "elite",
        label: "Elite NRFI",
        icon: "🟢",
        recommendation:
          "Top NRFI candidate"
      };
    }

    if (
      score >=
      this.settings.strongMinimum
    ) {
      return {
        key: "strong",
        label: "Strong NRFI",
        icon: "✅",
        recommendation:
          "Strong NRFI lean"
      };
    }

    if (
      score >=
      this.settings.leanMinimum
    ) {
      return {
        key: "lean",
        label: "Lean NRFI",
        icon: "🟡",
        recommendation:
          "Moderate NRFI lean"
      };
    }

    if (
      score >=
      this.settings.tossUpMinimum
    ) {
      return {
        key: "tossup",
        label: "Toss-Up",
        icon: "⚪",
        recommendation:
          "No strong first-inning edge"
      };
    }

    return {
      key: "yrfi",
      label: "YRFI Alert",
      icon: "🔴",
      recommendation:
        "Elevated first-inning run risk"
    };
  },

  /*
  =======================================================
  BUILD ALL GAMES
  =======================================================
  */

  build(games = []) {
    if (!Array.isArray(games)) {
      return [];
    }

    return games
      .filter(Boolean)
      .map(game =>
        this.evaluateGame(game)
      )
      .sort(
        (a, b) =>
          b.score - a.score
      );
  },

  /*
  =======================================================
  DISPLAY HELPERS
  =======================================================
  */

  formatGameTime(value) {
    if (!value) {
      return "Time TBD";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "Time TBD";
    }

    return date.toLocaleString(
      [],
      {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }
    );
  },

  renderFactors(
    title,
    items = [],
    type = "positive"
  ) {
    if (!items.length) {
      return "";
    }

    return `
      <div class="nrfi-factors ${type}">
        <h4>
          ${this.escapeHTML(title)}
        </h4>

        ${items
          .map(item => `
            <p>
              ${
                type === "positive"
                  ? "✓"
                  : "!"
              }

              ${this.escapeHTML(item)}
            </p>
          `)
          .join("")}
      </div>
    `;
  },

  renderPitcher(
    name,
    result = {}
  ) {
    return `
      <div class="nrfi-pitcher">

        <h4>
          ${this.escapeHTML(name)}
        </h4>

        <div class="nrfi-stat-grid">

          <span>
            ERA
            <strong>
              ${this.formatNumber(
                result.era,
                2
              )}
            </strong>
          </span>

          <span>
            WHIP
            <strong>
              ${this.formatNumber(
                result.whip,
                2
              )}
            </strong>
          </span>

          <span>
            HR/9
            <strong>
              ${this.formatNumber(
                result.hr9,
                2
              )}
            </strong>
          </span>

          <span>
            K/9
            <strong>
              ${this.formatNumber(
                result.k9,
                2
              )}
            </strong>
          </span>

          <span>
            Strikeouts
            <strong>
              ${Math.round(
                result.strikeouts || 0
              )}
            </strong>
          </span>

          <span>
            HR Allowed
            <strong>
              ${Math.round(
                result.homeRuns || 0
              )}
            </strong>
          </span>

          <span>
            Pitcher Score
            <strong>
              ${Math.round(
                result.score || 0
              )}/45
            </strong>
          </span>

        </div>

        <div class="nrfi-pitcher-breakdown">

          <p>
            ERA points:
            <strong>
              ${result.eraPoints || 0}/15
            </strong>
          </p>

          <p>
            WHIP points:
            <strong>
              ${result.whipPoints || 0}/8
            </strong>
          </p>

          <p>
            HR/9 points:
            <strong>
              ${result.hr9Points || 0}/12
            </strong>
          </p>

          <p>
            K/9 points:
            <strong>
              ${result.k9Points || 0}/10
            </strong>
          </p>

        </div>

      </div>
    `;
  },

  renderGameCard(
    result = {},
    index = 0
  ) {
    const prediction =
      result.prediction || {};

    return `
      <article
        class="
          nrfi-game-card
          nrfi-${prediction.key}
        "
      >

        <div class="nrfi-card-header">

          <div>

            <span class="nrfi-rank">
              #${index + 1}
            </span>

            <h3>
              ${this.escapeHTML(
                result.matchup
              )}
            </h3>

            <p>
              ⏰ ${this.escapeHTML(
                this.formatGameTime(
                  result.gameTime
                )
              )}
            </p>

            <p>
              🏟️ ${this.escapeHTML(
                result.venue
              )}
            </p>

          </div>

          <div class="nrfi-score-box">

            <span>
              POPS NRFI
            </span>

            <strong>
              ${result.score}
            </strong>

            <small>
              /100
            </small>

          </div>

        </div>

        <div class="nrfi-prediction">

          <span class="nrfi-prediction-icon">
            ${prediction.icon || "⚪"}
          </span>

          <div>

            <strong>
              ${
                prediction.label ||
                "Toss-Up"
              }
            </strong>

            <small>
              ${
                prediction.recommendation ||
                ""
              }
            </small>

          </div>

        </div>

        <div class="nrfi-confidence-row">

          <span>
            Data confidence
          </span>

          <strong>
            ${result.dataConfidence}%
          </strong>

        </div>

        <div class="nrfi-pitcher-grid">

          ${this.renderPitcher(
            result.awayPitcherName,
            result.awayPitcher
          )}

          ${this.renderPitcher(
            result.homePitcherName,
            result.homePitcher
          )}

        </div>

        <div class="nrfi-lineup-status">

          <span>
            Away lineup:
            ${
              result.awayConfirmed
                ? "✅ Confirmed"
                : "🟡 Projected"
            }
          </span>

          <span>
            Home lineup:
            ${
              result.homeConfirmed
                ? "✅ Confirmed"
                : "🟡 Projected"
            }
          </span>

        </div>

        <details class="nrfi-breakdown">

          <summary>
            View prediction breakdown
          </summary>

          <div class="nrfi-breakdown-content">

            ${this.renderFactors(
              "NRFI Advantages",
              result.reasons,
              "positive"
            )}

            ${this.renderFactors(
              "YRFI Risk Factors",
              result.warnings,
              "warning"
            )}

            <div class="nrfi-context-score">

              <h4>
                Model scoring
              </h4>

              <p>
                Away pitcher:
                <strong>
                  ${result.awayPitcher.score}/45
                </strong>
              </p>

              <p>
                Home pitcher:
                <strong>
                  ${result.homePitcher.score}/45
                </strong>
              </p>

              <p>
                Confirmation context:
                <strong>
                  ${result.context.score}/10
                </strong>
              </p>

              <p>
                Starting pitcher weight:
                <strong>90%</strong>
              </p>

              <p>
                Weather:
                <strong>Not included</strong>
              </p>

            </div>

          </div>

        </details>

      </article>
    `;
  },

  /*
  =======================================================
  LOAD AND RENDER
  =======================================================
  */

  async load(
    games =
      window.games || []
  ) {
    this.box =
      document.getElementById(
        "nrfiBox"
      );

    if (!this.box) {
      console.warn(
        "POPS NRFI: #nrfiBox was not found."
      );

      return [];
    }

    this.box.innerHTML = `
      <div class="nrfi-loading">
        <p>
          Comparing both starting pitchers using ERA,
          WHIP, HR/9 and K/9...
        </p>
      </div>
    `;

    const sourceGames =
      Array.isArray(games)
        ? games
        : [];

    const predictions =
      this.build(sourceGames);

    window.nrfiPredictions =
      predictions;

    if (!predictions.length) {
      this.box.innerHTML = `
        <div class="pick-card">

          <h3>
            No NRFI Predictions Available
          </h3>

          <p>
            MLB games or starting-pitcher data have
            not loaded yet.
          </p>

        </div>
      `;

      return [];
    }

    const eliteCount =
      predictions.filter(
        item =>
          item.prediction.key ===
          "elite"
      ).length;

    const strongCount =
      predictions.filter(
        item =>
          item.prediction.key ===
          "strong"
      ).length;

    const leanCount =
      predictions.filter(
        item =>
          item.prediction.key ===
          "lean"
      ).length;

    const yrfiCount =
      predictions.filter(
        item =>
          item.prediction.key ===
          "yrfi"
      ).length;

    const averageConfidence =
      Math.round(
        predictions.reduce(
          (total, item) =>
            total +
            this.num(
              item.dataConfidence,
              0
            ),
          0
        ) /
        predictions.length
      );

    this.box.innerHTML = `
      <div class="nrfi-hero">

        <div
          class="
            nrfi-light
            nrfi-light-left
          "
        ></div>

        <div
          class="
            nrfi-light
            nrfi-light-right
          "
        ></div>

        <h1>
          POPS NRFI

          <span>
            PREDICTIONS
          </span>
        </h1>

      </div>

      <div class="nrfi-summary">

        <div>
          <span>
            Games Analyzed
          </span>

          <strong>
            ${predictions.length}
          </strong>
        </div>

        <div>
          <span>
            Elite NRFI
          </span>

          <strong>
            ${eliteCount}
          </strong>
        </div>

        <div>
          <span>
            Strong NRFI
          </span>

          <strong>
            ${strongCount}
          </strong>
        </div>

        <div>
          <span>
            Lean NRFI
          </span>

          <strong>
            ${leanCount}
          </strong>
        </div>

        <div>
          <span>
            YRFI Alerts
          </span>

          <strong>
            ${yrfiCount}
          </strong>
        </div>

      </div>

      <div class="nrfi-model-note">

        <strong>
          POPS NRFI Model 5.0
        </strong>

        <p>
          This simplified model gives 90% of the score
          to the two starting pitchers.
        </p>

        <p>
          Pitchers are graded using ERA, WHIP, HR/9
          and K/9. When both pitchers have strong
          numbers, the NRFI score increases.
        </p>

        <p>
          Average data confidence:
          <strong>
            ${averageConfidence}%
          </strong>
        </p>

        <p>
          Weather is not included in the NRFI score.
        </p>

      </div>

      <div class="nrfi-game-list">

        ${predictions
          .map(
            (result, index) =>
              this.renderGameCard(
                result,
                index
              )
          )
          .join("")}

      </div>
    `;

    return predictions;
  }
};

/*
=========================================================
GLOBAL ACCESS
=========================================================
*/

window.NRFI = NRFI;