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
},  getHrScore(playerName, lineupSpot, pitcherRisk = {}, extras = {}) {
  let score = 0;
  let reasons = [];

  const risk = Number(pitcherRisk.risk || 50);
  const hr9 = Number(pitcherRisk.hr9 || 0);
  const era = Number(pitcherRisk.era || 0);
  const whip = Number(pitcherRisk.whip || 0);

  // 1. Pitching matchup — max 25
  let matchupScore = 0;

  if (era >= 5) matchupScore += 10;
  else if (era >= 4.25) matchupScore += 7;
  else if (era >= 3.75) matchupScore += 4;

  if (whip >= 1.45) matchupScore += 10;
  else if (whip >= 1.30) matchupScore += 7;
  else if (whip >= 1.20) matchupScore += 4;

  if (lineupSpot >= 1 && lineupSpot <= 5) matchupScore += 5;

  matchupScore = Math.min(matchupScore, 25);
  score += matchupScore;
  reasons.push(`Pitching matchup ${matchupScore}/25`);

  // 2. Pitcher HR risk — max 25
  let pitcherHRScore = Math.round(risk * 0.18);

  if (hr9 >= 1.8) pitcherHRScore += 7;
  else if (hr9 >= 1.3) pitcherHRScore += 5;
  else if (hr9 >= 1.0) pitcherHRScore += 3;

  pitcherHRScore = Math.min(pitcherHRScore, 25);
  score += pitcherHRScore;
  reasons.push(`Pitcher HR risk ${pitcherHRScore}/25`);

  // 3. Weather — max 15
  let weatherScore = Number(extras.weatherScore || extras.weatherBoost || 0);
  weatherScore = Math.min(weatherScore, 15);
  score += weatherScore;

  if (weatherScore >= 10) reasons.push(`Weather boost ${weatherScore}/15`);
  else if (weatherScore > 0) reasons.push(`Small weather edge ${weatherScore}/15`);

 // 4. Batter power/form — max 25
let batterScore = this.getBatterStatScore(extras.batterStats || {});

if (this.isKnownPowerBat(playerName)) {
  batterScore += 3;
  reasons.push("Known power bat");
}

if (Number(extras.hitStreak || 0) >= 2) {
  batterScore += Math.min(Number(extras.hitStreak), 4);
  reasons.push(`${extras.hitStreak}+ game hit streak`);
}

batterScore = Math.min(batterScore, 25);
score += batterScore;
reasons.push(`Batter stats ${batterScore}/25`);

  // 5. Previous HR vs pitcher — max 10
  let bvpScore = Math.min(Number(extras.bvpHR || 0) * 5, 10);
  score += bvpScore;

  if (bvpScore > 0) {
    reasons.push(`Previous HR vs pitcher ${bvpScore}/10`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    reasons: reasons.join(" | ")
  };
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
