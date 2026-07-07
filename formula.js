// ===========================
// POPS Pickz Formula Module
// Version 6.0
// ===========================

const Formula = {

  powerNames: [
    "Judge",
    "Ohtani",
    "Schwarber",
    "Alonso",
    "Olson",
    "Devers",
    "Raleigh",
    "Guerrero",
    "Tatis",
    "Soto",
    "Alvarez",
    "Marte",
    "Carroll",
    "Machado",
    "Freeman",
    "Betts",
    "Goodman",
    "Contreras"
  ],

  isKnownPowerBat(name) {
    return this.powerNames.some(powerName => name.includes(powerName));
  },

  getLineupBoost(lineupSpot) {
    if (lineupSpot === 3 || lineupSpot === 4) return 20;
    if (lineupSpot >= 1 && lineupSpot <= 5) return 12;
    return 5;
  },

  getHrScore(playerName, lineupSpot, opposingPitcher) {
    let score = 45;
    let reasons = [];

    const pitcherRisk = Pitchers.getRisk(opposingPitcher);

    score += Math.round(pitcherRisk * 0.30);
    reasons.push("Pitcher HR Risk " + pitcherRisk + "/100");

    const lineupBoost = this.getLineupBoost(lineupSpot);
    score += lineupBoost;
    reasons.push("Lineup boost +" + lineupBoost);

    if (this.isKnownPowerBat(playerName)) {
      score += 18;
      reasons.push("Known power bat");
    }

    if (score > 100) score = 100;

    return {
      score: score,
      pitcherRisk: pitcherRisk,
      pitcherTier: Pitchers.getTier(opposingPitcher),
      reasons: reasons.join(", ")
    };
  }

};
