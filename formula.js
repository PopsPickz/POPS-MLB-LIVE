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
    if (lineupSpot === 3 || lineupSpot === 4) return 20;
    if (lineupSpot >= 1 && lineupSpot <= 5) return 14;
    if (lineupSpot >= 6 && lineupSpot <= 7) return 8;
    return 4;
  },

  getBatterStatScore(stats = {}) {
  let score = 0;

  const barrel = Number(stats.barrelRate || 0);
  const hardHit = Number(stats.hardHitRate || 0);
  const iso = Number(stats.iso || 0);
  const avgEV = Number(stats.avgExitVelocity || 0);
  const seasonHR = Number(stats.seasonHR || 0);
  const recentHR = Number(stats.recentHR || 0);

  if (barrel >= 15) score += 7;
  else if (barrel >= 11) score += 5;
  else if (barrel >= 8) score += 3;

  if (hardHit >= 50) score += 5;
  else if (hardHit >= 45) score += 4;
  else if (hardHit >= 40) score += 2;

  if (iso >= .260) score += 5;
  else if (iso >= .220) score += 4;
  else if (iso >= .180) score += 2;

  if (avgEV >= 92) score += 3;
  else if (avgEV >= 90) score += 2;

  if (seasonHR >= 25) score += 3;
  else if (seasonHR >= 15) score += 2;

  if (recentHR >= 3) score += 2;
  else if (recentHR >= 1) score += 1;

  return Math.min(score, 25);
},  
  getHrScore(playerName, lineupSpot, pitcherRisk = {}, extras = {}) {
  let score = 0;
  let reasons = [];

  const risk = Number(pitcherRisk.risk || 50);
  const hr9 = Number(pitcherRisk.hr9 || 0);
  const era = Number(pitcherRisk.era || 0);
  const whip = Number(pitcherRisk.whip || 0);

  // 1. Batter Power — max 25
  let batterPower = this.getBatterStatScore(extras.batterStats || {});
  if (this.isKnownPowerBat(playerName)) batterPower += 5;
  batterPower = Math.min(batterPower, 25);
  score += batterPower;
  reasons.push(`Batter Power ${batterPower}/25`);

  // 2. Pitcher HR Risk — max 25
  let pitcherHRRisk = Math.round(risk * 0.18);
  if (hr9 >= 1.8) pitcherHRRisk += 7;
  else if (hr9 >= 1.3) pitcherHRRisk += 5;
  else if (hr9 >= 1.0) pitcherHRRisk += 3;
  pitcherHRRisk = Math.min(pitcherHRRisk, 25);
  score += pitcherHRRisk;
  reasons.push(`Pitcher HR Risk ${pitcherHRRisk}/25`);

  // 3. Pitching Matchup — max 15
  let matchup = 0;
  if (era >= 5) matchup += 6;
  else if (era >= 4.25) matchup += 4;
  else if (era >= 3.75) matchup += 2;

  if (whip >= 1.45) matchup += 6;
  else if (whip >= 1.30) matchup += 4;
  else if (whip >= 1.20) matchup += 2;

  if (lineupSpot >= 1 && lineupSpot <= 5) matchup += 3;

  matchup = Math.min(matchup, 15);
  score += matchup;
  reasons.push(`Pitching Matchup ${matchup}/15`);

  // 4. Previous HR vs Pitcher — max 10
  let bvp = Math.min(Number(extras.bvpHR || 0) * 5, 10);
  score += bvp;
  reasons.push(`Previous HR vs Pitcher ${bvp}/10`);

  // 5. Hit Streak — max 10
  let streak = Math.min(Number(extras.hitStreak || 0) * 2, 10);
  score += streak;
  reasons.push(`Hit Streak ${streak}/10`);

  // 6. Weather — max 10
  let weather = Math.min(Number(extras.weatherScore || 0), 10);
  score += weather;
  reasons.push(`Weather ${weather}/10`);

  // 7. Ballpark — max 5
  let ballpark = Math.min(Number(extras.ballparkScore || 0), 5);
  score += ballpark;
  reasons.push(`Ballpark ${ballpark}/5`);

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    reasons: reasons.join(" | ")
  };
},
},
  getHitScore(player = {}) {
    let score = 50;
    let reasons = [];

    const hitStreak = Number(player.hitStreak || 0);
    const bvpHR = Number(player.bvpHR || 0);
    const hrScore = Number(player.score || 50);

    if (hitStreak >= 2) {
      score += Math.min(hitStreak * 7, 28);
      reasons.push(`${hitStreak}+ game hit streak`);
    }

    if (bvpHR > 0) {
      score += Math.min(bvpHR * 8, 18);
      reasons.push("Previous HR vs pitcher");
    }

    score += Math.min(Math.round(hrScore * 0.12), 12);

    if (player.type) {
      reasons.push(player.type);
    }

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
      teamName + " Power Bat #1",
      teamName + " Power Bat #2",
      teamName + " Power Bat #3"
    ];
  }
};
