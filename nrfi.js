/*

=========================================================

POPS PICKZ SIMPLE NRFI MODEL

File: nrfi.js

Version: 4.0

=========================================================

PURPOSE

Rank every MLB game using the quality of the two

scheduled starting pitchers.

MODEL WEIGHTS PER PITCHER

- ERA: 40 points

- WHIP: 25 points

- HR/9: 20 points

- K/9: 15 points

Each pitcher receives a score from 0 to 100.

The final game score is primarily the average of both

pitcher scores, with additional safeguards so one weak

pitcher cannot be hidden by one elite pitcher.

NOT USED

- Weather

- Team offense

- Team OPS

- Team batting average

- Top-order danger

- Recent batter form

- First-inning splits

- Season-stat fallback labels

- Data-confidence percentage

REQUIRED HTML

<div id="nrfiBox">

  <p>Loading NRFI predictions...</p>

</div>

REQUIRED SCRIPT ORDER

<script src="nrfi.js?v=4"></script>

<script src="app.js"></script>

CALL FROM app.js

await NRFI.load(games);

=========================================================

*/

const NRFI = {

  box: null,

  settings: {

    eliteMinimum: 85,

    strongMinimum: 75,

    leanMinimum: 65,

    tossUpMinimum: 52,

    minimumStarterInnings: 5,

    weights: {

      era: 40,

      whip: 25,

      hr9: 20,

      k9: 15

    }

  },

  /*

  =======================================================

  GENERAL HELPERS

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

      const pieces =

        String(path).split(".");

      let current = object;

      let found = true;

      for (const piece of pieces) {

        if (

          current === null ||

          current === undefined ||

          typeof current !== "object" ||

          !(piece in current)

        ) {

          found = false;

          break;

        }

        current = current[piece];

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

  getFirstAvailableNumber(

    object = {},

    paths = [],

    fallback = 0

  ) {

    return this.num(

      this.getNestedValue(

        object,

        paths

      ),

      fallback

    );

  },

  /*

  =======================================================

  PITCHER STAT HELPERS

  =======================================================

  */

  getPitcherERA(stats = {}) {

    return this.getFirstAvailableNumber(

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

    return this.getFirstAvailableNumber(

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

    return this.getFirstAvailableNumber(

      stats,

      [

        "inningsPitched",

        "innings",

        "ip",

        "season.inningsPitched",

        "pitching.inningsPitched"

      ],

      0

    );

  },

  getPitcherHomeRuns(stats = {}) {

    return this.getFirstAvailableNumber(

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

  getPitcherStrikeouts(stats = {}) {

    return this.getFirstAvailableNumber(

      stats,

      [

        "strikeOuts",

        "strikeouts",

        "so",

        "k",

        "season.strikeOuts",

        "season.strikeouts",

        "pitching.strikeOuts",

        "pitching.strikeouts"

      ],

      0

    );

  },

  getPitcherHR9(stats = {}) {

    const directValue =

      this.getFirstAvailableNumber(

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

  getPitcherK9(stats = {}) {

    const directValue =

      this.getFirstAvailableNumber(

        stats,

        [

          "k9",

          "strikeoutsPer9",

          "strikeOutsPer9",

          "strikeoutsPerNine",

          "strikeOutsPer9Inn",

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

    if (innings <= 0) {

      return 0;

    }

    return (

      strikeouts * 9

    ) / innings;

  },

  /*

  =======================================================

  INDIVIDUAL STAT SCORES

  =======================================================

  */

  scoreERA(era) {

    if (era <= 0) return 0;

    if (era <= 2.25) return 40;

    if (era <= 2.75) return 37;

    if (era <= 3.15) return 34;

    if (era <= 3.50) return 30;

    if (era <= 3.85) return 26;

    if (era <= 4.20) return 21;

    if (era <= 4.60) return 15;

    if (era <= 5.00) return 9;

    if (era <= 5.50) return 4;

    return 0;

  },

  scoreWHIP(whip) {

    if (whip <= 0) return 0;

    if (whip <= 0.95) return 25;

    if (whip <= 1.05) return 23;

    if (whip <= 1.15) return 21;

    if (whip <= 1.25) return 18;

    if (whip <= 1.32) return 15;

    if (whip <= 1.40) return 11;

    if (whip <= 1.48) return 7;

    if (whip <= 1.58) return 3;

    return 0;

  },

  scoreHR9(hr9) {

    if (hr9 < 0) return 0;

    if (hr9 <= 0.60) return 20;

    if (hr9 <= 0.80) return 18;

    if (hr9 <= 1.00) return 16;

    if (hr9 <= 1.15) return 13;

    if (hr9 <= 1.30) return 10;

    if (hr9 <= 1.50) return 6;

    if (hr9 <= 1.75) return 3;

    return 0;

  },

  scoreK9(k9) {

    if (k9 <= 0) return 0;

    if (k9 >= 11.00) return 15;

    if (k9 >= 10.00) return 14;

    if (k9 >= 9.00) return 12;

    if (k9 >= 8.00) return 10;

    if (k9 >= 7.00) return 7;

    if (k9 >= 6.00) return 4;

    if (k9 >= 5.00) return 2;

    return 0;

  },

  /*

  =======================================================

  PITCHER EVALUATION

  =======================================================

  */

  evaluatePitcher(

    pitcherName,

    pitcherId,

    stats = {}

  ) {

    const name =

      this.normalizePitcherName(

        pitcherName

      );

    const hasStarter =

      this.hasStarter(

        name,

        pitcherId

      );

    const era =

      this.getPitcherERA(stats);

    const whip =

      this.getPitcherWHIP(stats);

    const innings =

      this.getPitcherInnings(stats);

    const homeRuns =

      this.getPitcherHomeRuns(stats);

    const strikeouts =

      this.getPitcherStrikeouts(stats);

    const hr9 =

      this.getPitcherHR9(stats);

    const k9 =

      this.getPitcherK9(stats);

    const eraScore =

      this.scoreERA(era);

    const whipScore =

      this.scoreWHIP(whip);

    const hr9Score =

      this.scoreHR9(hr9);

    const k9Score =

      this.scoreK9(k9);

    const reasons = [];

    const warnings = [];

    if (!hasStarter) {

      warnings.push(

        "Starting pitcher is not confirmed"

      );

    }

    if (era > 0 && era <= 3.50) {

      reasons.push(

        `${name} has a strong ERA`

      );

    }

    if (era >= 4.75) {

      warnings.push(

        `${name} has an elevated ERA`

      );

    }

    if (whip > 0 && whip <= 1.20) {

      reasons.push(

        `${name} limits baserunners`

      );

    }

    if (whip >= 1.45) {

      warnings.push(

        `${name} allows too many baserunners`

      );

    }

    if (hr9 >= 0 && hr9 <= 1.00) {

      reasons.push(

        `${name} limits home runs`

      );

    }

    if (hr9 >= 1.55) {

      warnings.push(

        `${name} has elevated home-run risk`

      );

    }

    if (k9 >= 9) {

      reasons.push(

        `${name} has strong strikeout ability`

      );

    }

    if (k9 > 0 && k9 < 6) {

      warnings.push(

        `${name} has a low strikeout rate`

      );

    }

    if (

      innings > 0 &&

      innings <

        this.settings.minimumStarterInnings

    ) {

      warnings.push(

        `${name} has a limited season sample`

      );

    }

    let score =

      eraScore +

      whipScore +

      hr9Score +

      k9Score;

    /*

    A starter must be confirmed to receive a usable

    NRFI pitcher score.

    */

    if (!hasStarter) {

      score = 0;

    }

    /*

    Major individual-pitcher penalties.

    */

    if (era >= 6) {

      score -= 12;

    } else if (era >= 5.25) {

      score -= 7;

    } else if (era >= 4.75) {

      score -= 3;

    }

    if (whip >= 1.65) {

      score -= 10;

    } else if (whip >= 1.50) {

      score -= 5;

    }

    if (hr9 >= 2) {

      score -= 8;

    } else if (hr9 >= 1.70) {

      score -= 4;

    }

    score = Math.round(

      this.clamp(

        score,

        0,

        100

      )

    );

    return {

      name,

      id: this.num(pitcherId, 0),

      hasStarter,

      era,

      whip,

      innings,

      homeRuns,

      strikeouts,

      hr9,

      k9,

      eraScore,

      whipScore,

      hr9Score,

      k9Score,

      score,

      reasons:

        [...new Set(reasons)],

      warnings:

        [...new Set(warnings)]

    };

  },

  /*

  =======================================================

  GAME EVALUATION

  =======================================================

  */

  evaluateGame(game = {}) {

    const awayTeam =

      this.text(

        typeof game.awayTeam ===

          "object"

          ? game.awayTeam?.name

          : game.awayTeam,

        "Away Team"

      );

    const homeTeam =

      this.text(

        typeof game.homeTeam ===

          "object"

          ? game.homeTeam?.name

          : game.homeTeam,

        "Home Team"

      );

    const awayPitcher =

      this.evaluatePitcher(

        game.awayPitcher,

        game.awayPitcherId,

        game.awayPitcherStats || {}

      );

    const homePitcher =

      this.evaluatePitcher(

        game.homePitcher,

        game.homePitcherId,

        game.homePitcherStats || {}

      );

    const averagePitcherScore =

      (

        awayPitcher.score +

        homePitcher.score

      ) / 2;

    const weakestPitcherScore =

      Math.min(

        awayPitcher.score,

        homePitcher.score

      );

    const strongestPitcherScore =

      Math.max(

        awayPitcher.score,

        homePitcher.score

      );

    let score =

      averagePitcherScore;

    const reasons = [

      ...awayPitcher.reasons,

      ...homePitcher.reasons

    ];

    const warnings = [

      ...awayPitcher.warnings,

      ...homePitcher.warnings

    ];

    /*

    =====================================================

    BOTH-PITCHER BONUSES

    =====================================================

    */

    if (

      awayPitcher.score >= 88 &&

      homePitcher.score >= 88

    ) {

      score += 7;

      reasons.push(

        "Both starting pitchers have elite NRFI profiles"

      );

    } else if (

      awayPitcher.score >= 80 &&

      homePitcher.score >= 80

    ) {

      score += 5;

      reasons.push(

        "Both starting pitchers have strong NRFI profiles"

      );

    } else if (

      awayPitcher.score >= 72 &&

      homePitcher.score >= 72

    ) {

      score += 3;

      reasons.push(

        "Both starting pitchers have solid NRFI profiles"

      );

    }

    if (

      awayPitcher.era <= 3.50 &&

      homePitcher.era <= 3.50 &&

      awayPitcher.era > 0 &&

      homePitcher.era > 0

    ) {

      score += 2;

      reasons.push(

        "Both starters have strong ERAs"

      );

    }

    if (

      awayPitcher.k9 >= 8.5 &&

      homePitcher.k9 >= 8.5

    ) {

      score += 2;

      reasons.push(

        "Both starters have strong strikeout rates"

      );

    }

    if (

      awayPitcher.hr9 <= 1.10 &&

      homePitcher.hr9 <= 1.10 &&

      awayPitcher.hr9 >= 0 &&

      homePitcher.hr9 >= 0

    ) {

      score += 2;

      reasons.push(

        "Both starters limit home runs"

      );

    }

    /*

    =====================================================

    WEAKEST-PITCHER SAFEGUARDS

    =====================================================

    NRFI requires both pitchers to survive the first

    inning. One poor starter must lower the game score.

    */

    if (weakestPitcherScore < 35) {

      score -= 25;

      warnings.push(

        "One starting pitcher has a very poor NRFI profile"

      );

    } else if (

      weakestPitcherScore < 50

    ) {

      score -= 16;

      warnings.push(

        "One starting pitcher has a weak NRFI profile"

      );

    } else if (

      weakestPitcherScore < 60

    ) {

      score -= 9;

      warnings.push(

        "One starting pitcher grades below average"

      );

    } else if (

      weakestPitcherScore < 68

    ) {

      score -= 4;

    }

    /*

    Prevent one elite pitcher from hiding one weak

    pitcher.

    */

    const pitcherGap =

      strongestPitcherScore -

      weakestPitcherScore;

    if (pitcherGap >= 35) {

      score -= 8;

      warnings.push(

        "There is a large quality gap between the starters"

      );

    } else if (

      pitcherGap >= 25

    ) {

      score -= 4;

    }

    /*

    Missing starters.

    */

    if (

      !awayPitcher.hasStarter ||

      !homePitcher.hasStarter

    ) {

      score = Math.min(

        score,

        35

      );

      warnings.push(

        "Both starting pitchers must be confirmed"

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

      gameTime:

        this.text(

          game.date ||

          game.gameDate,

          ""

        ),

      venue:

        this.text(

          typeof game.venue ===

            "object"

            ? game.venue?.name

            : game.venue,

          "Venue TBD"

        ),

      score,

      prediction,

      averagePitcherScore:

        Math.round(

          averagePitcherScore

        ),

      weakestPitcherScore,

      strongestPitcherScore,

      awayPitcher,

      homePitcher,

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

          "Both starters grade as elite"

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

          "Strong two-pitcher matchup"

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

          "Solid pitching-based NRFI lean"

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

          "Pitcher numbers do not create a clear edge"

      };

    }

    return {

      key: "yrfi",

      label: "YRFI Alert",

      icon: "🔴",

      recommendation:

        "At least one starter carries elevated risk"

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

  renderPitcher(

    pitcher = {}

  ) {

    return `

      <div class="nrfi-pitcher">

        <h4>

          ${this.escapeHTML(

            pitcher.name ||

            "Pitcher TBD"

          )}

        </h4>

        <div class="nrfi-stat-grid">

          <span>

            ERA

            <strong>

              ${this.formatNumber(

                pitcher.era,

                2

              )}

            </strong>

          </span>

          <span>

            WHIP

            <strong>

              ${this.formatNumber(

                pitcher.whip,

                2

              )}

            </strong>

          </span>

          <span>

            HR/9

            <strong>

              ${this.formatNumber(

                pitcher.hr9,

                2

              )}

            </strong>

          </span>

          <span>

            K/9

            <strong>

              ${this.formatNumber(

                pitcher.k9,

                2

              )}

            </strong>

          </span>

          <span>

            Strikeouts

            <strong>

              ${Math.round(

                pitcher.strikeouts || 0

              )}

            </strong>

          </span>

          <span>

            Innings

            <strong>

              ${this.formatNumber(

                pitcher.innings,

                1

              )}

            </strong>

          </span>

          <span>

            Pitcher Score

            <strong>

              ${Math.round(

                pitcher.score || 0

              )}/100

            </strong>

          </span>

        </div>

        <div class="nrfi-pitcher-score-breakdown">

          <p>

            ERA:

            <strong>

              ${pitcher.eraScore || 0}/40

            </strong>

          </p>

          <p>

            WHIP:

            <strong>

              ${pitcher.whipScore || 0}/25

            </strong>

          </p>

          <p>

            HR/9:

            <strong>

              ${pitcher.hr9Score || 0}/20

            </strong>

          </p>

          <p>

            K/9:

            <strong>

              ${pitcher.k9Score || 0}/15

            </strong>

          </p>

        </div>

      </div>

    `;

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

        <div class="nrfi-pitcher-grid">

          ${this.renderPitcher(

            result.awayPitcher

          )}

          ${this.renderPitcher(

            result.homePitcher

          )}

        </div>

        <div class="nrfi-lineup-status">

          <span>

            Away starter:

            ${

              result.awayPitcher

                ?.hasStarter

                ? "✅ Confirmed"

                : "⚠️ TBD"

            }

          </span>

          <span>

            Home starter:

            ${

              result.homePitcher

                ?.hasStarter

                ? "✅ Confirmed"

                : "⚠️ TBD"

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

                Simple NRFI Model

              </h4>

              <p>

                Combined Pitcher Average:

                <strong>

                  ${result.averagePitcherScore}/100

                </strong>

              </p>

              <p>

                Weakest Pitcher Score:

                <strong>

                  ${Math.round(

                    result.weakestPitcherScore ||

                    0

                  )}/100

                </strong>

              </p>

              <p>

                ERA Weight:

                <strong>40%</strong>

              </p>

              <p>

                WHIP Weight:

                <strong>25%</strong>

              </p>

              <p>

                HR/9 Weight:

                <strong>20%</strong>

              </p>

              <p>

                K/9 Weight:

                <strong>15%</strong>

              </p>

              <p>

                Team offense:

                <strong>Not included</strong>

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

    games = window.games || []

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

          Comparing starting-pitcher ERA,

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

            MLB games or starting-pitcher

            statistics have not loaded yet.

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

          POPS Simple NRFI Model 4.0

        </strong>

        <p>

          Every game is ranked using both

          starting pitchers.

        </p>

        <p>

          ERA 40% • WHIP 25% • HR/9 20% •

          K/9 15%

        </p>

        <p>

          Both pitchers must have strong numbers

          for a game to receive a high NRFI score.

        </p>

        <p>

          Team offense, batter statistics and

          weather are not included.

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
