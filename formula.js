const Formula = {
  powerNames: [
    "Judge", "Ohtani", "Schwarber", "Alonso", "Olson",
    "Devers", "Raleigh", "Guerrero", "Tatis", "Soto",
    "Alvarez", "Marte", "Carroll", "Machado", "Freeman",
    "Betts", "Goodman", "Contreras", "Seager", "Stanton",
    "Harper", "Trout", "Ward", "Langford", "Garcia", "Riley",
    "Acuña", "Lindor", "Turner", "O'Hoppe", "Bellinger",
    "Greene", "Buxton", "Ramírez", "Ramirez", "Crow-Armstrong"
  ],

  isKnownPowerBat(name = "") {
    return this.powerNames.some(p =>
      name.toLowerCase().includes(p.toLowerCase())
    );
  },

  getLineupBoost(spot = 9) {
    spot = Number(spot);
    if (spot >= 1 && spot <= 4) return 8;
    if (spot === 5) return 6;
    if (spot === 6) return 5;
    return 3;
  },

  pitcherRisk(stats = {}) {
    const era = Number(stats.era || 0);
    const whip = Number(stats.whip || 0);
    const hrAllowed = Number(stats.homeRuns || 0);
    const innings = Number(stats.inningsPitched || 0);
    const hr9 = innings > 0 ? (hrAllowed * 9) / innings : 0;

    let score = 0;

    if (hr9 >= 1.8) score += 35;
    else if (hr9 >= 1.5) score += 30;
    else if (hr9 >= 1.2) score += 25;
    else if (hr9 >= 1.0) score += 18;
    else if (hr9 >= 0.8) score += 10;
    else score += 5;

    return {
      score: Math.min(35, Math.round(score)),
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

    const barrelRate = Number(stats.barrelRate || 0);
    const hardHitRate = Number(stats.hardHitRate || 0);
    const recentHardHitRate = Number(stats.recentHardHitRate || hardHitRate || 0);

    const bvpHR = Number(extras.bvpHR || 0);
    const hitStreak = Number(extras.hitStreak || 0);
    const hasPlatoonAdvantage = Boolean(extras.hasPlatoonAdvantage);
    const knownPower = this.isKnownPowerBat(playerName);

    const pitcherScore = Math.min(Number(pitcherRisk.score || 0), 35);
    score += pitcherScore;
    reasons.push(`Pitcher HR Risk ${pitcherScore}/35`);

    let powerScore =
      barrelRate >= 15 ? 25 :
      barrelRate >= 12 ? 20 :
      barrelRate >= 9 ? 15 :
      barrelRate >= 6 ? 10 :
      knownPower ? 20 : 5;

    score += powerScore;
    reasons.push(`Batter Power ${powerScore}/25`);

    const hardContactScore =
      hardHitRate >= 50 ? 15 :
      hardHitRate >= 45 ? 12 :
      hardHitRate >= 40 ? 9 :
      hardHitRate >= 35 ? 6 :
      knownPower ? 8 : 3;

    score += hardContactScore;
    reasons.push(`Hard Contact ${hardContactScore}/15`);

    const platoonScore = hasPlatoonAdvantage ? 10 : 0;
    score += platoonScore;
    reasons.push(`Platoon ${platoonScore}/10`);

    const lineupScore = this.getLineupBoost(lineupSpot);
    score += lineupScore;
    reasons.push(`Lineup Spot ${lineupScore}/8`);

    const recentContactScore =
      recentHardHitRate >= 50 ? 7 :
      recentHardHitRate >= 45 ? 5 :
      recentHardHitRate >= 40 ? 3 :
      knownPower ? 3 : 0;

    score += recentContactScore;
    reasons.push(`Recent Quality Contact ${recentContactScore}/7`);

    const bvpScore = Math.min(bvpHR * 3, 6);
    score += bvpScore;
    reasons.push(`Previous HR vs Pitcher ${bvpScore}/6`);

    const hitStreakScore =
      hitStreak >= 8 ? 5 :
      hitStreak >= 5 ? 4 :
      hitStreak >= 3 ? 3 :
      hitStreak >= 2 ? 2 : 0;

    score += hitStreakScore;
    reasons.push(`Hit Streak Bonus ${hitStreakScore}/5`);

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