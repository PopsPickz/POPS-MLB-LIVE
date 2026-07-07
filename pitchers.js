const Pitchers = {

  defaultData: {
    hr9: 0,
    flyBall: 0,
    hardHit: 0,
    barrel: 0,
    era: "N/A",
    innings: 0,
    hrAllowed: 0,
    risk: 50,
    note: "Live pitcher stats unavailable"
  },

  customData: {

    // Add manual overrides here if desired
    // Example:
    //
    // "Patrick Corbin": {
    //   hr9: 1.72,
    //   risk: 90,
    //   note: "Manual POPS Override"
    // }

  },

  get(name) {

    if (!name) return this.defaultData;

    if (this.customData[name]) {
      return {
        ...this.defaultData,
        ...this.customData[name]
      };
    }

    return this.defaultData;
  },

  getRisk(name) {
    return this.get(name).risk;
  },

  getTier(risk) {

    if (risk >= 90) return "💣 ELITE HR TARGET";
    if (risk >= 80) return "🔴 HIGH HR RISK";
    if (risk >= 70) return "🟠 STRONG HR RISK";
    if (risk >= 60) return "🟡 MODERATE HR RISK";

    return "🟢 LOW HR RISK";
  },

  color(risk) {

    if (risk >= 90) return "#ff3333";
    if (risk >= 80) return "#ff6633";
    if (risk >= 70) return "#ffcc00";

    return "#66cc66";
  }

};
