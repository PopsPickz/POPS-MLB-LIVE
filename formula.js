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

    const bvpHR = Number(extras.bvpHR || 0);
    const hasPlatoonAdvantage = Boolean(extras.hasPlatoonAdvantage);

    const hr9 = Number(pitcherRisk.hr9 || 0);
    const era = Number(pitcherRisk.era || 0);
    const whip = Number(pitcherRisk.whip || 0);

    let pitcherScore =
      hr9 >= 1.8 ? 25 :
      hr9 >= 1.5 ? 21 :
      hr9 >= 1.2 ? 17 :
      hr9 >= 1.0 ? 12 :
      hr9 >= 0.8 ? 8 : 4;

    if (era >= 5.0) pitcherScore += 4;
    if (whip >= 1.4) pitcherScore += 3;

    pitcherScore = Math.min(pitcherScore, 25);
    score += pitcherScore;
    reasons.push(`Pitcher HR Risk ${pitcherScore}/25`);

    let powerScore =
      hr >= 35 ? 20 :
      hr >= 25 ? 17 :
      hr >= 18 ? 14 :
      hr >= 12 ? 10 :
      hr >= 6 ? 6 : 3;

    if (this.isKnownPowerBat(playerName)) powerScore += 4;

    powerScore = Math.min(powerScore, 20);
    score += powerScore;
    reasons.push(`HR Power ${powerScore}/20`);

    let barrelScore =
      barrelRate >= 18 ? 15 :
      barrelRate >= 15 ? 13 :
      barrelRate >= 12 ? 10 :
      barrelRate >= 9 ? 7 :
      barrelRate >= 6 ? 4 : 0;

    score += barrelScore;
    reasons.push(`Barrel ${barrelScore}/15`);

    let hardHitScore =
      hardHitRate >= 55 ? 12 :
      hardHitRate >= 50 ? 10 :
      hardHitRate >= 45 ? 8 :
      hardHitRate >= 40 ? 5 :
      hardHitRate >= 35 ? 3 : 0;

    score += hardHitScore;
    reasons.push(`Hard Hit ${hardHitScore}/12`);

    let exitVeloScore =
      exitVelocity >= 94 ? 10 :
      exitVelocity >= 92 ? 8 :
      exitVelocity >= 90 ? 6 :
      exitVelocity >= 88 ? 3 : 0;

    score += exitVeloScore;
    reasons.push(`Exit Velo ${exitVeloScore}/10`);

    let flyBallScore =
      flyBallRate >= 45 ? 6 :
      flyBallRate >= 40 ? 5 :
      flyBallRate >= 35 ? 3 :
      flyBallRate >= 30 ? 1 : 0;

    score += flyBallScore;
    reasons.push(`Fly Ball ${flyBallScore}/6`);

    let slugOpsScore = 0;

    if (slg >= .550) slugOpsScore += 6;
    else if (slg >= .500) slugOpsScore += 5;
    else if (slg >= .450) slugOpsScore += 3;
    else if (slg >= .400) slugOpsScore += 1;

    if (ops >= .900) slugOpsScore += 5;
    else if (ops >= .825) slugOpsScore += 4;
    else if (ops >= .775) slugOpsScore += 3;
    else if (ops >= .725) slugOpsScore += 1;

    score += slugOpsScore;
    reasons.push(`SLG/OPS ${slugOpsScore}/11`);

    const lineupScore = this.getLineupBoost(lineupSpot);
    score += lineupScore;
    reasons.push(`Lineup ${lineupScore}/10`);

    const platoonScore = hasPlatoonAdvantage ? 5 : 0;
    score += platoonScore;
    reasons.push(`Platoon ${platoonScore}/5`);

    const bvpScore = Math.min(bvpHR * 3, 6);
    score += bvpScore;
    reasons.push(`BvP HR ${bvpScore}/6`);

    let avgScore =
      avg >= .300 ? 3 :
      avg >= .275 ? 2 :
      avg >= .250 ? 1 : 0;

    score += avgScore;
    reasons.push(`AVG ${avgScore}/3`);

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