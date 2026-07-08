const Formula = {
  powerNames: [
    "Judge", "Ohtani", "Schwarber", "Alonso", "Olson",
    "Devers", "Raleigh", "Guerrero", "Tatis", "Soto",
    "Alvarez", "Marte", "Carroll", "Machado", "Freeman",
    "Betts", "Goodman", "Contreras", "Seager", "Stanton",
    "Harper", "Trout", "Ward", "Langford", "Garcia", "Riley",
    "Acuña", "Lindor", "Turner", "O'Hoppe", "Bellinger"
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

  getBatterStatScore(stats = {}) {
    let score = 0;

    const barrel = Number(stats.barrelRate || 0);
    const hardHit = Number(stats.hardHitRate || 0);
    const iso = Number(stats.iso || 0);
    const ops = Number(stats.ops || 0);
    const seasonHR = Number(stats.seasonHR || 0);

    if (barrel >= 15) score += 8;
    else if (barrel >= 12) score += 6;
    else if (barrel >= 9) score += 4;
    else if (barrel >= 6) score += 2;

    if (hardHit >= 55) score += 7;
    else if (hardHit >= 50) score += 6;
    else if (hardHit >= 45) score += 4;
    else if (hardHit >= 40) score += 2;

    if (iso >= .280) score += 5;
    else if (iso >= .240) score += 4;
    else if (iso >= .200) score += 3;
    else if (iso >= .170) score += 2;

    if (ops >= .950) score += 5;
    else if (ops >= .875) score += 4;
    else if (ops >= .800) score += 3;
    else if (ops >= .725) score += 2;

    if (seasonHR >= 30) score += 5;
    else if (seasonHR >= 22) score += 4;
    else if (seasonHR >= 15) score += 3;
    else if (seasonHR >= 8) score += 2;

    return Math.min(score, 30);
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

    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      score,
      reasons: reasons.join(" | ")
    };
  },

  getHitScore(player = {}) {
    let score = 0;
    let reasons = [];

    const hitStreak = Number(player.hitStreak || 0);
    const bvpHR = Number(player.bvpHR || 0);
    const hrScore = Number(player.score || 0);

    let streakScore = Math.min(hitStreak * 5, 25);
    score += streakScore;
    reasons.push(`Hit Streak ${streakScore}/25`);

    let matchupScore = Math.min(Math.round(hrScore * 0.25), 25);
    score += matchupScore;
    reasons.push(`Pitcher Matchup ${matchupScore}/25`);

    let bvpScore = Math.min(bvpHR * 7, 15);
    score += bvpScore;
    reasons.push(`BvP Edge ${bvpScore}/15`);

    let batterQuality = 0;
    const stats = player.batterStats || {};
    const iso = Number(stats.iso || 0);
    const seasonHR = Number(stats.seasonHR || 0);

    if (this.isKnownPowerBat(player.name)) batterQuality += 8;
    if (iso >= .250) batterQuality += 5;
    else if (iso >= .180) batterQuality += 3;
    if (seasonHR >= 20) batterQuality += 4;
    else if (seasonHR >= 10) batterQuality += 2;

    batterQuality = Math.min(batterQuality, 20);
    score += batterQuality;
    reasons.push(`Batter Quality ${batterQuality}/20`);

    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      score,
      reasons: reasons.join(" | ")
    };
  },

  getProjectedPowerBats(teamName) {
    const bats = {
      "New York Yankees": ["Aaron Judge", "Giancarlo Stanton", "Cody Bellinger"],
      "Los Angeles Dodgers": ["Shohei Ohtani", "Mookie Betts", "Freddie Freeman"],
      "Philadelphia Phillies": ["Kyle Schwarber", "Bryce Harper", "Trea Turner"],
      "New York Mets": ["Pete Alonso", "Juan Soto", "Francisco Lindor"],
      "Atlanta Braves": ["Matt Olson", "Austin Riley", "Ronald Acuña Jr."],
      "Texas Rangers": ["Corey Seager", "Adolis García", "Wyatt Langford"],
      "Los Angeles Angels": ["Mike Trout", "Taylor Ward", "Logan O'Hoppe"],
      "Arizona Diamondbacks": ["Corbin Carroll", "Ketel Marte", "Eugenio Suárez"],
      "Toronto Blue Jays": ["Vladimir Guerrero Jr.", "Bo Bichette", "George Springer"],
      "Seattle Mariners": ["Cal Raleigh", "Julio Rodríguez", "Randy Arozarena"],
      "Boston Red Sox": ["Rafael Devers", "Trevor Story", "Wilyer Abreu"],
      "Chicago Cubs": ["Seiya Suzuki", "Ian Happ", "Pete Crow-Armstrong"],
      "Milwaukee Brewers": ["William Contreras", "Christian Yelich", "Jackson Chourio"],
      "San Diego Padres": ["Fernando Tatis Jr.", "Manny Machado", "Jake Cronenworth"]
    };

    return bats[teamName] || [
      `${teamName} Power Bat #1`,
      `${teamName} Power Bat #2`,
      `${teamName} Power Bat #3`
    ];
  }
};