const Formula = {
  powerNames: [
    "Judge", "Ohtani", "Schwarber", "Alonso", "Olson",
    "Devers", "Raleigh", "Guerrero", "Tatis", "Soto",
    "Alvarez", "Marte", "Carroll", "Machado", "Freeman",
    "Betts", "Goodman", "Contreras"
  ],

  isKnownPowerBat(name) {
    return this.powerNames.some(powerName => name.includes(powerName));
  },

  getHrScore(playerName, lineupSpot, pitcherRisk) {
    let score = 45;
    let reasons = [];

    score += Math.round(pitcherRisk.risk * 0.30);
    reasons.push("Pitcher HR Risk " + pitcherRisk.risk + "/100");

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
      score: score,
      reasons: reasons.join(", ")
    };
  }
};
