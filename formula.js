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
    return this.powerNames.some(power =>
      name.toLowerCase().includes(power.toLowerCase())
    );
  },

  getLineupBoost(lineupSpot = 9) {
    lineupSpot = Number(lineupSpot);

    if (lineupSpot === 3 || lineupSpot === 4) return 8;
    if (lineupSpot >= 1 && lineupSpot <= 5) return 6;
    if (lineupSpot >= 6 && lineupSpot <= 7) return 4;

    return 2;
  },

  pitcherRisk(stats = {}) {
    const era = Number(stats.era || 0);
    const whip = Number(stats.whip || 0);
    const hrAllowed = Number(stats.homeRuns || 0);
    const innings = Number(stats.inningsPitched || 0);

    const hr9 = innings > 0
      ? (hrAllowed * 9) / innings
      : 0;

    let score = 35;

    if (hr9 >= 1.80) score += 30;
    else if (hr9 >= 1.50) score += 24;
    else if (hr9 >= 1.20) score += 18;
    else if (hr9 >= 1.00) score += 12;

    if (era >= 5.00) score += 10;
    else if (era >= 4.50) score += 7;
    else if (era >= 4.00) score += 4;

    if (whip >= 1.40) score += 6;

    return {
      score: Math.min(100, Math.round(score)),
      hr9
    };
  },

  getHrScore(playerName, lineupSpot, pitcherRisk = {}, extras = {}) {

    let score = 0;
    let reasons = [];

    const hr9 = Number(pitcherRisk.hr9 || 0);

    const batterStats = extras.batterStats || {};

    const barrelRate = Number(batterStats.barrelRate || 0);
    const hardHitRate = Number(batterStats.hardHitRate || 0);
    const recentHardHitRate = Number(
      batterStats.recentHardHitRate ||
      hardHitRate ||
      0
    );

    const bvpHR = Number(
      extras.bvpHR ||
      extras.previousHRvsPitcher ||
      0
    );

    const hitStreak = Number(extras.hitStreak || 0);

    const pitcherScore =
      hr9 >= 1.8 ? 35 :
      hr9 >= 1.5 ? 30 :
      hr9 >= 1.2 ? 25 :
      hr9 >= 1.0 ? 18 :
      hr9 >= .8 ? 10 : 5;

    score += pitcherScore;

    reasons.push(`Pitcher HR Risk ${pitcherScore}/35`);

    let powerScore =
      barrelRate >= 15 ? 25 :
      barrelRate >= 12 ? 20 :
      barrelRate >= 9 ? 15 :
      barrelRate >= 6 ? 10 : 5;

    if (this.isKnownPowerBat(playerName))
      powerScore += 5;

    powerScore = Math.min(powerScore, 25);

    score += powerScore;

    reasons.push(`Power ${powerScore}/25`);

    const contactScore =
      hardHitRate >= 50 ? 15 :
      hardHitRate >= 45 ? 12 :
      hardHitRate >= 40 ? 9 :
      hardHitRate >= 35 ? 6 : 3;

    score += contactScore;

    reasons.push(`Hard Contact ${contactScore}/15`);

    const platoonScore =
      extras.hasPlatoonAdvantage ? 10 : 0;

    score += platoonScore;

    reasons.push(`Platoon ${platoonScore}/10`);

    const lineupScore =
      this.getLineupBoost(lineupSpot);

    score += lineupScore;

    reasons.push(`Lineup ${lineupScore}/8`);

    const recentScore =
      recentHardHitRate >= 50 ? 7 :
      recentHardHitRate >= 45 ? 5 :
      recentHardHitRate >= 40 ? 3 : 0;

    score += recentScore;

    reasons.push(`Recent Contact ${recentScore}/7`);

    const bvpScore =
      Math.min(bvpHR * 3, 6);

    score += bvpScore;

    reasons.push(`BvP ${bvpScore}/6`);

    const streakScore =
      hitStreak >= 5 ? 5 :
      hitStreak >= 4 ? 4 :
      hitStreak >= 3 ? 3 :
      hitStreak >= 2 ? 2 : 0;

    score += streakScore;

    reasons.push(`Hit Streak ${streakScore}/5`);

    return {
      score: Math.min(100, Math.round(score)),
      reasons: reasons.join(" | ")
    };
  },

  getHitScore(playerName, lineupSpot, hitStreak = 0, previousHR = 0) {

    let score = 70;

    if (this.isKnownPowerBat(playerName))
      score += 8;

    score += this.getLineupBoost(lineupSpot);

    if (hitStreak >= 2)
      score += Math.min(hitStreak * 2, 10);

    if (previousHR > 0)
      score += Math.min(previousHR * 3, 10);

    return Math.min(100, Math.round(score));
  },

  moneylineScore(teamStats = {}, opponentStats = {}) {

    let score = 0;

    const hitting = teamStats.hitting || {};
    const pitching = teamStats.pitching || {};

    const oppHit = opponentStats.hitting || {};
    const oppPitch = opponentStats.pitching || {};

    if ((hitting.runs || 0) > (oppHit.runs || 0))
      score++;

    if ((hitting.ops || 0) > (oppHit.ops || 0))
      score++;

    if ((pitching.era || 99) < (oppPitch.era || 99))
      score++;

    if ((pitching.whip || 99) < (oppPitch.whip || 99))
      score++;

    return score;
  }
};