/*
=========================================================
POPS PITCHER K MODEL v1.0
=========================================================

Uses data already loaded into todayData:

- Pitcher season strikeouts
- Innings pitched
- Batters faced
- Games started
- Opponent team strikeouts
- Opponent plate appearances
- Starting lineup
- Pitcher handedness

This file does not fetch data directly.
=========================================================
*/

const PitcherKs = {
  predictions: [],

  /*
  =========================================================
  GENERAL HELPERS
  =========================================================
  */

  num(value, fallback = 0) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;
  },

  clamp(value, minimum, maximum) {
    return Math.max(
      minimum,
      Math.min(maximum, value)
    );
  },

  /*
  MLB innings can appear as:

  120.0
  120.1
  120.2

  The decimal represents outs, not a normal decimal.
  =========================================================
  */

  inningsToOuts(value) {
    const inningsText =
      String(value ?? "0.0");

    const [
      completeInnings,
      partialOuts = "0"
    ] = inningsText.split(".");

    const innings =
      this.num(completeInnings);

    const outs =
      this.clamp(
        this.num(partialOuts),
        0,
        2
      );

    return innings * 3 + outs;
  },

  outsToInnings(outs) {
    const safeOuts = Math.max(
      0,
      Math.round(this.num(outs))
    );

    const completeInnings =
      Math.floor(safeOuts / 3);

    const remainingOuts =
      safeOuts % 3;

    return Number(
      `${completeInnings}.${remainingOuts}`
    );
  },

  getInningsDecimal(value) {
    const outs =
      this.inningsToOuts(value);

    return outs / 3;
  },

  average(values = []) {
    const validValues =
      values
        .map(value => this.num(value, NaN))
        .filter(Number.isFinite);

    if (!validValues.length) {
      return 0;
    }

    return (
      validValues.reduce(
        (total, value) =>
          total + value,
        0
      ) / validValues.length
    );
  },

  /*
  =========================================================
  STAT FIELD NORMALIZATION
  =========================================================
  */

  normalizePitcherStats(stats = {}) {
    const inningsPitched =
      stats.inningsPitched ??
      stats.innings ??
      stats.ip ??
      "0.0";

    const inningsDecimal =
      this.getInningsDecimal(
        inningsPitched
      );

    const strikeouts =
      this.num(
        stats.strikeOuts ??
        stats.strikeouts ??
        stats.so ??
        stats.k
      );

    const battersFaced =
      this.num(
        stats.battersFaced ??
        stats.battersFacedTotal ??
        stats.bf
      );

    const gamesStarted =
      this.num(
        stats.gamesStarted ??
        stats.starts ??
        stats.gs
      );

    const gamesPitched =
      this.num(
        stats.gamesPitched ??
        stats.gamesPlayed ??
        stats.games ??
        gamesStarted
      );

    let strikeoutsPer9 =
      this.num(
        stats.strikeoutsPer9Inn ??
        stats.strikeOutsPer9Inn ??
        stats.kPer9 ??
        stats.k9
      );

    if (
      !strikeoutsPer9 &&
      inningsDecimal > 0
    ) {
      strikeoutsPer9 =
        strikeouts /
        inningsDecimal *
        9;
    }

    let strikeoutRate =
      this.num(
        stats.strikeoutRate ??
        stats.kRate ??
        stats.kPct
      );

    /*
    Convert percentage forms such as 27.4
    into decimal forms such as 0.274.
    */

    if (strikeoutRate > 1) {
      strikeoutRate /= 100;
    }

    if (
      !strikeoutRate &&
      battersFaced > 0
    ) {
      strikeoutRate =
        strikeouts /
        battersFaced;
    }

    const startsUsed =
      gamesStarted ||
      gamesPitched;

    const inningsPerStart =
      startsUsed > 0
        ? inningsDecimal /
          startsUsed
        : 0;

    const battersFacedPerStart =
      startsUsed > 0 &&
      battersFaced > 0
        ? battersFaced /
          startsUsed
        : 0;

    const strikeoutsPerStart =
      startsUsed > 0
        ? strikeouts /
          startsUsed
        : 0;

    return {
      ...stats,

      inningsPitched,
      inningsDecimal,

      strikeouts,
      battersFaced,
      gamesStarted,
      gamesPitched,

      strikeoutsPer9,
      kPer9: strikeoutsPer9,

      strikeoutRate,
      kRate: strikeoutRate,

      inningsPerStart,
      battersFacedPerStart,
      strikeoutsPerStart
    };
  },

  normalizeOpponentStats(stats = {}) {
    const strikeouts =
      this.num(
        stats.strikeOuts ??
        stats.strikeouts ??
        stats.so
      );

    const plateAppearances =
      this.num(
        stats.plateAppearances ??
        stats.pa
      );

    const atBats =
      this.num(
        stats.atBats ??
        stats.ab
      );

    const walks =
      this.num(
        stats.baseOnBalls ??
        stats.walks ??
        stats.bb
      );

    const hitByPitch =
      this.num(
        stats.hitByPitch ??
        stats.hbp
      );

    const sacrificeFlies =
      this.num(
        stats.sacFlies ??
        stats.sacrificeFlies ??
        stats.sf
      );

    const calculatedPlateAppearances =
      atBats +
      walks +
      hitByPitch +
      sacrificeFlies;

    const denominator =
      plateAppearances ||
      calculatedPlateAppearances;

    let strikeoutRate =
      this.num(
        stats.strikeoutRate ??
        stats.kRate ??
        stats.kPct
      );

    if (strikeoutRate > 1) {
      strikeoutRate /= 100;
    }

    if (
      !strikeoutRate &&
      denominator > 0
    ) {
      strikeoutRate =
        strikeouts /
        denominator;
    }

    return {
      ...stats,

      strikeouts,
      plateAppearances:
        denominator,

      strikeoutRate,
      kRate:
        strikeoutRate
    };
  },

  /*
  =========================================================
  LINEUP STRIKEOUT ADJUSTMENT
  =========================================================
  */

  getLineupStrikeoutRate(
    lineup = []
  ) {
    if (!Array.isArray(lineup)) {
      return 0;
    }

    let totalStrikeouts = 0;
    let totalPlateAppearances = 0;

    for (const batter of lineup) {
      const hitting =
        batter?.hitting || {};

      const strikeouts =
        this.num(
          hitting.strikeOuts ??
          hitting.strikeouts ??
          hitting.so
        );

      const plateAppearances =
        this.num(
          hitting.plateAppearances ??
          hitting.pa
        );

      const atBats =
        this.num(
          hitting.atBats ??
          hitting.ab
        );

      const denominator =
        plateAppearances ||
        atBats;

      if (denominator <= 0) {
        continue;
      }

      totalStrikeouts +=
        strikeouts;

      totalPlateAppearances +=
        denominator;
    }

    if (totalPlateAppearances <= 0) {
      return 0;
    }

    return (
      totalStrikeouts /
      totalPlateAppearances
    );
  },

  /*
  =========================================================
  PROJECTED INNINGS
  =========================================================
  */

  projectInnings(
    pitcherStats = {}
  ) {
    const stats =
      this.normalizePitcherStats(
        pitcherStats
      );

    let projectedInnings =
      stats.inningsPerStart;

    /*
    Use a reasonable starter fallback when
    games-started data is unavailable.
    */

    if (!projectedInnings) {
      projectedInnings = 5.5;
    }

    /*
    Keep projections within realistic ranges.
    */

    return this.clamp(
      projectedInnings,
      4,
      7.5
    );
  },

  /*
  =========================================================
  PROJECTED BATTERS FACED
  =========================================================
  */

  projectBattersFaced(
    pitcherStats = {},
    projectedInnings = 0
  ) {
    const stats =
      this.normalizePitcherStats(
        pitcherStats
      );

    if (
      stats.battersFacedPerStart > 0
    ) {
      return this.clamp(
        stats.battersFacedPerStart,
        18,
        32
      );
    }

    /*
    Approximately 4.25 batters faced
    per inning as a fallback.
    */

    return this.clamp(
      projectedInnings * 4.25,
      18,
      32
    );
  },

  /*
  =========================================================
  OPPONENT STRIKEOUT ADJUSTMENT
  =========================================================
  */

  getOpponentAdjustment(
    opponentStats = {},
    lineup = []
  ) {
    const team =
      this.normalizeOpponentStats(
        opponentStats
      );

    const lineupRate =
      this.getLineupStrikeoutRate(
        lineup
      );

    /*
    League-average baseline used only as
    the neutral comparison point.
    */

    const leagueAverageKRate = 0.225;

    let opponentRate =
      team.strikeoutRate;

    /*
    Confirmed/projected lineup receives
    more weight when its data is available.
    */

    if (
      lineupRate > 0 &&
      opponentRate > 0
    ) {
      opponentRate =
        opponentRate * 0.6 +
        lineupRate * 0.4;
    } else if (lineupRate > 0) {
      opponentRate =
        lineupRate;
    }

    if (!opponentRate) {
      opponentRate =
        leagueAverageKRate;
    }

    const adjustment =
      opponentRate /
      leagueAverageKRate;

    return {
      teamStrikeoutRate:
        team.strikeoutRate,

      lineupStrikeoutRate:
        lineupRate,

      opponentStrikeoutRate:
        opponentRate,

      adjustment:
        this.clamp(
          adjustment,
          0.75,
          1.3
        )
    };
  },

  /*
  =========================================================
  POPS K SCORE
  =========================================================
  */

  calculateKScore({
    pitcherStats,
    opponentAdjustment,
    projectedStrikeouts
  }) {
    const stats =
      this.normalizePitcherStats(
        pitcherStats
      );

    let score = 40;

    /*
    Pitcher strikeout ability.
    */

    if (stats.kRate >= 0.32) {
      score += 25;
    } else if (stats.kRate >= 0.28) {
      score += 21;
    } else if (stats.kRate >= 0.25) {
      score += 17;
    } else if (stats.kRate >= 0.22) {
      score += 12;
    } else if (stats.kRate >= 0.19) {
      score += 7;
    }

    /*
    K/9 support.
    */

    if (stats.kPer9 >= 11) {
      score += 15;
    } else if (stats.kPer9 >= 10) {
      score += 12;
    } else if (stats.kPer9 >= 9) {
      score += 9;
    } else if (stats.kPer9 >= 8) {
      score += 5;
    }

    /*
    Opponent strikeout tendency.
    */

    if (
      opponentAdjustment.adjustment >=
      1.15
    ) {
      score += 12;
    } else if (
      opponentAdjustment.adjustment >=
      1.08
    ) {
      score += 8;
    } else if (
      opponentAdjustment.adjustment >=
      1.02
    ) {
      score += 4;
    } else if (
      opponentAdjustment.adjustment <
      0.9
    ) {
      score -= 8;
    }

    /*
    Projected volume.
    */

    if (projectedStrikeouts >= 8) {
      score += 8;
    } else if (
      projectedStrikeouts >= 7
    ) {
      score += 6;
    } else if (
      projectedStrikeouts >= 6
    ) {
      score += 3;
    }

    return Math.round(
      this.clamp(
        score,
        1,
        100
      )
    );
  },

  getTier(score) {
    if (score >= 90) {
      return "🔥 ELITE K TARGET";
    }

    if (score >= 82) {
      return "⭐ VERY STRONG";
    }

    if (score >= 74) {
      return "🟢 STRONG";
    }

    if (score >= 65) {
      return "🟡 LEAN";
    }

    return "⚪ LOW CONFIDENCE";
  },

  /*
  =========================================================
  BUILD ONE PITCHER PROJECTION
  =========================================================
  */

  buildProjection({
    pitcherId,
    pitcherName,
    pitcherHand = "",
    team,
    opponent,
    gamePk,
    gameText,
    gameTime,
    pitcherStats = {},
    opponentStats = {},
    opponentLineup = []
  }) {
    const stats =
      this.normalizePitcherStats(
        pitcherStats
      );

    const projectedInnings =
      this.projectInnings(stats);

    const projectedBattersFaced =
      this.projectBattersFaced(
        stats,
        projectedInnings
      );

    const opponentAdjustment =
      this.getOpponentAdjustment(
        opponentStats,
        opponentLineup
      );

    /*
    Primary projection using K rate.
    */

    let projectedStrikeouts =
      projectedBattersFaced *
      stats.kRate *
      opponentAdjustment.adjustment;

    /*
    Fall back to K/9 when K rate or
    batters-faced data is unavailable.
    */

    if (
      !projectedStrikeouts &&
      stats.kPer9 > 0
    ) {
      projectedStrikeouts =
        projectedInnings /
        9 *
        stats.kPer9 *
        opponentAdjustment.adjustment;
    }

    /*
    Final fallback using season strikeouts
    per start.
    */

    if (
      !projectedStrikeouts &&
      stats.strikeoutsPerStart > 0
    ) {
      projectedStrikeouts =
        stats.strikeoutsPerStart *
        opponentAdjustment.adjustment;
    }

    projectedStrikeouts =
      this.clamp(
        projectedStrikeouts || 0,
        0,
        15
      );

    const score =
      this.calculateKScore({
        pitcherStats: stats,
        opponentAdjustment,
        projectedStrikeouts
      });

    return {
      pitcherId:
        this.num(pitcherId),

      pitcherName:
        pitcherName || "Pitcher TBD",

      pitcherHand:
        pitcherHand || "",

      team:
        team || "",

      opponent:
        opponent || "",

      gamePk:
        this.num(gamePk),

      gameText:
        gameText || "",

      gameTime:
        gameTime || "",

      projectedStrikeouts:
        Number(
          projectedStrikeouts.toFixed(1)
        ),

      projectedInnings:
        Number(
          projectedInnings.toFixed(1)
        ),

      projectedBattersFaced:
        Number(
          projectedBattersFaced.toFixed(1)
        ),

      kRate:
        Number(
          (
            stats.kRate * 100
          ).toFixed(1)
        ),

      kPer9:
        Number(
          stats.kPer9.toFixed(2)
        ),

      strikeoutsPerStart:
        Number(
          stats.strikeoutsPerStart
            .toFixed(2)
        ),

      opponentKRate:
        Number(
          (
            opponentAdjustment
              .opponentStrikeoutRate *
            100
          ).toFixed(1)
        ),

      opponentAdjustment:
        Number(
          opponentAdjustment
            .adjustment
            .toFixed(3)
        ),

      score,
      tier:
        this.getTier(score),

      rawStats: stats
    };
  },

  /*
  =========================================================
  LOAD ALL DAILY PITCHER PROJECTIONS
  =========================================================
  */

  load(games = []) {
    this.predictions = [];

    for (const game of games || []) {
      const gamePk =
        this.num(
          game.gamePk ||
          game.id
        );

      const gameText =
        `${game.awayTeam} vs ${game.homeTeam}`;

      /*
      Away starter faces the home lineup.
      */

      if (
        game.awayPitcher &&
        game.awayPitcher !== "TBD"
      ) {
        this.predictions.push(
          this.buildProjection({
            pitcherId:
              game.awayPitcherId,

            pitcherName:
              game.awayPitcher,

            pitcherHand:
              game.awayPitcherHand,

            team:
              game.awayTeam,

            opponent:
              game.homeTeam,

            gamePk,
            gameText,

            gameTime:
              game.date,

            pitcherStats:
              game.awayPitcherStats ||
              {},

            opponentStats:
              game.homeTeamStats ||
              {},

            opponentLineup:
              game.homeLineup ||
              []
          })
        );
      }

      /*
      Home starter faces the away lineup.
      */

      if (
        game.homePitcher &&
        game.homePitcher !== "TBD"
      ) {
        this.predictions.push(
          this.buildProjection({
            pitcherId:
              game.homePitcherId,

            pitcherName:
              game.homePitcher,

            pitcherHand:
              game.homePitcherHand,

            team:
              game.homeTeam,

            opponent:
              game.awayTeam,

            gamePk,
            gameText,

            gameTime:
              game.date,

            pitcherStats:
              game.homePitcherStats ||
              {},

            opponentStats:
              game.awayTeamStats ||
              {},

            opponentLineup:
              game.awayLineup ||
              []
          })
        );
      }
    }

    this.predictions.sort(
      (a, b) =>
        b.projectedStrikeouts -
          a.projectedStrikeouts ||
        b.score -
          a.score
    );

    this.predictions =
      this.predictions.map(
        (prediction, index) => ({
          ...prediction,
          rank: index + 1
        })
      );

    window.pitcherKPredictions =
  this.predictions;

this.render();

console.log(
  "🎯 POPS Pitcher K predictions:",
  this.predictions
);

return this.predictions;
  }
};

window.PitcherKs = PitcherKs;
