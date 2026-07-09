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
    const spot = Number(lineupSpot);

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

    let score = 30;

    if (hr9 >= 1.80) score += 35;
    else if (hr9 >= 1.50) score += 28;
    else if (hr9 >= 1.20) score += 20;
    else if (hr9 >= 1.00) score += 14;
    else if (hr9 >= 0.80) score += 8;

    if (era >= 5.00) score += 12;
    else if (era >= 4.50) score += 8;
    else if (era >= 4.00) score += 5;

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

    const batterStats = extras.batterStats || {};

    const hr = Number(batterStats.homeRuns || 0);
    const ops = Number(batterStats.ops || 0);
    const slg = Number(batterStats.slg || 0);
    const avg = Number(batterStats.avg || 0);
    
    const barrelRate = Number(batterStats.barrelRate || 0);
    const hardHitRate = Number(batterStats.hardHitRate || 0);
    const exitVelocity = Number(batterStats.exitVelocity || 0);
    const flyBallRate = Number(batterStats.flyBallRate || 0);  
    
    const hr9 = Number(pitcherRisk.hr9 || 0);
    const era = Number(pitcherRisk.era || 0);
    const whip = Number(pitcherRisk.whip || 0);

    let pitcherScore =
      hr9 >= 1.8 ? 30 :
      hr9 >= 1.5 ? 25 :
      hr9 >= 1.2 ? 20 :
      hr9 >= 1.0 ? 15 :
      hr9 >= 0.8 ? 10 : 5;

    if (era >= 5.0) pitcherScore += 5;
    if (whip >= 1.4) pitcherScore += 5;

    pitcherScore = Math.min(pitcherScore, 35);
    score += pitcherScore;
    reasons.push(`Pitcher HR Risk ${pitcherScore}/35`);

    let powerScore =
      hr >= 30 ? 25 :
      hr >= 20 ? 21 :
      hr >= 15 ? 17 :
      hr >= 10 ? 13 :
      hr >= 5 ? 8 : 4;

    if (this.isKnownPowerBat(playerName)) powerScore += 5;

    powerScore = Math.min(powerScore, 30);
    score += powerScore;
    reasons.push(`HR Power ${powerScore}/30`);

    let slugScore =
      slg >= .550 ? 15 :
      slg >= .500 ? 12 :
      slg >= .450 ? 9 :
      slg >= .400 ? 6 : 3;

    score += slugScore;
    reasons.push(`SLG ${slugScore}/15`);

    let opsScore =
      ops >= .900 ? 10 :
      ops >= .825 ? 8 :
      ops >= .775 ? 6 :
      ops >= .725 ? 4 : 2;

    score += opsScore;
    reasons.push(`OPS ${opsScore}/10`);

    const lineupScore = this.getLineupBoost(lineupSpot);
    score += lineupScore;
    reasons.push(`Lineup ${lineupScore}/10`);

    let avgScore =
      avg >= .300 ? 5 :
      avg >= .275 ? 4 :
      avg >= .250 ? 3 :
      avg >= .230 ? 2 : 1;

    score += avgScore;
    reasons.push(`AVG ${avgScore}/5`);

    return {
      score: Math.min(100, Math.round(score)),
      reasons: reasons.join(" | ")
    };
  },

  getHitScore(playerName, lineupSpot, hitStreak = 0, previousHR = 0, batterStats = {}) {
    let score = 65;

    const avg = Number(batterStats.avg || 0);
    const ops = Number(batterStats.ops || 0);

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
  },

  moneylineScore(teamStats = {}, opponentStats = {}) {
    let score = 0;

    const hitting = teamStats.hitting || {};
    const pitching = teamStats.pitching || {};

    const oppHit = opponentStats.hitting || {};
    const oppPitch = opponentStats.pitching || {};

    if (Number(hitting.runs || 0) > Number(oppHit.runs || 0)) score++;
    if (Number(hitting.ops || 0) > Number(oppHit.ops || 0)) score++;
    if (Number(pitching.era || 99) < Number(oppPitch.era || 99)) score++;
    if (Number(pitching.whip || 99) < Number(oppPitch.whip || 99)) score++;

    return score;
  }
};
