const Formula = {
  powerNames: [
    "Judge", "Ohtani", "Schwarber", "Alonso", "Olson",
    "Devers", "Raleigh", "Guerrero", "Tatis", "Soto",
    "Alvarez", "Marte", "Carroll", "Machado", "Freeman",
    "Betts", "Goodman", "Contreras", "Seager", "Stanton",
    "Harper", "Trout", "Ward", "Langford", "Garcia"
  ],

  isKnownPowerBat(name) {
    if (!name) return false;
    return this.powerNames.some(powerName =>
      name.toLowerCase().includes(powerName.toLowerCase())
    );
  },

  getHrScore(playerName, lineupSpot, pitcherRisk) {
    let score = 45;
    let reasons = [];

    const risk = pitcherRisk && pitcherRisk.risk ? pitcherRisk.risk : 50;

    score += Math.round(risk * 0.30);
    reasons.push("Pitcher HR Risk " + risk + "/100");

    if (lineupSpot === 3 || lineupSpot === 4) {
      score += 20;
      reasons.push("Prime power lineup spot");
    } else if (lineupSpot >= 1 && lineupSpot <= 5) {
      score += 12;
      reasons.push("Top 5 lineup spot");
    } else {
      score += 5;
      reasons.push("Lineup boost");
    }

    if (this.isKnownPowerBat(playerName)) {
      score += 18;
      reasons.push("Known power bat");
    }

    if (score > 100) score = 100;

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
      "Los Angeles Angels": ["Mike Trout", "Taylor Ward", "Logan O'Hoppe"]
    };

    return bats[teamName] || [
      teamName + " Power Bat #1",
      teamName + " Power Bat #2",
      teamName + " Power Bat #3"
    ];
  }
};
