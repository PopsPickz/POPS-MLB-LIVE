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

  pct(value) {
    return this.num(value);
  },

  pick(stats = {}, names = []) {
    for (const key of names) {
      if (
        stats[key] !== undefined &&
        stats[key] !== null &&
        stats[key] !== ""
      ) {
        return this.num(stats[key]);
      }
    }

    return 0;
  },

  /*
  =========================================================
  LINEUP BONUS
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

    const era =
      this.pick(stats, ["era"]);

    const whip =
      this.pick(stats, ["whip"]);

    const hr =
      this.pick(stats, [
        "homeRuns",
        "hrAllowed"
      ]);

    const innings =
      this.pick(stats, [
        "inningsPitched",
        "ip"
      ]);

    const hr9 =
      innings > 0
        ? (hr * 9) / innings
        : this.pick(stats, [
            "homeRunsPer9",
            "hr9"
          ]);

    let score = 0;

    if (hr9 >= 2.0) score += 15;
    else if (hr9 >= 1.7) score += 13;
    else if (hr9 >= 1.4) score += 11;
    else if (hr9 >= 1.2) score += 9;
    else if (hr9 >= 1.0) score += 7;
    else score += 4;

    if (era >= 5.50) score += 6;
    else if (era >= 5.00) score += 5;
    else if (era >= 4.50) score += 4;
    else if (era >= 4.00) score += 3;

    if (whip >= 1.50) score += 4;
    else if (whip >= 1.40) score += 3;
    else if (whip >= 1.30) score += 2;

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

    const hr =
      this.pick(stats, ["homeRuns"]);

    const iso =
      this.pick(stats, ["iso"]);

    const slg =
      this.pick(stats, ["slg"]);

    const ops =
      this.pick(stats, ["ops"]);

    const hrRate =
      this.pick(stats, [
        "hrRate"
      ]);

    const xbhRate =
      this.pick(stats, [
        "extraBaseHitRate"
      ]);

    let score = 0;

    if (hr >= 35) score += 8;
    else if (hr >= 30) score += 7;
    else if (hr >= 25) score += 6;
    else if (hr >= 20) score += 5;
    else if (hr >= 15) score += 4;

    if (iso >= .280) score += 6;
    else if (iso >= .240) score += 5;
    else if (iso >= .200) score += 4;
    else if (iso >= .170) score += 3;

    if (slg >= .600) score += 4;
    else if (slg >= .550) score += 3;
    else if (slg >= .500) score += 2;

    if (ops >= .950) score += 3;
    else if (ops >= .900) score += 2;
    else if (ops >= .850) score += 1;

    if (hrRate >= .070) score += 2;
    else if (hrRate >= .055) score += 1;

    if (xbhRate >= .130) score += 2;

    return this.clamp(
      Math.round(score),
      0,
      25
    );
  },

  /*
  =========================================================
  STATCAST (15)
  =========================================================
  */

  statcastScore(statcast = {}) {

    const barrel =
      this.pick(statcast, [
        "barrelRate",
        "barrelPct"
      ]);

    const hardHit =
      this.pick(statcast, [
        "hardHitRate",
        "hardHitPct"
      ]);

    const exitVelo =
      this.pick(statcast, [
        "avgExitVelo",
        "avgExitVelocity",
        "exitVelocity"
      ]);

    let score = 0;

    if (barrel >= 18) score += 7;
    else if (barrel >= 15) score += 6;
    else if (barrel >= 12) score += 5;
    else if (barrel >= 9) score += 4;
    else if (barrel >= 6) score += 2;

    if (hardHit >= 55) score += 5;
    else if (hardHit >= 50) score += 4;
    else if (hardHit >= 45) score += 3;
    else if (hardHit >= 40) score += 2;

    if (exitVelo >= 94) score += 3;
    else if (exitVelo >= 92) score += 2;
    else if (exitVelo >= 90) score += 1;

    return this.clamp(
      Math.round(score),
      0,
      15
    );
  },

  /*
  =========================================================
  RECENT FORM (10)
  =========================================================
  */

  recentFormScore(recent = {}) {

    const hr = this.pick(recent, ["homeRuns"]);
    const iso = this.pick(recent, ["iso"]);
    const ops = this.pick(recent, ["ops"]);
    const xbh = this.pick(recent, ["extraBaseHits"]);

    let score = 0;

    if (hr >= 5) score += 4;
    else if (hr >= 4) score += 3;
    else if (hr >= 2) score += 2;
    else if (hr >= 1) score += 1;

    if (iso >= .300) score += 3;
    else if (iso >= .240) score += 2;
    else if (iso >= .180) score += 1;

    if (ops >= 1.000) score += 2;
    else if (ops >= .900) score += 1;

    if (xbh >= 6) score += 1;

    return this.clamp(score, 0, 10);
  },

  /*
  =========================================================
  HANDEDNESS SPLIT (10)
  =========================================================
  */

  handednessScore(split = {}, platoonEdge = false) {

    if (!split || Object.keys(split).length === 0) {
      return platoonEdge ? 6 : 4;
    }

    const ops =
      this.pick(split, [
        "ops",
        "OPS"
      ]);

    let score = platoonEdge ? 4 : 2;

    if (ops >= .950) score += 6;
    else if (ops >= .900) score += 5;
    else if (ops >= .850) score += 4;
    else if (ops >= .800) score += 3;
    else if (ops >= .750) score += 2;

    return this.clamp(score, 0, 10);
  },

  /*
  =========================================================
  LAUNCH PROFILE (7)
  =========================================================
  */

  launchProfileScore(statcast = {}) {

    const launch =
      this.pick(statcast, [
        "launchAngle"
      ]);

    const fly =
      this.pick(statcast, [
        "flyBallRate",
        "flyBallPct"
      ]);

    const sweet =
      this.pick(statcast, [
        "sweetSpotRate",
        "sweetSpotPct"
      ]);

    let score = 0;

    if (launch >= 15 && launch <= 22)
      score += 3;
    else if (launch >= 12 && launch <= 25)
      score += 2;

    if (fly >= 40)
      score += 2;
    else if (fly >= 34)
      score += 1;

    if (sweet >= 36)
      score += 2;
    else if (sweet >= 30)
      score += 1;

    return this.clamp(score, 0, 7);
  },

  /*
  =========================================================
  BVP (3)
  =========================================================
  */

  bvpScore(bvp = {}) {

    const hr =
      this.pick(bvp, [
        "homeRuns"
      ]);

    if (hr >= 2) return 3;
    if (hr === 1) return 2;

    const hits =
      this.pick(bvp, [
        "hits"
      ]);

    if (hits >= 3) return 1;

    return 0;
  },

  /*
  =========================================================
  CONFIDENCE ENGINE
  =========================================================
  */

  confidence(result = {}) {

    let score = 50;

    if (result.power >= 18) score += 10;
    if (result.pitcher >= 18) score += 10;
    if (result.statcast >= 10) score += 10;
    if (result.recent >= 6) score += 8;
    if (result.launch >= 5) score += 5;
    if (result.lineup >= 4) score += 4;
    if (result.bvp >= 2) score += 3;

    score = this.clamp(score, 0, 100);

    let label = "Low";

    if (score >= 90)
      label = "Elite";

    else if (score >= 80)
      label = "High";

    else if (score >= 70)
      label = "Medium";

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

  formatBreakdown(parts) {

    return [

      {
        icon:"💣",
        label:"Batter Power",
        score:parts.power,
        max:25
      },

      {
        icon:"🎯",
        label:"Pitcher HR Risk",
        score:parts.pitcher,
        max:25
      },

      {
        icon:"🔥",
        label:"Statcast",
        score:parts.statcast,
        max:15
      },

      {
        icon:"📈",
        label:"Recent Form",
        score:parts.recent,
        max:10
      },

      {
        icon:"⚔️",
        label:"Handedness",
        score:parts.handedness,
        max:10
      },

      {
        icon:"🚀",
        label:"Launch Profile",
        score:parts.launch,
        max:7
      },

      {
        icon:"📍",
        label:"Lineup",
        score:parts.lineup,
        max:5
      },

      {
        icon:"🆚",
        label:"BvP",
        score:parts.bvp,
        max:3
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

    const hitting = batter.hitting || {};
    const statcast = batter.statcast || {};
    const bvp = batter.bvp || {};

    const platoonEdge =
      batter.batSide === "S" ||
      (batter.batSide === "L" && pitcherHand === "R") ||
      (batter.batSide === "R" && pitcherHand === "L");

    const parts = {

      power:
        this.batterPower(hitting),

      pitcher:
        this.pitcherRisk(pitcher),

      statcast:
        this.statcastScore(statcast),

      recent:
        this.recentFormScore(recentForm),

      handedness:
        this.handednessScore(
          handednessSplit,
          platoonEdge
        ),

      launch:
        this.launchProfileScore(statcast),

      lineup:
        this.getLineupScore(
          batter.lineupSpot
        ),

      bvp:
        this.bvpScore(bvp)

    };

    const score =
      parts.power +
      parts.pitcher +
      parts.statcast +
      parts.recent +
      parts.handedness +
      parts.launch +
      parts.lineup +
      parts.bvp;

    let tier =
      "🟢 Strong";

    if (score >= 95)
      tier = "👑 Elite";

    else if (score >= 90)
      tier = "🔥 Excellent";

    else if (score >= 85)
      tier = "🟢 Very Strong";

    else if (score >= 80)
      tier = "🟢 Strong";

    else if (score >= 75)
      tier = "🟡 Good";

    else if (score >= 70)
      tier = "🟠 Fair";

    else
      tier = "⚪ Longshot";

    return {

      score,

      tier,

      confidence:
        this.confidence(parts),

      breakdown:
        parts

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

    const avg =
      this.pick(stats, [
        "avg"
      ]);

    const ops =
      this.pick(stats, [
        "ops"
      ]);

    const recentOPS =
      this.pick(
        stats.recentForm || {},
        ["ops"]
      );

    if (avg >= .320)
      score += 15;

    else if (avg >= .300)
      score += 12;

    else if (avg >= .280)
      score += 9;

    else if (avg >= .260)
      score += 6;

    if (ops >= .950)
      score += 8;

    else if (ops >= .900)
      score += 6;

    else if (ops >= .850)
      score += 4;

    if (recentOPS >= .950)
      score += 5;

    score += this.getLineupScore(
      lineupSpot
    );

    if (hitStreak >= 10)
      score += 10;

    else if (hitStreak >= 7)
      score += 8;

    else if (hitStreak >= 5)
      score += 6;

    else if (hitStreak >= 3)
      score += 4;

    if (previousHR > 0)
      score += Math.min(
        previousHR * 2,
        6
      );

    return this.clamp(
      Math.round(score),
      0,
      100
    );

  }

};
