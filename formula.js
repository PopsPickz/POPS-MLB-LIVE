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

  getHrScore(playerName, lineupSpot, pitcherRisk = {}, extras = {}) {
    let score = 40;
    let reasons = [];

    const risk = Number(pitcherRisk.risk || 50);
    const hr9 = Number(pitcherRisk.hr9 || 0);
    const era = Number(pitcherRisk.era || 0);
    const whip = Number(pitcherRisk.whip || 0);

    score += Math.round(risk * 0.28);
    reasons.push(`Pitcher HR Risk ${risk}/100`);

    if (hr9 >= 1.8) {
      score += 12;
      reasons.push("Pitcher gives up HRs");
    } else if (hr9 >= 1.3) {
      score += 8;
      reasons.push("Elevated HR/9");
    }

    if (era >= 5) {
      score += 6;
      reasons.push("High ERA matchup");
    }

    if (whip >= 1.4) {
      score += 5;
      reasons.push("Traffic on bases");
    }

    const lineupBoost = this.getLineupBoost(lineupSpot);
    score += lineupBoost;

    if (lineupSpot === 3 || lineupSpot === 4) {
      reasons.push("Prime power lineup spot");
    } else if (lineupSpot >= 1 && lineupSpot <= 5) {
      reasons.push("Top 5 lineup spot");
    } else {
      reasons.push("Lineup spot boost");
    }

    if (this.isKnownPowerBat(playerName)) {
      score += 16;
      reasons.push("Known power bat");
    }

    if (Number(extras.bvpHR || 0) > 0) {
      score += Math.min(Number(extras.bvpHR) * 5, 15);
      reasons.push("Previous HR vs pitcher");
    }

    if (Number(extras.hitStreak || 0) >= 2) {
      score += Math.min(Number(extras.hitStreak) * 2, 10);
      reasons.push(`${extras.hitStreak}+ game hit streak`);
    }

    if (extras.weatherBoost) {
      score += Number(extras.weatherBoost);
      reasons.push("Weather boost");
    }

    if (extras.ballparkBoost) {
      score += Number(extras.ballparkBoost);
      reasons.push("Ballpark boost");
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
