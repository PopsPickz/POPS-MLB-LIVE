/*
=========================================================
POPS PICKZ NRFI MODEL
File: nrfi.js
Version: 1.0
=========================================================

PURPOSE

Automatically evaluates every MLB game loaded by app.js
and predicts:

- Elite NRFI
- Strong NRFI
- Lean NRFI
- Toss-Up
- YRFI Alert

IMPORTANT

This first version uses the data already available on your
site:

- Starting pitcher ERA
- Starting pitcher WHIP
- Starting pitcher HR/9
- Pitcher strikeouts and walks when available
- Team AVG
- Team OPS
- Team runs
- Confirmed or projected lineups
- Top-of-order batter power
- Starting-pitcher availability

True first-inning splits can be added later when those
statistics are available from your data source.

REQUIRED HTML

<div id="nrfiBox">
  <p>Loading NRFI predictions...</p>
</div>

REQUIRED SCRIPT ORDER

<script src="nrfi.js"></script>
<script src="app.js"></script>

CALL FROM app.js

await NRFI.load(games);

=========================================================
*/

const NRFI = {
  box: null,

  settings: {
    eliteMinimum: 90,
    strongMinimum: 80,
    leanMinimum: 70,
    tossUpMinimum: 55,

    requireBothStarters: true,
    maximumTopOrderBatters: 4
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

    if (!Number.isFinite(number)) {
      return fallback;
    }

    return number.toFixed(places);
  },

  normalizePitcherName(name) {
    const value = this.text(
      name,
      "TBD"
    );

    if (
      value.toLowerCase() === "unknown" ||
      value.toLowerCase() === "tbd"
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

  /*
  =======================================================
  PITCHER STAT HELPERS
  =======================================================
  */

  getPitcherERA(stats = {}) {
    return this.num(
      stats.era ??
      stats.earnedRunAverage ??
      stats.ERA,
      0
    );
  },

  getPitcherWHIP(stats = {}) {
    return this.num(
      stats.whip ??
      stats.WHIP,
      0
    );
  },

  getPitcherInnings(stats = {}) {
    return this.num(
      stats.inningsPitched ??
      stats.innings ??
      stats.ip,
      0
    );
  },

  getPitcherHomeRuns(stats = {}) {
    return this.num(
      stats.homeRuns ??
      stats.homeRunsAllowed ??
      stats.hrAllowed ??
      stats.hr,
      0
    );
  },

  getPitcherHR9(stats = {}) {
    const directValue = this.num(
      stats.hr9 ??
      stats.homeRunsPer9 ??
      stats.homeRunsPerNine,
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

  getPitcherStrikeouts(stats = {}) {
    return this.num(
      stats.strikeOuts ??
      stats.strikeouts ??
      stats.so ??
      stats.k,
      0
    );
  },

  getPitcherWalks(stats = {}) {
    return this.num(
      stats.baseOnBalls ??
      stats.walks ??
      stats.bb,
      0
    );
  },

  getPitcherKBB(stats = {}) {
    const strikeouts =
      this.getPitcherStrikeouts(stats);

    const walks =
      this.getPitcherWalks(stats);

    if (walks <= 0) {
      return strikeouts > 0
        ? strikeouts
        : 0;
    }

    return strikeouts / walks;
  },

  /*
  =======================================================
  TEAM OFFENSE HELPERS
  =======================================================
  */
  
getTeamHittingStats(stats = {}) {
  if (
    stats.hitting &&
    typeof stats.hitting === "object"
  ) {
    return stats.hitting;
  }

  return stats;
},
  
  getTeamAverage(stats = {}) {
  const hitting =
    this.getTeamHittingStats(stats);

  return this.num(
    hitting.avg ??
    hitting.battingAverage ??
    hitting.average,
    0
  );
},

  getTeamOPS(stats = {}) {
  const hitting =
    this.getTeamHittingStats(stats);

  return this.num(
    hitting.ops ??
    hitting.OPS,
    0
  );
},

  getTeamRuns(stats = {}) {
  const hitting =
    this.getTeamHittingStats(stats);

  return this.num(
    hitting.runs ??
    hitting.r ??
    hitting.runsScored,
    0
  );
},

  getTeamGamesPlayed(stats = {}) {
  const hitting =
    this.getTeamHittingStats(stats);

  return this.num(
    hitting.gamesPlayed ??
    hitting.games ??
    hitting.g,
    0
  );
},

  getTeamRunsPerGame(stats = {}) {
  const hitting =
    this.getTeamHittingStats(stats);

  const directValue = this.num(
    hitting.runsPerGame ??
    hitting.rpg,
    0
  );

  if (directValue > 0) {
    return directValue;
  }

  const gamesPlayed =
    this.getTeamGamesPlayed(stats);

  const runs =
    this.getTeamRuns(stats);

  if (gamesPlayed <= 0) {
    return 0;
  }

  return runs / gamesPlayed;
},
  /*
  =======================================================
  LINEUP HELPERS
  =======================================================
  */

  getLineup(game = {}, side = "away") {
    const lineup =
      side === "away"
        ? game.awayLineup
        : game.homeLineup;

    return Array.isArray(lineup)
      ? lineup
      : [];
  },

  getTopOrderBatters(
    game = {},
    side = "away"
  ) {
    return this.getLineup(game, side)
      .filter(Boolean)
      .sort(
        (a, b) =>
          this.num(a.lineupSpot, 99) -
          this.num(b.lineupSpot, 99)
      )
      .slice(
        0,
        this.settings
          .maximumTopOrderBatters
      );
  },

  getBatterOPS(batter = {}) {
    return this.num(
      batter.hitting?.ops ??
      batter.ops ??
      batter.stats?.ops,
      0
    );
  },

  getBatterISO(batter = {}) {
    const directISO = this.num(
      batter.hitting?.iso ??
      batter.iso ??
      batter.stats?.iso,
      0
    );

    if (directISO > 0) {
      return directISO;
    }

    const average = this.num(
      batter.hitting?.avg ??
      batter.avg,
      0
    );

    const slugging = this.num(
      batter.hitting?.slg ??
      batter.slg,
      0
    );

    return slugging > 0
      ? Math.max(
          0,
          slugging - average
        )
      : 0;
  },

  getBatterHomeRuns(batter = {}) {
    return this.num(
      batter.hitting?.homeRuns ??
      batter.homeRuns ??
      batter.stats?.homeRuns,
      0
    );
  },

  getBatterBarrelRate(batter = {}) {
    return this.num(
      batter.statcast?.barrelRate ??
      batter.statcast?.barrelPct ??
      batter.barrelRate,
      0
    );
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

    return confirmedCount >= 7;
  },

  getTopOrderRisk(
    game = {},
    side = "away"
  ) {
    const batters =
      this.getTopOrderBatters(
        game,
        side
      );

    if (!batters.length) {
      return {
        score: 10,
        batterCount: 0,
        averageOPS: 0,
        averageISO: 0,
        totalHomeRuns: 0,
        dangerousBatters: 0
      };
    }

    let totalOPS = 0;
    let totalISO = 0;
    let totalHomeRuns = 0;
    let dangerousBatters = 0;

    for (const batter of batters) {
      const ops =
        this.getBatterOPS(batter);

      const iso =
        this.getBatterISO(batter);

      const homeRuns =
        this.getBatterHomeRuns(batter);

      const barrelRate =
        this.getBatterBarrelRate(batter);

      totalOPS += ops;
      totalISO += iso;
      totalHomeRuns += homeRuns;

      if (
        ops >= 0.850 ||
        iso >= 0.220 ||
        barrelRate >= 12
      ) {
        dangerousBatters += 1;
      }
    }

    const batterCount =
      batters.length;

    const averageOPS =
      totalOPS / batterCount;

    const averageISO =
      totalISO / batterCount;

    let risk = 0;

    if (averageOPS >= 0.850) {
      risk += 12;
    } else if (averageOPS >= 0.800) {
      risk += 9;
    } else if (averageOPS >= 0.750) {
      risk += 6;
    } else if (averageOPS >= 0.700) {
      risk += 3;
    }

    if (averageISO >= 0.230) {
      risk += 10;
    } else if (averageISO >= 0.200) {
      risk += 7;
    } else if (averageISO >= 0.170) {
      risk += 4;
    }

    risk += Math.min(
      8,
      dangerousBatters * 2
    );

    if (totalHomeRuns >= 70) {
      risk += 6;
    } else if (totalHomeRuns >= 45) {
      risk += 4;
    } else if (totalHomeRuns >= 25) {
      risk += 2;
    }

    return {
      score: this.clamp(
        risk,
        0,
        30
      ),

      batterCount,
      averageOPS,
      averageISO,
      totalHomeRuns,
      dangerousBatters
    };
  },

  /*
  =======================================================
  STARTING PITCHER NRFI SCORE
  Maximum: 30 points per pitcher
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

    if (!hasStarter) {
      return {
        score: 0,
        reasons,
        warnings: [
          "Starting pitcher is not confirmed"
        ],

        era: 0,
        whip: 0,
        hr9: 0,
        kbb: 0,
        hasStarter: false
      };
    }

    const era =
      this.getPitcherERA(stats);

    const whip =
      this.getPitcherWHIP(stats);

    const hr9 =
      this.getPitcherHR9(stats);

    const kbb =
      this.getPitcherKBB(stats);

    let score = 0;

    /*
    ERA — maximum 10
    */

    if (era > 0 && era <= 2.75) {
      score += 10;
      reasons.push(
        `${pitcherName} has an elite ERA`
      );
    } else if (
      era > 0 &&
      era <= 3.50
    ) {
      score += 8;
      reasons.push(
        `${pitcherName} has a strong ERA`
      );
    } else if (
      era > 0 &&
      era <= 4.25
    ) {
      score += 5;
    } else if (
      era > 0 &&
      era <= 5
    ) {
      score += 2;
    } else if (era > 5) {
      warnings.push(
        `${pitcherName} has a high ERA`
      );
    }

    /*
    WHIP — maximum 9
    */

    if (
      whip > 0 &&
      whip <= 1.05
    ) {
      score += 9;
      reasons.push(
        `${pitcherName} limits baserunners`
      );
    } else if (
      whip > 0 &&
      whip <= 1.20
    ) {
      score += 7;
    } else if (
      whip > 0 &&
      whip <= 1.35
    ) {
      score += 4;
    } else if (
      whip > 0 &&
      whip <= 1.45
    ) {
      score += 2;
    } else if (whip > 1.45) {
      warnings.push(
        `${pitcherName} allows too many baserunners`
      );
    }

    /*
    HR/9 — maximum 7
    */

    if (
      hr9 > 0 &&
      hr9 <= 0.75
    ) {
      score += 7;
      reasons.push(
        `${pitcherName} suppresses home runs`
      );
    } else if (
      hr9 > 0 &&
      hr9 <= 1
    ) {
      score += 6;
    } else if (
      hr9 > 0 &&
      hr9 <= 1.25
    ) {
      score += 4;
    } else if (
      hr9 > 0 &&
      hr9 <= 1.50
    ) {
      score += 2;
    } else if (hr9 > 1.50) {
      warnings.push(
        `${pitcherName} has elevated HR risk`
      );
    }

    /*
    K/BB — maximum 4
    */

    if (kbb >= 4) {
      score += 4;
      reasons.push(
        `${pitcherName} has strong command`
      );
    } else if (kbb >= 3) {
      score += 3;
    } else if (kbb >= 2) {
      score += 2;
    } else if (kbb > 0) {
      score += 1;
    }

    return {
      score: this.clamp(
        score,
        0,
        30
      ),

      reasons,
      warnings,

      era,
      whip,
      hr9,
      kbb,
      hasStarter: true
    };
  },

  /*
  =======================================================
  TEAM OFFENSE NRFI SCORE
  Maximum: 15 points per offense

  Higher score means the offense is less threatening.
  =======================================================
  */

  scoreOffense(
    teamName,
    stats = {},
    topOrderRisk = {}
  ) {
    const reasons = [];
    const warnings = [];

    const average =
      this.getTeamAverage(stats);

    const ops =
      this.getTeamOPS(stats);

    const runsPerGame =
      this.getTeamRunsPerGame(stats);

    let score = 0;

    /*
    Team OPS — maximum 6
    */

    if (
      ops > 0 &&
      ops <= 0.680
    ) {
      score += 6;
      reasons.push(
        `${teamName} has a low team OPS`
      );
    } else if (
      ops > 0 &&
      ops <= 0.720
    ) {
      score += 5;
    } else if (
      ops > 0 &&
      ops <= 0.750
    ) {
      score += 3;
    } else if (
      ops > 0 &&
      ops <= 0.780
    ) {
      score += 1;
    } else if (ops > 0.800) {
      warnings.push(
        `${teamName} has a dangerous offense`
      );
    }

    /*
    Team AVG — maximum 4
    */

    if (
      average > 0 &&
      average <= 0.230
    ) {
      score += 4;
    } else if (
      average > 0 &&
      average <= 0.245
    ) {
      score += 3;
    } else if (
      average > 0 &&
      average <= 0.255
    ) {
      score += 2;
    } else if (
      average > 0 &&
      average <= 0.265
    ) {
      score += 1;
    }

    /*
    Runs per game — maximum 5
    */

    if (
      runsPerGame > 0 &&
      runsPerGame <= 3.8
    ) {
      score += 5;
      reasons.push(
        `${teamName} scores fewer runs per game`
      );
    } else if (
      runsPerGame > 0 &&
      runsPerGame <= 4.2
    ) {
      score += 4;
    } else if (
      runsPerGame > 0 &&
      runsPerGame <= 4.6
    ) {
      score += 2;
    } else if (
      runsPerGame > 0 &&
      runsPerGame <= 5
    ) {
      score += 1;
    } else if (runsPerGame > 5) {
      warnings.push(
        `${teamName} scores at a high rate`
      );
    }

    /*
    Top-order danger penalty.
    */

    const topOrderPenalty =
      this.clamp(
        this.num(
          topOrderRisk.score,
          0
        ) * 0.35,
        0,
        10
      );

    score -= topOrderPenalty;

    if (
      topOrderRisk.dangerousBatters >= 3
    ) {
      warnings.push(
        `${teamName} has a dangerous top of the order`
      );
    }

    return {
      score: this.clamp(
        score,
        0,
        15
      ),

      reasons,
      warnings,

      average,
      ops,
      runsPerGame,
      topOrderPenalty
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
        game.awayTeam,
        "Away Team"
      );

    const homeTeam =
      this.text(
        game.homeTeam,
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

    /*
    Home lineup faces away pitcher.
    Away lineup faces home pitcher.
    */

    const awayTopOrderRisk =
      this.getTopOrderRisk(
        game,
        "away"
      );

    const homeTopOrderRisk =
      this.getTopOrderRisk(
        game,
        "home"
      );

    const awayOffense =
      this.scoreOffense(
        awayTeam,
        game.awayTeamStats || {},
        awayTopOrderRisk
      );

    const homeOffense =
      this.scoreOffense(
        homeTeam,
        game.homeTeamStats || {},
        homeTopOrderRisk
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

    /*
    Base scoring:

    Pitchers: 60 maximum
    Offenses: 30 maximum
    Lineups/data: 10 maximum
    */

    let score =
      awayPitcher.score +
      homePitcher.score +
      awayOffense.score +
      homeOffense.score;

    let lineupScore = 0;

    if (
      awayConfirmed &&
      homeConfirmed
    ) {
      lineupScore += 6;
    } else if (
      awayLineup.length >= 7 &&
      homeLineup.length >= 7
    ) {
      lineupScore += 3;
    }

    if (
      awayPitcher.hasStarter &&
      homePitcher.hasStarter
    ) {
      lineupScore += 4;
    }

    score += lineupScore;

    const reasons = [
      ...awayPitcher.reasons,
      ...homePitcher.reasons,
      ...awayOffense.reasons,
      ...homeOffense.reasons
    ];

    const warnings = [
      ...awayPitcher.warnings,
      ...homePitcher.warnings,
      ...awayOffense.warnings,
      ...homeOffense.warnings
    ];

    /*
    Major penalties
    */

    if (
      !awayPitcher.hasStarter ||
      !homePitcher.hasStarter
    ) {
      score -= 18;

      warnings.push(
        "Both starting pitchers are not confirmed"
      );
    }

    if (
      awayTopOrderRisk.score >= 24
    ) {
      score -= 5;
    }

    if (
      homeTopOrderRisk.score >= 24
    ) {
      score -= 5;
    }

    if (
      awayPitcher.era > 5.25 ||
      homePitcher.era > 5.25
    ) {
      score -= 6;
    }

    if (
      awayPitcher.whip > 1.50 ||
      homePitcher.whip > 1.50
    ) {
      score -= 5;
    }

    if (
      awayPitcher.hr9 > 1.65 ||
      homePitcher.hr9 > 1.65
    ) {
      score -= 5;
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
      gamePk:
        this.num(
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
          game.date,
          ""
        ),

      venue:
        this.text(
          game.venue,
          "Venue TBD"
        ),

      score,
      prediction,

      awayPitcherName,
      homePitcherName,

      awayPitcher,
      homePitcher,

      awayOffense,
      homeOffense,

      awayTopOrderRisk,
      homeTopOrderRisk,

      awayConfirmed,
      homeConfirmed,

      reasons:
        [...new Set(reasons)]
          .slice(0, 6),

      warnings:
        [...new Set(warnings)]
          .slice(0, 6)
    };
  },

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
          "Best NRFI candidate"
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
          "Small NRFI lean"
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
          "No strong edge"
      };
    }

    return {
      key: "yrfi",
      label: "YRFI Alert",
      icon: "🔴",
      recommendation:
        "First-inning run risk"
    };
  },

  /*
  =======================================================
  BUILD EVERY GAME
  =======================================================
  */

  build(games = []) {
    if (!Array.isArray(games)) {
      return [];
    }

    return games
      .filter(Boolean)
      .map(
        game =>
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
            Pitcher Score
            <strong>
              ${Math.round(
                result.score || 0
              )}/30
            </strong>
          </span>
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
        <h4>${title}</h4>

        ${items
          .map(
            item => `
              <p>
                ${
                  type === "positive"
                    ? "✓"
                    : "!"
                }
                ${this.escapeHTML(item)}
              </p>
            `
          )
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
              ${prediction.label || "Toss-Up"}
            </strong>

            <small>
              ${prediction.recommendation || ""}
            </small>
          </div>
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

            <div class="nrfi-offense-grid">
              <div>
                <h4>
                  ${this.escapeHTML(
                    result.awayTeam
                  )} offense
                </h4>

                <p>
                  OPS:
                  ${this.formatNumber(
                    result.awayOffense.ops,
                    3
                  )}
                </p>

                <p>
                  Runs/Game:
                  ${this.formatNumber(
                    result.awayOffense
                      .runsPerGame,
                    2
                  )}
                </p>

                <p>
                  Top-order risk:
                  ${Math.round(
                    result.awayTopOrderRisk
                      .score || 0
                  )}/30
                </p>
              </div>

              <div>
                <h4>
                  ${this.escapeHTML(
                    result.homeTeam
                  )} offense
                </h4>

                <p>
                  OPS:
                  ${this.formatNumber(
                    result.homeOffense.ops,
                    3
                  )}
                </p>

                <p>
                  Runs/Game:
                  ${this.formatNumber(
                    result.homeOffense
                      .runsPerGame,
                    2
                  )}
                </p>

                <p>
                  Top-order risk:
                  ${Math.round(
                    result.homeTopOrderRisk
                      .score || 0
                  )}/30
                </p>
              </div>
            </div>
          </div>
        </details>
      </article>
    `;
  },

  /*
  =======================================================
  MAIN LOAD AND RENDER
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
          Analyzing every MLB game
          for NRFI predictions...
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
            data have not loaded yet.
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

    const yrfiCount =
      predictions.filter(
        item =>
          item.prediction.key ===
          "yrfi"
      ).length;

    this.box.innerHTML = `

<div class="nrfi-hero">

  <div class="nrfi-light nrfi-light-left"></div>

  <div class="nrfi-light nrfi-light-right"></div>

  <h1>
    POPS NRFI
    <span>PREDICTIONS</span>
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
            YRFI Alerts
          </span>

          <strong>
            ${yrfiCount}
          </strong>
        </div>
      </div>

      <div class="nrfi-model-note">
        <strong>
          POPS NRFI Model 1.0
        </strong>

        <p>
          Every game is ranked using starting
          pitchers, team offense, top-of-order
          danger and lineup confirmation.
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
