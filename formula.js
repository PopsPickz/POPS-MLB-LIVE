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
  const ops = Number(stats.ops || 0);
  const seasonHR = Number(stats.seasonHR || 0);

  // Barrel % — max 8
  if (barrel >= 15) score += 8;
  else if (barrel >= 12) score += 6;
  else if (barrel >= 9) score += 4;
  else if (barrel >= 6) score += 2;

  // Hard-Hit % — max 7
  if (hardHit >= 55) score += 7;
  else if (hardHit >= 50) score += 6;
  else if (hardHit >= 45) score += 4;
  else if (hardHit >= 40) score += 2;

  // ISO — max 5
  if (iso >= .280) score += 5;
  else if (iso >= .240) score += 4;
  else if (iso >= .200) score += 3;
  else if (iso >= .170) score += 2;

  // OPS — max 5
  if (ops >= .950) score += 5;
  else if (ops >= .875) score += 4;
  else if (ops >= .800) score += 3;
  else if (ops >= .725) score += 2;

  // Season HR — max 5
  if (seasonHR >= 30) score += 5;
  else if (seasonHR >= 22) score += 4;
  else if (seasonHR >= 15) score += 3;
  else if (seasonHR >= 8) score += 2;

  return Math.min(score, 30);
},
  
  function getPopsHRScore(player) {
  let score = 0;

  // 1. Pitcher HR Risk (0-35)
  score += player.pitcherHR9 >= 1.8 ? 35 :
           player.pitcherHR9 >= 1.5 ? 30 :
           player.pitcherHR9 >= 1.2 ? 25 :
           player.pitcherHR9 >= 1.0 ? 18 :
           player.pitcherHR9 >= 0.8 ? 10 : 5;

  // 2. Batter Power (0-25)
  score += player.barrelRate >= 15 ? 25 :
           player.barrelRate >= 12 ? 20 :
           player.barrelRate >= 9 ? 15 :
           player.barrelRate >= 6 ? 10 : 5;

  // 3. Hard Contact (0-15)
  score += player.hardHitRate >= 50 ? 15 :
           player.hardHitRate >= 45 ? 12 :
           player.hardHitRate >= 40 ? 9 :
           player.hardHitRate >= 35 ? 6 : 3;

  // 4. Platoon Advantage (0-10)
  if (player.hasPlatoonAdvantage) score += 10;

  // 5. Lineup Spot (0-8)
  score += player.lineupSpot <= 5 ? 8 : 3;

  // 6. Recent Quality Contact, last 15 games (0-7)
  score += player.recentHardHitRate >= 50 ? 7 :
           player.recentHardHitRate >= 45 ? 5 :
           player.recentHardHitRate >= 40 ? 3 : 0;

  // 7. Previous HR vs Pitcher Bonus (0-6)
  score += Math.min((player.previousHRvsPitcher || 0) * 3, 6);

  return Math.min(Math.round(score), 100);
}
    reasons: reasons.join(" | ")
  };
},
  getHitScore(player = {}) {
  let score = 0;
  let reasons = [];

  const hitStreak = Number(player.hitStreak || 0);
  const bvpHR = Number(player.bvpHR || 0);
  const hrScore = Number(player.score || 0);
  const weatherScore = Number(player.weatherScore || 0);
  const ballparkScore = Number(player.ballparkScore || 0);

  // 1. Recent hit streak — max 25
  let streakScore = Math.min(hitStreak * 5, 25);
  score += streakScore;
  reasons.push(`Hit Streak ${streakScore}/25`);

  // 2. Pitcher matchup from HR score — max 25
  let matchupScore = Math.min(Math.round(hrScore * 0.25), 25);
  score += matchupScore;
  reasons.push(`Pitcher Matchup ${matchupScore}/25`);

  // 3. Previous success vs pitcher — max 15
  let bvpScore = Math.min(bvpHR * 7, 15);
  score += bvpScore;
  reasons.push(`BvP Edge ${bvpScore}/15`);

  // 4. Batter quality — max 20
  let batterQuality = 0;

  const stats = player.batterStats || {};
  const iso = Number(stats.iso || 0);
  const seasonHR = Number(stats.seasonHR || 0);
  const recentHR = Number(stats.recentHR || 0);

  if (this.isKnownPowerBat(player.name)) batterQuality += 8;
  if (iso >= .250) batterQuality += 5;
  else if (iso >= .180) batterQuality += 3;

  if (seasonHR >= 20) batterQuality += 4;
  else if (seasonHR >= 10) batterQuality += 2;

  if (recentHR >= 2) batterQuality += 3;
  else if (recentHR >= 1) batterQuality += 1;

  batterQuality = Math.min(batterQuality, 20);
  score += batterQuality;
  reasons.push(`Batter Quality ${batterQuality}/20`);

  // 5. Weather + Ballpark — max 15
  let environment = Math.min(weatherScore + ballparkScore, 15);
  score += environment;
  reasons.push(`Weather/Ballpark ${environment}/15`);

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
