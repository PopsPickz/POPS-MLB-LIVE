const Pitchers = {

  getTier(risk) {
    if (risk >= 95) return "💀 EXTREME DANGER";
    if (risk >= 90) return "💣 ELITE HR TARGET";
    if (risk >= 85) return "🔥 VERY HIGH HR RISK";
    if (risk >= 80) return "🔴 HIGH HR RISK";
    if (risk >= 75) return "🟠 STRONG HR RISK";
    if (risk >= 65) return "🟡 MODERATE HR RISK";
    return "🟢 LOW HR RISK";
  },

  getColorClass(risk) {
    if (risk >= 90) return "elite";
    if (risk >= 80) return "red";
    if (risk >= 70) return "orange";
    if (risk >= 60) return "gold";
    return "green";
  },

  getEmoji(risk) {
    if (risk >= 95) return "💀";
    if (risk >= 90) return "💣";
    if (risk >= 80) return "🔥";
    if (risk >= 70) return "⚠️";
    if (risk >= 60) return "🟡";
    return "🟢";
  },

  getStars(risk) {
    if (risk >= 95) return "★★★★★";
    if (risk >= 90) return "★★★★★";
    if (risk >= 80) return "★★★★☆";
    if (risk >= 70) return "★★★☆☆";
    if (risk >= 60) return "★★☆☆☆";
    return "★☆☆☆☆";
  },

  summarize(stats) {

    let notes = [];

    if (Number(stats.hr9) >= 1.6)
      notes.push("High HR/9");

    if (Number(stats.era) >= 5)
      notes.push("High ERA");

    if (Number(stats.whip) >= 1.40)
      notes.push("High WHIP");

    if (Number(stats.hrAllowed) >= 20)
      notes.push("Allows Lots of HR");

    return notes.join(" • ");
  }

};
