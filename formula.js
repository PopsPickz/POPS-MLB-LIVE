const Formula = {
  powerNames: [
    "Judge", "Ohtani", "Schwarber", "Alonso", "Olson",
    "Devers", "Raleigh", "Guerrero", "Tatis", "Soto",
    "Alvarez", "Marte", "Carroll", "Machado", "Freeman",
    "Betts", "Goodman", "Contreras", "Seager", "Stanton",
    "Harper", "Trout", "Ward", "Langford", "Garcia", "Riley",
    "Acuña", "Lindor", "Turner", "O'Hoppe", "Bellinger",
    "Greene", "Buxton", "Ramírez", "Ramirez"
  ],

  isKnownPowerBat(name = "") {
    return this.powerNames.some(p =>
      name.toLowerCase().includes(p.toLowerCase())
    );
  },

  getLineupBoost(spot = 9) {
    spot = Number(spot);
    if (spot === 3 || spot === 4) return 10;
    if (spot >= 1 && spot <= 5) return 8;
    if (spot >= 6 && spot <= 7) return 5;
    return 2;
  },

  pitcherRisk(stats = {}) {
    const era = Number(stats.era || 0);
    const whip = Number(stats.whip || 0);
    const hrAllowed = Number(stats.homeRuns || 0);
    const innings = Number(stats.inningsPitched || 0);
    const hr9 = innings > 0 ? (hrAllowed * 9) / innings : 0;

    let score = 25;

    if (hr9 >= 1.8) score += 35;
    else if (hr9 >= 1.5) score += 28;
    else if (hr9 >= 1.2) score += 20;
    else if (hr9 >= 1.0) score += 14;
    else if (hr9 >= 0.8) score += 8;

    if (era >= 5) score += 12;
    else if (era >= 4.5) score += 8;
    else if (era >= 4) score += 5;

    if (whip >= 1.45) score += 8;
    else if (whip >= 1.35) score += 5;

    return {
      score: Math.min(100, Math.round(score)),
      hr9,
      era,
      whip,
      hrAllowed
    };
  },

  getHrScore(playerName, lineupSpot, pitcherRisk = {}, extras = {}) {
    let score = 0;
    const reasons = [];
    const stats = extras.batterStats || {};

    const hr = Number(stats.homeRuns || 0);
    const ops = Number(stats.ops || 0);
    const slg = Number(stats.slg || 0);
    const avg = Number(stats.avg || 0);

    const barrelRate = Number(stats.barrelRate || 0);
    const hardHitRate = Number(stats.hardHitRate || 0);
    const exitVelocity = Number(stats.exitVelocity || 0);
    const flyBallRate = Number(stats.flyBallRate || 0);

    const hasStatcast =
      barrelRate > 0 ||
      hardHitRate > 0 ||
      exitVelocity > 0 ||
      flyBallRate > 0;

    const knownPower = this.isKnownPowerBat(playerName);
    const bvpHR = Number(extras.bvpHR || 0);
    const platoon = Boolean(extras.hasPlatoonAdvantage);

    let pitcherScore = Math.round((Number(pitcherRisk.score || 0) / 100) * 25);
    score += pitcherScore;
    reasons.push(`Pitcher HR Risk ${pitcherScore}/25`);

    let powerScore =
      hr >= 35 ? 20 :
      hr >= 25 ? 17 :
      hr >= 18 ? 14 :
      hr >= 12 ? 10 :
      hr >= 6 ? 7 :
      knownPower ? 12 : 4;

    if (knownPower) powerScore += 4;
    powerScore = Math.min(powerScore, 20);
    score += powerScore;
    reasons.push(`HR Power ${powerScore}/20`);

    let contactScore = 0;

    if (hasStatcast) {
      contactScore +=
        barrelRate >= 18 ? 10 :
        barrelRate >= 15 ? 8 :
        barrelRate >= 12 ? 6 :
        barrelRate >= 9 ? 4 :
        barrelRate >= 6 ? 2 : 0;

      contactScore +=
        hardHitRate >= 55 ? 8 :
        hardHitRate >= 50 ? 6 :
        hardHitRate >= 45 ? 4 :
        hardHitRate >= 40 ? 2 : 0;

      contactScore +=
        exitVelocity >= 94 ? 5 :
        exitVelocity >= 92 ? 4 :
        exitVelocity >= 90 ? 3 :
        exitVelocity >= 88 ? 1 : 0;

      contactScore +=
        flyBallRate >= 45 ? 4 :
        flyBallRate >= 40 ? 3 :
        flyBallRate >= 35 ? 2 :
        flyBallRate >= 30 ? 1 : 0;
    } else {
      contactScore =
        knownPower ? 14 :
        hr >= 20 ? 12 :
        hr >= 10 ? 9 :
        ops >= .800 ? 7 : 4;
    }

    contactScore = Math.min(contactScore, 27);
    score += contactScore;
    reasons.push(`Contact Quality ${contactScore}/27`);

    let productionScore = 0;

    if (slg >= .550) productionScore += 6;
    else if (slg >= .500) productionScore += 5;
    else if (slg >= .450) productionScore += 3;
    else if (slg >= .400) productionScore += 1;
    else if (knownPower) productionScore += 3;

    if (ops >= .900) productionScore += 5;
    else if (ops >= .825) productionScore += 4;
    else if (ops >= .775) productionScore += 3;
    else if (ops >= .725) productionScore += 1;
    else if (knownPower) productionScore += 2;

    productionScore = Math.min(productionScore, 11);
    score += productionScore;
    reasons.push(`SLG/OPS ${productionScore}/11`);

    const lineupScore = this.getLineupBoost(lineupSpot);
    score += lineupScore;
    reasons.push(`Lineup ${lineupScore}/10`);

    const platoonScore = platoon ? 5 : 0;
    score += platoonScore;
    reasons.push(`Platoon ${platoonScore}/5`);

    const bvpScore = Math.min(bvpHR * 3, 6);
    score += bvpScore;
    reasons.push(`BvP HR ${bvpScore}/6`);

    let avgScore =
      avg >= .300 ? 3 :
      avg >= .275 ? 2 :
      avg >= .250 ? 1 :
      knownPower ? 1 : 0;

    score += avgScore;
    reasons.push(`AVG ${avgScore}/3`);

    return {
      score: Math.min(100, Math.round(score)),
      reasons: reasons.join(" | ")
    };
  },

  getHitScore(playerName, lineupSpot, hitStreak = 0, previousHR = 0, stats = {}) {
    let score = 65;

    const avg = Number(stats.avg || 0);
    const ops = Number(stats.ops || 0);

    if (avg >= .300) score += 12;
    else if (avg >= .275) score += 9;
    else if (avg >= .250) score += 6;
    else if (avg >= .230) score += 3;

    if (ops >= .850) score += 6;
    else if (ops >= .775) score += 4;

    score += this.getLineupBoost(lineupSpot);

    if (this.isKnownPowerBat(playerName)) score += 4;
    if (hitStreak >= 2) score += Math.min(hitStreak * 2, 10);
    if (previousHR > 0) score += Math.min(previousHR * 3, 10);

    return Math.min(100, Math.round(score));
  }
};