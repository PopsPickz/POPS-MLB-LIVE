const Pitchers = {
  getTier(risk) {
    if (risk >= 90) return "💣 ELITE HR TARGET";
    if (risk >= 80) return "🔴 HIGH HR RISK";
    if (risk >= 70) return "🟠 STRONG HR RISK";
    if (risk >= 60) return "🟡 MODERATE HR RISK";
    return "🟢 LOW HR RISK";
  },

  getColorClass(risk) {
    if (risk >= 80) return "red";
    if (risk >= 70) return "orange";
    if (risk >= 60) return "gold";
    return "green";
  }
};
