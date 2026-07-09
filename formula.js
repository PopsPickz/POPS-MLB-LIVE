const Formula = {
  num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  },

  pick(stats, names = []) {
    for (const name of names) {
      if (stats[name] !== undefined && stats[name] !== null && stats[name] !== "") {
        return this.num(stats[name]);
      }
    }
    return 0;
  },

  getLineupBoost(spot = 9) {
    spot = Number(spot);
    if (spot >= 1 && spot <= 4) return 7;
    if (spot === 5) return 6;
    if (spot === 6) return 5;
    return 3;
  },

  pitcherRisk(stats = {}) {
    const era = this.num(stats.era);
    const whip = this.num(stats.whip);
    const hrAllowed = this.num(stats.homeRuns || stats.hrAllowed || stats.hr);
    const innings = this.num(stats.inningsPitched || stats.ip);
    const hr9 = this.num(stats.hr9) || (innings > 0 ? (hrAllowed * 9) / innings : 0);

    let score = 5;

    if (hr9 >= 1.8) score = 25;
    else if (hr9 >= 1.5) score = 22;
    else if (hr9 >= 1.2) score = 18;
    else if (hr9 >= 1.0) score = 14;
    else if (hr9 >= 0.8) score = 9;

    if (era >= 5.00) score += 3;
    else if (era >= 4.50) score += 2;
    else if (era >= 4.00) score += 1;

    if (whip >= 1.40) score += 2;

    return {
      score: Math.min(25, Math.round(score)),
      hr9,
      era,
      whip,
      hrAllowed
    };
  },

  getBatterPowerScore(stats = {}) {
    const hr = this.pick(stats, ["homeRuns", "hr", "HR"]);
    const slg = this.pick(stats, ["slg", "slugging", "SLG"]);
    const ops = this.pick(stats, ["ops", "OPS"]);
    const avg = this.pick(stats, ["avg", "AVG"]);
    const iso = this.pick(stats, ["iso", "ISO"]) || (slg && avg ? slg - avg : 0);

    const barrelRate = this.pick(stats, [
      "barrelRate",
      "barrelPercent",
      "barrelPct",
      "barrelsPercent",
      "barrel_percentage",
      "barrel_batted_rate"
    ]);

    const hardHitRate = this.pick(stats, [
      "hardHitRate",
      "hardHitPercent",
      "hardHitPct",
      "hard_hit_percent",
      "hardHitPercentage",
      "hard_hit_rate"
    ]);

    const exitVelocity = this.pick(stats, [
      "exitVelocity",
      "avgExitVelo",
      "avgExitVelocity",
      "averageExitVelocity",
      "launchSpeed",
      "ev"
    ]);

    let score = 0;

    if (hr >= 30) score += 10;
    else if (hr >= 20) score += 8;
    else if (hr >= 15) score += 6;
    else if (hr >= 10) score += 4;
    else if (hr >= 5) score += 2;

    if (slg >= .550) score += 7;
    else if (slg >= .500) score += 6;
    else if (slg >= .460) score += 4;
    else if (slg >= .420) score += 2;

    if (ops >= .900) score += 5;
    else if (ops >= .850) score += 4;
    else if (ops >= .800) score += 3;
    else if (ops >= .750) score += 2;

    if (iso >= .250) score += 5;
    else if (iso >= .220) score += 4;
    else if (iso >= .180) score += 3;
    else if (iso >= .150) score += 1;

    if (barrelRate >= 15) score += 5;
    else if (barrelRate >= 12) score += 4;
    else if (barrelRate >= 9) score += 3;
    else if (barrelRate >= 6) score += 1;

    if (hardHitRate >= 50) score += 2;
    else if (hardHitRate >= 45) score += 1;

    if (exitVelocity >= 93) score += 1;

    return Math.min(35, Math.round(score));
  },

  getHardContactScore(stats = {}) {
    const hardHitRate = this.pick(stats, [
      "hardHitRate",
      "hardHitPercent",
      "hardHitPct",
      "hard_hit_percent",
      "hardHitPercentage",
      "hard_hit_rate"
    ]);

    const barrelRate = this.pick(stats, [
      "barrelRate",
      "barrelPercent",
      "barrelPct",
      "barrelsPercent",
      "barrel_percentage",
      "barrel_batted_rate"
    ]);

    const exitVelocity = this.pick(stats, [
      "exitVelocity",
      "avgExitVelo",
      "avgExitVelocity",
      "averageExitVelocity",
      "launchSpeed",
      "ev"
    ]);

    const flyBallRate = this.pick(stats, [
      "flyBallRate",
      "flyBallPercent",
      "flyBallPct",
      "fbPercent",
      "fbRate",
      "fly_ball_percent"
    ]);

    let score = 0;

    if (hardHitRate >= 50) score += 7;
    else if (hardHitRate >= 45) score += 6;
    else if (hardHitRate >= 40) score += 4;
    else if (hardHitRate >= 35) score += 2;

    if (barrelRate >= 15) score += 5;
    else if (barrelRate >= 12) score += 4;
    else if (barrelRate >= 9) score += 3;
    else if (barrelRate >= 6) score += 1;

    if (exitVelocity >= 94) score += 2;
    else if (exitVelocity >= 91) score += 1;

    if (flyBallRate >= 35 && flyBallRate <= 48) score += 1;

    return Math.min(15, Math.round(score));
  },

  getHrScore(playerName, lineupSpot, pitcherRisk = {}, extras = {}) {
    let score = 0;
    const reasons = [];
    const stats = extras.batterStats || {};

    const bvpHR = this.num(extras.bvpHR);
    const hitStreak = this.num(extras.hitStreak);
    const hasPlatoonAdvantage = Boolean(extras.hasPlatoonAdvantage);

    const powerScore = this.getBatterPowerScore(stats);
    score += powerScore;
    reasons.push(`Batter Power ${powerScore}/35`);

    const pitcherScore = Math.min(this.num(pitcherRisk.score), 25);
    score += pitcherScore;
    reasons.push(`Pitcher HR Risk ${pitcherScore}/25`);

    const hardContactScore = this.getHardContactScore(stats);
    score += hardContactScore;
    reasons.push(`Hard Contact ${hardContactScore}/15`);

    const platoonScore = hasPlatoonAdvantage ? 10 : 0;
    score += platoonScore;
    reasons.push(`Platoon ${platoonScore}/10`);

    const lineupScore = this.getLineupBoost(lineupSpot);
    score += lineupScore;
    reasons.push(`Lineup Spot ${lineupScore}/7`);

    const bvpScore = Math.min(bvpHR * 3, 5);
    score += bvpScore;
    reasons.push(`Previous HR vs Pitcher ${bvpScore}/5`);

    const formScore =
      hitStreak >= 8 ? 3 :
      hitStreak >= 5 ? 2 :
      hitStreak >= 3 ? 1 : 0;

    score += formScore;
    reasons.push(`Recent Form ${formScore}/3`);

    return {
      score: Math.min(100, Math.round(score)),
      reasons: reasons.join(" | ")
    };
  },

  getHitScore(playerName, lineupSpot, hitStreak = 0, previousHR = 0, stats = {}) {
    let score = 65;

    const avg = this.pick(stats, ["avg", "AVG"]);
    const ops = this.pick(stats, ["ops", "OPS"]);

    if (avg >= .300) score += 12;
    else if (avg >= .275) score += 9;
    else if (avg >= .250) score += 6;
    else if (avg >= .230) score += 3;

    if (ops >= .850) score += 6;
    else if (ops >= .775) score += 4;

    score += this.getLineupBoost(lineupSpot);

    if (hitStreak >= 2) score += Math.min(hitStreak * 2, 10);
    if (previousHR > 0) score += Math.min(previousHR * 3, 10);

    return Math.min(100, Math.round(score));
  }
};