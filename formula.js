const Formula = {
  powerNames: [
    "Judge", "Ohtani", "Schwarber", "Alonso", "Olson",
    "Devers", "Raleigh", "Guerrero", "Tatis", "Soto",
    "Alvarez", "Marte", "Carroll", "Machado", "Freeman",
    "Betts", "Goodman", "Contreras", "Seager", "Stanton",
    "Harper", "Trout", "Ward", "Langford", "Garcia", "Riley",
    "Acuña", "Lindor", "Turner", "O'Hoppe", "Bellinger",
    "Greene", "Suwinski", "Buxton", "Robert", "Ramírez", "Ramirez"
  ],

  isKnownPowerBat(name) {
    if (!name) return false;
    return this.powerNames.some(powerName =>
      name.toLowerCase().includes(powerName.toLowerCase())
    );
  },

  getLineupBoost(lineupSpot) {
    const spot = Number(lineupSpot || 9);
    if (spot === 3 || spot === 4) return 8;
    if (spot >= 1 && spot <= 5) return 6;
    if (spot >= 6 && spot <= 7) return 4;
    return 2;
  },

  getHrScore(playerName, lineupSpot, pitcherRisk = {}, extras = {}) {
    let score = 0;
    let reasons = [];

    const hr9 = Number(pitcherRisk.hr9 || pitcherRisk.homerunsPer9 || 0);
    const batterStats = extras.batterStats || {};

    const barrelRate = Number(batterStats.barrelRate || extras.barrelRate || 0);
    const hardHitRate = Number(batterStats.hardHitRate || extras.hardHitRate || 0);
    const recentHardHitRate = Number(
      batterStats.recentHardHitRate || extras.recentHardHitRate || hardHitRate || 0
    );

    const bvpHR = Number(extras.bvpHR || extras.previousHRvsPitcher || 0);
    const hitStreak = Number(extras.hitStreak || 0);

    let pitcherScore =
      hr9 >= 1.8 ? 35 :
      hr9 >= 1.5 ? 30 :
      hr9 >= 1.2 ? 25 :
      hr9 >= 1.0 ? 18 :
      hr9 >= 0.8 ? 10 : 5;

    score += pitcherScore;
    reasons.push(`Pitcher HR Risk ${pitcherScore}/35`);

    let powerScore =
      barrelRate >= 15 ? 25 :
      barrelRate >= 12 ? 20 :
      barrelRate >= 9 ? 15 :
      barrelRate >= 6 ? 10 : 5;

    if (this.isKnownPowerBat(playerName)) powerScore += 5;
    powerScore = Math.min(powerScore, 25);

    score += powerScore;
    reasons.push(`Batter Power ${powerScore}/25`);

    let contactScore =
      hardHitRate >= 50 ? 15 :
      hardHitRate >= 45 ? 12 :
      hardHitRate >= 40 ? 9 :
      hardHitRate >= 35 ? 6 : 3;

    score += contactScore;
    reasons.push(`Hard Contact ${contactScore}/15`);

    let platoonScore = extras.hasPlatoonAdvantage ? 10 : 0;
    score += platoonScore;
    reasons.push(`Platoon ${platoonScore}/10`);

    let lineupScore = this.getLineupBoost(lineupSpot);
    score += lineupScore;
    reasons.push(`Lineup Spot ${lineupScore}/8`);

    let recentContactScore =
      recentHardHitRate >= 50 ? 7 :
      recentHardHitRate >= 45 ? 5 :
      recentHardHitRate >= 40 ? 3 : 0;

    score += recentContactScore;
    reasons.push(`Recent Quality Contact ${recentContactScore}/7`);

    let bvpScore = Math.min(bvpHR * 3, 6);
    score += bvpScore;
    reasons.push(`Previous HR vs Pitcher ${bvpScore}/6`);

    let streakScore =
      hitStreak >= 5 ? 5 :
      hitStreak >= 4 ? 4 :
      hitStreak >= 3 ? 3 :
      hitStreak >= 2 ? 2 : 0;

    score += streakScore;
    reasons.push(`Hit Streak Bonus ${streakScore}/5`);

    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      score,
      reasons: reasons.join(" | ")
    };
  }
};