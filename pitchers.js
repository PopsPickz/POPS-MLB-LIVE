// ===========================
// POPS Pitcher HR Risk Database
// Version 6.0
// ===========================

const Pitchers = {

  data: {
    "TBD": {
      hr9: 0,
      flyBall: 0,
      hardHit: 0,
      barrel: 0,
      risk: 50,
      tier: "Unknown",
      note: "Pitcher data not added yet"
    }
  },

  get(name) {
    return this.data[name] || this.data["TBD"];
  },

  getRisk(name) {
    return this.get(name).risk;
  },

  getTier(name) {
    const risk = this.getRisk(name);

    if (risk >= 85) return "🔴 HR Target Pitcher";
    if (risk >= 75) return "🟠 Strong HR Risk";
    if (risk >= 65) return "🟡 Medium HR Risk";
    return "🟢 Lower HR Risk";
  }

};
