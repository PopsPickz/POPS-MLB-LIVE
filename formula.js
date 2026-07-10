const Formula = {
  /*
  =========================================================
  GENERAL HELPERS
  =========================================================
  */

  num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  },

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  pick(stats = {}, names = []) {
    for (const key of names) {
      if (
        stats[key] !== undefined &&
        stats[key] !== null &&
        stats[key] !== ""
      ) {
        const value = Number(
          String(stats[key]).replace("%", "")
        );

        if (Number.isFinite(value)) {
          return value;
        }
      }
    }

    return 0;
  },

  hasMetric(stats = {}, names = []) {
    return names.some(key => {
      const value = stats?.[key];

      return (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        Number.isFinite(
          Number(String(value).replace("%", ""))
        )
      );
    });
  },

  /*
  =========================================================
  LINEUP SCORE (5)
  =========================================================
  */

  getLineupScore(spot = 9) {
    spot = Number(spot);

    if (spot === 3 || spot === 4) return 5;
    if (spot === 2 || spot === 5) return 4;
    if (spot === 1) return 3;
    if (spot === 6) return 2;

    return 1;
  },

  /*
  =========================================================
  PITCHER HR RISK (25)
  =========================================================
  */

  pitcherRisk(stats = {}) {
    const era = this.pick(stats, ["era"]);
    const whip = this.pick(stats, ["whip"]);

    const homeRuns = this.pick(stats, [
      "homeRuns",
      "hrAllowed",
      "hr"
    ]);

    const innings = this.pick(stats, [
      "inningsPitched",
      "ip"
    ]);

    let hr9 = this.pick(stats, [
      "homeRunsPer9",
      "hr9"
    ]);

    if (!hr9 && innings > 0) {
      hr9 = (homeRuns * 9) / innings;
    }

    let score = 0;

    if (hr9 >= 2.0) score += 15;
    else if (hr9 >= 1.7) score += 13;
    else if (hr9 >= 1.4) score += 11;
    else if (hr9 >= 1.2) score += 9;
    else if (hr9 >= 1.0) score += 7;
    else if (hr9 > 0) score += 4;

    if (era >= 5.50) score += 6;
    else if (era >= 5.00) score += 5;
    else if (era >= 4.50) score += 4;
    else if (era >= 4.00) score += 3;
    else if (era > 0) score += 1;

    if (whip >= 1.50) score += 4;
    else if (whip >= 1.40) score += 3;
    else if (whip >= 1.30) score += 2;
    else if (whip > 0) score += 1;

    return this.clamp(
      Math.round(score),
      0,
      25
    );
  },

  /*
  =========================================================
  BATTER POWER (25)
  =========================================================
  */

  batterPower(stats = {}) {
    const homeRuns = this.pick(stats, [
      "homeRuns"
    ]);

    const avg = this.pick(stats, ["avg"]);
    const slg = this.pick(stats, ["slg"]);
    const ops = this.pick(stats, ["ops"]);

    let iso = this.pick(stats, ["iso"]);

    if (!iso && slg > 0) {
      iso = Math.max(0, slg - avg);
    }

    const plateAppearances = this.pick(stats, [
      "plateAppearances"
    ]);

    const atBats = this.pick(stats, [
      "atBats"
    ]);

    const denominator =
      plateAppearances || atBats;

    let hrRate = this.pick(stats, [
      "hrRate"
    ]);

    if (!hrRate && denominator > 0) {
      hrRate = homeRuns / denominator;
    }

    const doubles = this.pick(stats, [
      "doubles"
    ]);

    const triples = this.pick(stats, [
      "triples"
    ]);

    const extraBaseHits =
      this.pick(stats, ["extraBaseHits"]) ||
      doubles + triples + homeRuns;

    let xbhRate = this.pick(stats, [
      "extraBaseHitRate"
    ]);

    if (!xbhRate && denominator > 0) {
      xbhRate = extraBaseHits / denominator;
    }

    let score = 0;

    if (homeRuns >= 35) score += 8;
    else if (homeRuns >= 30) score += 7;
    else if (homeRuns >= 25) score += 6;
    else if (homeRuns >= 20) score += 5;
    else if (homeRuns >= 15) score += 4;
    else if (homeRuns >= 10) score += 3;
    else if (homeRuns >= 5) score += 2;

    if (iso >= 0.280) score += 6;
    else if (iso >= 0.240) score += 5;
    else if (iso >= 0.200) score += 4;
    else if (iso >= 0.170) score += 3;
    else if (iso >= 0.140) score += 2;

    if (slg >= 0.600) score += 4;
    else if (slg >= 0.550) score += 3;
    else if (slg >= 0.500) score += 2;
    else if (slg >= 0.450) score += 1;

    if (ops >= 0.950) score += 3;
    else if (ops >= 0.900) score += 2;
    else if (ops >= 0.850) score += 1;

    if (hrRate >= 0.070) score += 2;
    else if (hrRate >= 0.050) score += 1;

    if (xbhRate >= 0.130) score += 2;
    else if (xbhRate >= 0.100) score += 1;

    return this.clamp(
      Math.round(score),
      0,
      25
    );
  },

  /*
  =========================================================
  STATCAST SCORE (15)
  =========================================================
  */

  statcastScore(statcast = {}) {
    const barrel = this.pick(statcast, [
      "barrelRate",
      "barrelPct"
    ]);

    const hardHit = this.pick(statcast, [
      "hardHitRate",
      "hardHitPct"
    ]);

    const exitVelocity = this.pick(statcast, [
      "avgExitVelo",
      "avgExitVelocity",
      "exitVelocity"
    ]);

    const hasBarrel = this.hasMetric(statcast, [
      "barrelRate",
      "barrelPct"
    ]);

    const hasHardHit = this.hasMetric(statcast, [
      "hardHitRate",
      "hardHitPct"
    ]);

    const hasExitVelocity = this.hasMetric(
      statcast,
      [
        "avgExitVelo",
        "avgExitVelocity",
        "exitVelocity"
      ]
    );

    if (
      !hasBarrel &&
      !hasHardHit &&
      !hasExitVelocity
    ) {
      return 0;
    }

    let score = 0;

    if (barrel >= 18) score += 7;
    else if (barrel >= 15) score += 6;
    else if (barrel >= 12) score += 5;
    else if (barrel >= 9) score += 4;
    else if (barrel >= 6) score += 2;
    else if (hasBarrel) score += 1;

    if (hardHit >= 55) score += 5;
    else if (hardHit >= 50) score += 4;
    else if (hardHit >= 45) score += 3;
    else if (hardHit >= 40) score += 2;
    else if (hasHardHit) score += 1;

    if (exitVelocity >= 94) score += 3;
    else if (exitVelocity >= 92) score += 2;
    else if (exitVelocity >= 90) score += 1;

    return this.clamp(
      Math.round(score),
      0,
      15
    );
  },

  /*
  =========================================================
  RECENT FORM — LAST 10 GAMES (10)
  =========================================================
  */

  recentFormScore(recent = {}) {
    const games = this.pick(recent, [
      "games"
    ]);

    const homeRuns = this.pick(recent, [
      "homeRuns",
      "hrLast10",
      "last10HR"
    ]);

    const iso = this.pick(recent, [
      "iso"
    ]);

    const ops = this.pick(recent, [
      "ops"
    ]);

    const extraBaseHits = this.pick(recent, [
      "extraBaseHits",
      "xbh"
    ]);

    if (
      games === 0 &&
      homeRuns === 0 &&
      iso === 0 &&
      ops === 0 &&
      extraBaseHits === 0
    ) {
      return 0;
    }

    let score = 0;

    if (homeRuns >= 5) score += 4;
    else if (homeRuns >= 4) score += 3;
    else if (homeRuns >= 2) score += 2;
    else if (homeRuns >= 1) score += 1;

    if (iso >= 0.300) score += 3;
    else if (iso >= 0.240) score += 2;
    else if (iso >= 0.180) score += 1;

    if (ops >= 1.000) score += 2;
    else if (ops >= 0.900) score += 1;

    if (extraBaseHits >= 6) score += 1;

    return this.clamp(
      Math.round(score),
      0,
      10
    );
  },

  /*
  =========================================================
  HANDEDNESS SCORE (10)
  =========================================================
  */

  handednessScore(
    split = {},
    platoonEdge = false
  ) {
    const hasSplitData =
      split &&
      typeof split === "object" &&
      Object.keys(split).length > 0;

    if (!hasSplitData) {
      return platoonEdge ? 6 : 4;
    }

    const ops = this.pick(split, [
      "ops",
      "OPS"
    ]);

    let score = platoonEdge ? 4 : 2;

    if (ops >= 0.950) score += 6;
    else if (ops >= 0.900) score += 5;
    else if (ops >= 0.850) score += 4;
    else if (ops >= 0.800) score += 3;
    else if (ops >= 0.750) score += 2;

    return this.clamp(
      Math.round(score),
      0,
      10
    );
  },

  /*
  =========================================================
  LAUNCH PROFILE (7)
  =========================================================
  */

  launchProfileScore(statcast = {}) {
    const launchAngle = this.pick(statcast, [
      "launchAngle",
      "avgLaunchAngle"
    ]);

    const flyBallRate = this.pick(statcast, [
      "flyBallRate",
      "flyBallPct"
    ]);

    const sweetSpotRate = this.pick(statcast, [
      "sweetSpotRate",
      "sweetSpotPct"
    ]);

    const hasLaunch = this.hasMetric(statcast, [
      "launchAngle",
      "avgLaunchAngle"
    ]);

    const hasFlyBall = this.hasMetric(statcast, [
      "flyBallRate",
      "flyBallPct"
    ]);

    const hasSweetSpot = this.hasMetric(
      statcast,
      [
        "sweetSpotRate",
        "sweetSpotPct"
      ]
    );

    if (
      !hasLaunch &&
      !hasFlyBall &&
      !hasSweetSpot
    ) {
      return 0;
    }

    let score = 0;

    /*
    Launch angle contributes up to 3 points.
    */
    if (hasLaunch) {
      if (
        launchAngle >= 15 &&
        launchAngle <= 22
      ) {
        score += 3;
      } else if (
        launchAngle >= 12 &&
        launchAngle <= 25
      ) {
        score += 2;
      } else if (
        launchAngle >= 8 &&
        launchAngle <= 30
      ) {
        score += 1;
      }
    }

    /*
    Fly-ball rate contributes up to 2 points.
    Your current Statcast API already supplies this.
    */
    if (flyBallRate >= 40) score += 2;
    else if (flyBallRate >= 34) score += 1;

    /*
    Sweet-spot rate contributes up to 2 points.
    */
    if (sweetSpotRate >= 36) score += 2;
    else if (sweetSpotRate >= 30) score += 1;

    return this.clamp(
      Math.round(score),
      0,
      7
    );
  },

  /*
  =========================================================
  BVP SCORE (3)
  =========================================================
  */

  bvpScore(bvp = {}) {
    const homeRuns = this.pick(bvp, [
      "homeRuns",
      "hr"
    ]);

    const hits = this.pick(bvp, [
      "hits"
    ]);

    if (homeRuns >= 2) return 3;
    if (homeRuns === 1) return 2;
    if (hits >= 3) return 1;

    return 0;
  },

  /*
  =========================================================
  CONFIDENCE ENGINE
  =========================================================
  */

  confidence(parts = {}, data = {}) {
    let score = 45;

    if (parts.power >= 18) score += 10;
    else if (parts.power >= 14) score += 6;

    if (parts.pitcher >= 18) score += 10;
    else if (parts.pitcher >= 14) score += 6;

    if (parts.statcast >= 10) score += 9;
    else if (parts.statcast >= 6) score += 5;

    if (parts.recent >= 6) score += 8;
    else if (parts.recent >= 3) score += 4;

    if (parts.handedness >= 7) score += 5;

    if (parts.launch >= 5) score += 5;
    else if (parts.launch >= 2) score += 2;

    if (parts.lineup >= 4) score += 4;

    if (parts.bvp >= 2) score += 3;

    /*
    Avoid presenting incomplete data as elite confidence.
    */
    if (!data.hasStatcastData) {
      score -= 5;
    }

    if (!data.hasRecentData) {
      score -= 5;
    }

    score = this.clamp(
      Math.round(score),
      0,
      100
    );

    let label = "Low";

    if (score >= 90) {
      label = "Elite";
    } else if (score >= 80) {
      label = "High";
    } else if (score >= 70) {
      label = "Medium";
    }

    return {
      score,
      label
    };
  },

  /*
  =========================================================
  BREAKDOWN FORMATTER
  =========================================================
  */

  formatBreakdown(parts = {}) {
    return [
      {
        icon: "💣",
        label: "Batter Power",
        score: parts.power,
        max: 25
      },
      {
        icon: "🎯",
        label: "Pitcher HR Risk",
        score: parts.pitcher,
        max: 25
      },
      {
        icon: "🔥",
        label: "Statcast",
        score: parts.statcast,
        max: 15
      },
      {
        icon: "📈",
        label: "Recent Form",
        score: parts.recent,
        max: 10
      },
      {
        icon: "⚔️",
        label: "Handedness",
        score: parts.handedness,
        max: 10
      },
      {
        icon: "🚀",
        label: "Launch Profile",
        score: parts.launch,
        max: 7
      },
      {
        icon: "📍",
        label: "Lineup",
        score: parts.lineup,
        max: 5
      },
      {
        icon: "🆚",
        label: "BvP",
        score: parts.bvp,
        max: 3
      }
    ];
  },

  /*
  =========================================================
  POPS HR SCORE (100)
  =========================================================
  */

  getHRScore({
    batter = {},
    pitcher = {},
    pitcherHand = "",
    handednessSplit = {},
    recentForm = {}
  } = {}) {
    const hitting =
      batter.hitting || {};

    const statcast =
      batter.statcast || {};

    const bvp =
      batter.bvp || {};

    /*
    Use the explicitly supplied recent form first.
    Fall back to batter.recentForm.
    */
    const finalRecentForm =
      recentForm &&
      Object.keys(recentForm).length
        ? recentForm
        : batter.recentForm || {};

    const finalHandednessSplit =
      handednessSplit &&
      Object.keys(handednessSplit).length
        ? handednessSplit
        : batter.handednessSplit || {};

    const batterHand = String(
      batter.batSide || ""
    ).toUpperCase();

    const opposingHand = String(
      pitcherHand || ""
    ).toUpperCase();

    const platoonEdge =
      batterHand === "S" ||
      (
        batterHand === "L" &&
        opposingHand === "R"
      ) ||
      (
        batterHand === "R" &&
        opposingHand === "L"
      );

    const parts = {
      power:
        this.batterPower(hitting),

      pitcher:
        this.pitcherRisk(pitcher),

      statcast:
        this.statcastScore(statcast),

      recent:
        this.recentFormScore(
          finalRecentForm
        ),

      handedness:
        this.handednessScore(
          finalHandednessSplit,
          platoonEdge
        ),

      launch:
        this.launchProfileScore(
          statcast
        ),

      lineup:
        this.getLineupScore(
          batter.lineupSpot
        ),

      bvp:
        this.bvpScore(bvp)
    };

    const score = this.clamp(
      Math.round(
        parts.power +
        parts.pitcher +
        parts.statcast +
        parts.recent +
        parts.handedness +
        parts.launch +
        parts.lineup +
        parts.bvp
      ),
      0,
      100
    );

    let tier = "⚪ Longshot";

    if (score >= 95) {
      tier = "👑 Elite";
    } else if (score >= 90) {
      tier = "🔥 Excellent";
    } else if (score >= 85) {
      tier = "🟢 Very Strong";
    } else if (score >= 80) {
      tier = "🟢 Strong";
    } else if (score >= 75) {
      tier = "🟡 Good";
    } else if (score >= 70) {
      tier = "🟠 Fair";
    }

    const hasStatcastData =
      this.hasMetric(statcast, [
        "barrelRate",
        "barrelPct",
        "hardHitRate",
        "hardHitPct",
        "avgExitVelo",
        "avgExitVelocity",
        "exitVelocity"
      ]);

    const hasRecentData =
      this.hasMetric(finalRecentForm, [
        "games",
        "homeRuns",
        "ops",
        "iso",
        "extraBaseHits"
      ]);

    return {
      score,
      tier,

      confidence:
        this.confidence(
          parts,
          {
            hasStatcastData,
            hasRecentData
          }
        ),

      breakdown:
        this.formatBreakdown(parts),

      rawBreakdown:
        parts,

      dataAvailability: {
        statcast: hasStatcastData,
        recentForm: hasRecentData,
        launchProfile:
          this.hasMetric(statcast, [
            "launchAngle",
            "avgLaunchAngle",
            "flyBallRate",
            "flyBallPct",
            "sweetSpotRate",
            "sweetSpotPct"
          ])
      }
    };
  },

  /*
  =========================================================
  HIT SCORE
  =========================================================
  */

  getHitScore(
    playerName,
    lineupSpot,
    hitStreak = 0,
    previousHR = 0,
    stats = {}
  ) {
    let score = 60;

    const avg = this.pick(stats, [
      "avg"
    ]);

    const ops = this.pick(stats, [
      "ops"
    ]);

    const recentOPS = this.pick(
      stats.recentForm || {},
      ["ops"]
    );

    if (avg >= 0.320) score += 15;
    else if (avg >= 0.300) score += 12;
    else if (avg >= 0.280) score += 9;
    else if (avg >= 0.260) score += 6;

    if (ops >= 0.950) score += 8;
    else if (ops >= 0.900) score += 6;
    else if (ops >= 0.850) score += 4;

    if (recentOPS >= 0.950) {
      score += 5;
    }

    score += this.getLineupScore(
      lineupSpot
    );

    if (hitStreak >= 10) score += 10;
    else if (hitStreak >= 7) score += 8;
    else if (hitStreak >= 5) score += 6;
    else if (hitStreak >= 3) score += 4;

    if (previousHR > 0) {
      score += Math.min(
        previousHR * 2,
        6
      );
    }

    return this.clamp(
      Math.round(score),
      0,
      100
    );
  }
};

window.Formula = Formula;