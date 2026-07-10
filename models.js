/*
=========================================================
POPS PICKZ HR MODEL 3.0
=========================================================

100-point scoring system:

Batter Power ................. 25
Pitcher Vulnerability ........ 25
Contact Quality .............. 15
Platoon Split ................ 10
Recent Power ................. 10
Ball Flight ................... 7
Lineup Spot ................... 5
BvP ........................... 3

TOTAL ........................ 100
*/

const POPSModels = {
  /*
  =======================================================
  GENERAL HELPERS
  =======================================================
  */

  num(value, fallback = 0) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : fallback;
  },

  clamp(value, minimum, maximum) {
    return Math.min(
      maximum,
      Math.max(minimum, value)
    );
  },

  round(value, digits = 0) {
    const factor = 10 ** digits;

    return (
      Math.round(
        this.num(value) * factor
      ) / factor
    );
  },

  hasValue(value) {
    return (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      Number.isFinite(Number(value))
    );
  },

  normalizeHand(value = "") {
    return String(value)
      .trim()
      .toUpperCase();
  },

  /*
  =======================================================
  1. BATTER POWER — 25 POINTS
  =======================================================

  ISO ......................... 8
  HR rate ..................... 6
  SLG ......................... 5
  HR total .................... 4
  Extra-base-hit rate ......... 2
  */

  getBatterPowerScore(hitting = {}) {
    const iso = this.num(hitting.iso);
    const slg = this.num(hitting.slg);

    const homeRuns = this.num(
      hitting.homeRuns
    );

    const plateAppearances = this.num(
      hitting.plateAppearances
    );

    const atBats = this.num(
      hitting.atBats
    );

    const extraBaseHits = this.num(
      hitting.extraBaseHits,
      this.num(hitting.doubles) +
        this.num(hitting.triples) +
        homeRuns
    );

    const hrRate =
      this.hasValue(hitting.hrRate)
        ? this.num(hitting.hrRate)
        : plateAppearances > 0
          ? homeRuns / plateAppearances
          : 0;

    const extraBaseHitRate =
      this.hasValue(
        hitting.extraBaseHitRate
      )
        ? this.num(
            hitting.extraBaseHitRate
          )
        : atBats > 0
          ? extraBaseHits / atBats
          : 0;

    let isoScore = 0;

    if (iso >= 0.300) isoScore = 8;
    else if (iso >= 0.260) isoScore = 7;
    else if (iso >= 0.230) isoScore = 6;
    else if (iso >= 0.200) isoScore = 5;
    else if (iso >= 0.175) isoScore = 4;
    else if (iso >= 0.150) isoScore = 3;
    else if (iso >= 0.125) isoScore = 2;
    else if (iso > 0) isoScore = 1;

    let hrRateScore = 0;

    if (hrRate >= 0.075) hrRateScore = 6;
    else if (hrRate >= 0.060) hrRateScore = 5;
    else if (hrRate >= 0.050) hrRateScore = 4;
    else if (hrRate >= 0.040) hrRateScore = 3;
    else if (hrRate >= 0.030) hrRateScore = 2;
    else if (hrRate > 0) hrRateScore = 1;

    let slgScore = 0;

    if (slg >= 0.600) slgScore = 5;
    else if (slg >= 0.540) slgScore = 4;
    else if (slg >= 0.490) slgScore = 3;
    else if (slg >= 0.440) slgScore = 2;
    else if (slg > 0) slgScore = 1;

    let homeRunScore = 0;

    if (homeRuns >= 30) homeRunScore = 4;
    else if (homeRuns >= 22) homeRunScore = 3;
    else if (homeRuns >= 14) homeRunScore = 2;
    else if (homeRuns >= 5) homeRunScore = 1;

    let extraBaseScore = 0;

    if (extraBaseHitRate >= 0.150) {
      extraBaseScore = 2;
    } else if (extraBaseHitRate >= 0.100) {
      extraBaseScore = 1;
    }

    const score =
      isoScore +
      hrRateScore +
      slgScore +
      homeRunScore +
      extraBaseScore;

    return {
      score: this.clamp(score, 0, 25),
      max: 25,

      details: {
        iso,
        hrRate: this.round(hrRate, 4),
        slg,
        homeRuns,
        extraBaseHitRate:
          this.round(
            extraBaseHitRate,
            4
          )
      }
    };
  },

  /*
  =======================================================
  2. PITCHER VULNERABILITY — 25 POINTS
  =======================================================

  HR/9 ....................... 10
  HR allowed .................. 4
  ERA ......................... 3
  WHIP ........................ 3
  Hard-hit allowed ............ 3
  Barrel rate allowed ......... 2
  */

  getPitcherVulnerabilityScore(
    pitcher = {}
  ) {
    const inningsPitched = this.num(
      pitcher.inningsPitched
    );

    const homeRuns = this.num(
      pitcher.homeRuns
    );

    const hr9 =
      this.hasValue(
        pitcher.homeRunsPer9
      )
        ? this.num(
            pitcher.homeRunsPer9
          )
        : inningsPitched > 0
          ? (homeRuns * 9) /
            inningsPitched
          : 0;

    const era = this.num(pitcher.era);
    const whip = this.num(pitcher.whip);

    const hardHitAllowed = this.hasValue(
      pitcher.hardHitPctAllowed
    )
      ? this.num(
          pitcher.hardHitPctAllowed
        )
      : null;

    const barrelAllowed = this.hasValue(
      pitcher.barrelPctAllowed
    )
      ? this.num(
          pitcher.barrelPctAllowed
        )
      : null;

    let hr9Score = 0;

    if (hr9 >= 2.0) hr9Score = 10;
    else if (hr9 >= 1.7) hr9Score = 9;
    else if (hr9 >= 1.5) hr9Score = 8;
    else if (hr9 >= 1.3) hr9Score = 6;
    else if (hr9 >= 1.1) hr9Score = 4;
    else if (hr9 >= 0.9) hr9Score = 2;
    else if (hr9 > 0) hr9Score = 1;

    let totalHRScore = 0;

    if (homeRuns >= 25) totalHRScore = 4;
    else if (homeRuns >= 18) totalHRScore = 3;
    else if (homeRuns >= 12) totalHRScore = 2;
    else if (homeRuns >= 6) totalHRScore = 1;

    let eraScore = 0;

    if (era >= 5.5) eraScore = 3;
    else if (era >= 4.7) eraScore = 2;
    else if (era >= 4.0) eraScore = 1;

    let whipScore = 0;

    if (whip >= 1.50) whipScore = 3;
    else if (whip >= 1.35) whipScore = 2;
    else if (whip >= 1.20) whipScore = 1;

    /*
    Missing Statcast information does not
    become zero performance.

    It receives a neutral midpoint and lowers
    the confidence rating later.
    */

    let hardHitScore = 1.5;

    if (hardHitAllowed !== null) {
      if (hardHitAllowed >= 45) {
        hardHitScore = 3;
      } else if (hardHitAllowed >= 40) {
        hardHitScore = 2;
      } else if (hardHitAllowed >= 35) {
        hardHitScore = 1;
      } else {
        hardHitScore = 0;
      }
    }

    let barrelScore = 1;

    if (barrelAllowed !== null) {
      if (barrelAllowed >= 11) {
        barrelScore = 2;
      } else if (barrelAllowed >= 8) {
        barrelScore = 1;
      } else {
        barrelScore = 0;
      }
    }

    const score =
      hr9Score +
      totalHRScore +
      eraScore +
      whipScore +
      hardHitScore +
      barrelScore;

    return {
      score: this.clamp(
        this.round(score),
        0,
        25
      ),

      max: 25,

      details: {
        hr9: this.round(hr9, 2),
        homeRuns,
        era,
        whip,
        hardHitAllowed,
        barrelAllowed
      }
    };
  },

  /*
  =======================================================
  3. CONTACT QUALITY — 15 POINTS
  =======================================================

  Barrel % ..................... 7
  Hard-hit % ................... 5
  Average exit velocity ........ 3
  */

  getContactQualityScore(
    statcast = {}
  ) {
    const barrelPct = this.hasValue(
      statcast.barrelPct
    )
      ? this.num(statcast.barrelPct)
      : null;

    const hardHitPct = this.hasValue(
      statcast.hardHitPct
    )
      ? this.num(statcast.hardHitPct)
      : null;

    const avgExitVelocity =
      this.hasValue(
        statcast.avgExitVelocity
      )
        ? this.num(
            statcast.avgExitVelocity
          )
        : null;

    const available =
      barrelPct !== null ||
      hardHitPct !== null ||
      avgExitVelocity !== null;

    /*
    Neutral score when Statcast is missing.
    The player is not punished with 0/15.
    */

    if (!available) {
      return {
        score: 7,
        max: 15,
        available: false,

        details: {
          barrelPct: null,
          hardHitPct: null,
          avgExitVelocity: null
        }
      };
    }

    let barrelScore = 0;

    if (barrelPct !== null) {
      if (barrelPct >= 18) barrelScore = 7;
      else if (barrelPct >= 15) barrelScore = 6;
      else if (barrelPct >= 12) barrelScore = 5;
      else if (barrelPct >= 9) barrelScore = 4;
      else if (barrelPct >= 7) barrelScore = 3;
      else if (barrelPct >= 5) barrelScore = 2;
      else barrelScore = 1;
    }

    let hardHitScore = 0;

    if (hardHitPct !== null) {
      if (hardHitPct >= 55) hardHitScore = 5;
      else if (hardHitPct >= 50) hardHitScore = 4;
      else if (hardHitPct >= 45) hardHitScore = 3;
      else if (hardHitPct >= 40) hardHitScore = 2;
      else hardHitScore = 1;
    }

    let exitVelocityScore = 0;

    if (avgExitVelocity !== null) {
      if (avgExitVelocity >= 93) {
        exitVelocityScore = 3;
      } else if (avgExitVelocity >= 90) {
        exitVelocityScore = 2;
      } else if (avgExitVelocity >= 87) {
        exitVelocityScore = 1;
      }
    }

    const score =
      barrelScore +
      hardHitScore +
      exitVelocityScore;

    return {
      score: this.clamp(score, 0, 15),
      max: 15,
      available: true,

      details: {
        barrelPct,
        hardHitPct,
        avgExitVelocity
      }
    };
  },

  /*
  =======================================================
  4. PLATOON SPLIT — 10 POINTS
  =======================================================
  */

  getPlatoonSplitScore({
    batterHand = "",
    pitcherHand = "",
    split = {}
  } = {}) {
    const batter = this.normalizeHand(
      batterHand
    );

    const pitcher = this.normalizeHand(
      pitcherHand
    );

    const splitSLG = this.num(split.slg);
    const splitISO = this.num(split.iso);
    const splitOPS = this.num(split.ops);

    const hasSplitStats =
      splitSLG > 0 ||
      splitISO > 0 ||
      splitOPS > 0;

    let score = 5;

    if (hasSplitStats) {
      if (
        splitISO >= 0.280 ||
        splitSLG >= 0.580
      ) {
        score = 10;
      } else if (
        splitISO >= 0.230 ||
        splitSLG >= 0.520
      ) {
        score = 8;
      } else if (
        splitISO >= 0.180 ||
        splitSLG >= 0.460
      ) {
        score = 6;
      } else if (
        splitISO >= 0.130 ||
        splitSLG >= 0.400
      ) {
        score = 4;
      } else {
        score = 2;
      }
    } else {
      const hasTraditionalAdvantage =
        batter === "S" ||
        (batter === "L" &&
          pitcher === "R") ||
        (batter === "R" &&
          pitcher === "L");

      score = hasTraditionalAdvantage
        ? 6
        : 4;
    }

    return {
      score: this.clamp(score, 0, 10),
      max: 10,
      available: hasSplitStats,

      details: {
        batterHand: batter,
        pitcherHand: pitcher,
        splitSLG,
        splitISO,
        splitOPS
      }
    };
  },

  /*
  =======================================================
  5. RECENT POWER — 10 POINTS
  =======================================================

  Last 10 HR ................... 4
  Last 10 extra-base hits ...... 3
  Last 10 SLG .................. 3
  */

  getRecentPowerScore(
    recent = {},
    hitStreak = 0
  ) {
    const homeRuns = this.num(
      recent.homeRuns
    );

    const extraBaseHits = this.num(
      recent.extraBaseHits
    );

    const slg = this.num(recent.slg);

    const games = this.num(
      recent.games
    );

    const available =
      games > 0 ||
      homeRuns > 0 ||
      extraBaseHits > 0 ||
      slg > 0;

    /*
    Hit streak is only a light fallback.
    Singles should not create a large HR bonus.
    */

    if (!available) {
      const fallback =
        this.num(hitStreak) >= 5
          ? 4
          : this.num(hitStreak) >= 2
            ? 3
            : 2;

      return {
        score: fallback,
        max: 10,
        available: false,

        details: {
          games: 0,
          homeRuns: 0,
          extraBaseHits: 0,
          slg: 0
        }
      };
    }

    let hrScore = 0;

    if (homeRuns >= 4) hrScore = 4;
    else if (homeRuns === 3) hrScore = 3;
    else if (homeRuns === 2) hrScore = 2;
    else if (homeRuns === 1) hrScore = 1;

    let extraBaseScore = 0;

    if (extraBaseHits >= 7) {
      extraBaseScore = 3;
    } else if (extraBaseHits >= 4) {
      extraBaseScore = 2;
    } else if (extraBaseHits >= 2) {
      extraBaseScore = 1;
    }

    let slgScore = 0;

    if (slg >= 0.700) slgScore = 3;
    else if (slg >= 0.550) slgScore = 2;
    else if (slg >= 0.425) slgScore = 1;

    return {
      score: this.clamp(
        hrScore +
          extraBaseScore +
          slgScore,
        0,
        10
      ),

      max: 10,
      available: true,

      details: {
        games,
        homeRuns,
        extraBaseHits,
        slg
      }
    };
  },

  /*
  =======================================================
  6. BALL FLIGHT — 7 POINTS
  =======================================================

  Fly-ball % ................... 3
  Pull % ....................... 2
  Sweet-spot % ................. 2
  */

  getBallFlightScore(
    statcast = {}
  ) {
    const flyBallPct = this.hasValue(
      statcast.flyBallPct
    )
      ? this.num(statcast.flyBallPct)
      : null;

    const pullPct = this.hasValue(
      statcast.pullPct
    )
      ? this.num(statcast.pullPct)
      : null;

    const sweetSpotPct =
      this.hasValue(
        statcast.sweetSpotPct
      )
        ? this.num(
            statcast.sweetSpotPct
          )
        : null;

    const available =
      flyBallPct !== null ||
      pullPct !== null ||
      sweetSpotPct !== null;

    if (!available) {
      return {
        score: 3,
        max: 7,
        available: false,

        details: {
          flyBallPct: null,
          pullPct: null,
          sweetSpotPct: null
        }
      };
    }

    let flyBallScore = 0;

    if (flyBallPct !== null) {
      if (flyBallPct >= 45) flyBallScore = 3;
      else if (flyBallPct >= 35) flyBallScore = 2;
      else if (flyBallPct >= 25) flyBallScore = 1;
    }

    let pullScore = 0;

    if (pullPct !== null) {
      if (pullPct >= 48) pullScore = 2;
      else if (pullPct >= 38) pullScore = 1;
    }

    let sweetSpotScore = 0;

    if (sweetSpotPct !== null) {
      if (sweetSpotPct >= 38) {
        sweetSpotScore = 2;
      } else if (sweetSpotPct >= 30) {
        sweetSpotScore = 1;
      }
    }

    return {
      score: this.clamp(
        flyBallScore +
          pullScore +
          sweetSpotScore,
        0,
        7
      ),

      max: 7,
      available: true,

      details: {
        flyBallPct,
        pullPct,
        sweetSpotPct
      }
    };
  },

  /*
  =======================================================
  7. LINEUP SPOT — 5 POINTS
  =======================================================
  */

  getLineupSpotScore(
    lineupSpot = 9
  ) {
    const spot = this.num(
      lineupSpot,
      9
    );

    let score = 1;

    if (spot === 3 || spot === 4) {
      score = 5;
    } else if (
      spot === 2 ||
      spot === 5
    ) {
      score = 4;
    } else if (
      spot === 1 ||
      spot === 6
    ) {
      score = 3;
    } else if (spot === 7) {
      score = 2;
    }

    return {
      score,
      max: 5,

      details: {
        lineupSpot: spot
      }
    };
  },

  /*
  =======================================================
  8. BVP HISTORY — 3 POINTS
  =======================================================
  */

  getBvPScore(bvp = {}) {
    const atBats = this.num(
      bvp.atBats
    );

    const hits = this.num(bvp.hits);

    const avg = this.num(bvp.avg);

    const homeRuns = this.num(
      bvp.homeRuns
    );

    let score = 0;

    if (
      homeRuns >= 2 &&
      atBats >= 5
    ) {
      score = 3;
    } else if (
      homeRuns >= 1 &&
      atBats >= 5
    ) {
      score = 2;
    } else if (
      atBats >= 10 &&
      avg >= 0.300
    ) {
      score = 1;
    }

    return {
      score,
      max: 3,

      available:
        atBats > 0,

      details: {
        atBats,
        hits,
        avg,
        homeRuns
      }
    };
  },

  /*
  =======================================================
  CONFIDENCE RATING
  =======================================================
  */

  getConfidence({
    confirmedLineup = false,
    currentPitcher = false,
    seasonStats = false,
    statcast = false,
    recentForm = false,
    splitStats = false
  } = {}) {
    let points = 0;

    if (confirmedLineup) points += 20;
    if (currentPitcher) points += 20;
    if (seasonStats) points += 20;
    if (statcast) points += 15;
    if (recentForm) points += 15;
    if (splitStats) points += 10;

    let label = "Low";

    if (points >= 90) {
      label = "Elite";
    } else if (points >= 75) {
      label = "High";
    } else if (points >= 55) {
      label = "Medium";
    }

    return {
      score: points,
      label
    };
  },

  /*
  =======================================================
  SCORE TIER
  =======================================================
  */

  getHRTier(score) {
    score = this.num(score);

    if (score >= 90) {
      return "🔥 Elite HR Target";
    }

    if (score >= 85) {
      return "💣 Excellent HR Target";
    }

    if (score >= 80) {
      return "⚡ Strong HR Target";
    }

    if (score >= 75) {
      return "🎯 Solid HR Target";
    }

    if (score >= 70) {
      return "👀 Sleeper HR Target";
    }

    return "❌ Pass";
  },

  /*
  =======================================================
  COMPLETE POPS HR SCORE
  =======================================================
  */

  getHRScore({
    batter = {},
    pitcher = {},
    pitcherHand = "",
    handednessSplit = {},
    recentForm = {}
  } = {}) {
    const power =
      this.getBatterPowerScore(
        batter.hitting || {}
      );

    const pitcherVulnerability =
      this.getPitcherVulnerabilityScore(
        pitcher || {}
      );

    const contact =
      this.getContactQualityScore(
        batter.statcast || {}
      );

    const platoon =
      this.getPlatoonSplitScore({
        batterHand:
          batter.batSide || "",

        pitcherHand,

        split:
          handednessSplit ||
          batter.handednessSplit ||
          {}
      });

    const recent =
      this.getRecentPowerScore(
        recentForm ||
          batter.recentForm ||
          {},

        batter.hitStreak || 0
      );

    const ballFlight =
      this.getBallFlightScore(
        batter.statcast || {}
      );

    const lineup =
      this.getLineupSpotScore(
        batter.lineupSpot
      );

    const bvp =
      this.getBvPScore(
        batter.bvp || {}
      );

    const rawScore =
      power.score +
      pitcherVulnerability.score +
      contact.score +
      platoon.score +
      recent.score +
      ballFlight.score +
      lineup.score +
      bvp.score;

    const score = this.clamp(
      this.round(rawScore),
      0,
      100
    );

    const confidence =
      this.getConfidence({
        confirmedLineup:
          batter.confirmed === true,

        currentPitcher:
          Boolean(
            pitcher?.id ||
            pitcher?.playerId ||
            pitcher?.pitcherId
          ),

        seasonStats:
          this.num(
            batter?.hitting
              ?.plateAppearances
          ) > 0,

        statcast:
          contact.available &&
          ballFlight.available,

        recentForm:
          recent.available,

        splitStats:
          platoon.available
      });

    return {
      score,
      tier: this.getHRTier(score),
      confidence,

      breakdown: {
        batterPower: power,
        pitcherVulnerability,
        contactQuality: contact,
        platoonSplit: platoon,
        recentPower: recent,
        ballFlight,
        lineupSpot: lineup,
        bvp
      }
    };
  },

  /*
  =======================================================
  DISPLAY-FRIENDLY BREAKDOWN
  =======================================================
  */

  formatBreakdown(result = {}) {
    const breakdown =
      result.breakdown || {};

    return [
      {
        icon: "💪",
        label: "Batter Power",
        score:
          breakdown.batterPower?.score || 0,
        max: 25
      },
      {
        icon: "🎯",
        label: "Pitcher Vulnerability",
        score:
          breakdown
            .pitcherVulnerability
            ?.score || 0,
        max: 25
      },
      {
        icon: "💥",
        label: "Hard Contact",
        score:
          breakdown.contactQuality
            ?.score || 0,
        max: 15
      },
      {
        icon: "🆚",
        label: "Platoon Split",
        score:
          breakdown.platoonSplit
            ?.score || 0,
        max: 10
      },
      {
        icon: "🔥",
        label: "Recent Power",
        score:
          breakdown.recentPower
            ?.score || 0,
        max: 10
      },
      {
        icon: "🚀",
        label: "Ball Flight",
        score:
          breakdown.ballFlight
            ?.score || 0,
        max: 7
      },
      {
        icon: "📍",
        label: "Lineup Spot",
        score:
          breakdown.lineupSpot
            ?.score || 0,
        max: 5
      },
      {
        icon: "📊",
        label: "BvP",
        score:
          breakdown.bvp?.score || 0,
        max: 3
      }
    ];
  }
};

/*
Expose the model globally so app.js can use it.
*/

window.POPSModels = POPSModels;
