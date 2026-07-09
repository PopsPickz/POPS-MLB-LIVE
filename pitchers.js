const Pitchers = {
  box: null,

  init() {
    this.box = document.getElementById("pitchersBox");
    if (!this.box) return;
    this.loadPitcherTargets();
  },

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
    if (risk >= 90) return "★★★★★";
    if (risk >= 80) return "★★★★☆";
    if (risk >= 70) return "★★★☆☆";
    if (risk >= 60) return "★★☆☆☆";
    return "★☆☆☆☆";
  },

  summarize(stats) {
    const notes = [];

    if (Number(stats.hr9) >= 1.6) notes.push("High HR/9");
    if (Number(stats.era) >= 5) notes.push("High ERA");
    if (Number(stats.whip) >= 1.4) notes.push("High WHIP");
    if (Number(stats.hrAllowed) >= 20) notes.push("Allows Lots of HR");

    return notes.length ? notes.join(" • ") : "Limited HR danger indicators";
  },

  calculateRisk(stats = {}) {
    let risk = 45;

    const era = Number(stats.era) || 0;
    const whip = Number(stats.whip) || 0;
    const hr9 = Number(stats.hr9) || 0;
    const hrAllowed = Number(stats.hrAllowed) || 0;

    if (hr9 >= 2.0) risk += 35;
    else if (hr9 >= 1.7) risk += 30;
    else if (hr9 >= 1.4) risk += 24;
    else if (hr9 >= 1.1) risk += 18;
    else if (hr9 >= 0.9) risk += 10;

    if (era >= 6.0) risk += 18;
    else if (era >= 5.0) risk += 14;
    else if (era >= 4.5) risk += 10;
    else if (era >= 4.0) risk += 6;

    if (whip >= 1.55) risk += 12;
    else if (whip >= 1.4) risk += 9;
    else if (whip >= 1.3) risk += 5;

    if (hrAllowed >= 20) risk += 10;
    else if (hrAllowed >= 15) risk += 7;
    else if (hrAllowed >= 10) risk += 4;

    return Math.min(100, Math.round(risk));
  },

  async loadPitcherTargets() {
    this.box.innerHTML = "<p>Loading pitcher targets...</p>";

    try {
      const games = window.games || [];

      if (!games.length) {
        this.box.innerHTML = "<p>No games loaded yet.</p>";
        return;
      }

      const pitcherCards = [];

      for (const game of games) {
        const pitchers = [
          {
            pitcher: game.awayPitcher,
            targetTeam: game.homeTeam,
            gameText: `${game.awayTeam} vs ${game.homeTeam}`,
            opponentHitters: game.homeLineup || []
          },
          {
            pitcher: game.homePitcher,
            targetTeam: game.awayTeam,
            gameText: `${game.awayTeam} vs ${game.homeTeam}`,
            opponentHitters: game.awayLineup || []
          }
        ];

        for (const item of pitchers) {
          if (!item.pitcher || !item.pitcher.id) continue;

          const stats = await API.getPitcherStats(item.pitcher.id);
          const risk = this.calculateRisk(stats);

          if (risk < 75) continue;

          const previousHR = await this.getPreviousHRList(item.opponentHitters, item.pitcher.id);
          const hotHitters = await this.getHotHitters(item.opponentHitters);
          const recentHR = await this.getRecentHRList(item.opponentHitters);
          const bestTargets = this.getBestTargets(item.opponentHitters, stats, previousHR, hotHitters, recentHR);

          pitcherCards.push({
            ...item,
            stats,
            risk,
            previousHR,
            hotHitters,
            recentHR,
            bestTargets
          });
        }
      }

      pitcherCards.sort((a, b) => b.risk - a.risk);

      this.box.innerHTML = pitcherCards.length
        ? pitcherCards.map(card => this.renderCard(card)).join("")
        : "<p>No strong pitcher targets found today.</p>";

    } catch (err) {
      console.error("Pitchers load error:", err);
      this.box.innerHTML = "<p>Could not load pitcher targets.</p>";
    }
  },

  async getPreviousHRList(hitters = [], pitcherId) {
    const results = [];

    for (const hitter of hitters) {
      if (!hitter.id) continue;

      const bvp = await this.safe(() => API.getBvP(hitter.id, pitcherId), {});
      const hr = Number(bvp.homeRuns || bvp.hr || 0);

      if (hr > 0) {
        results.push({
          name: hitter.name,
          hr
        });
      }
    }

    return results.sort((a, b) => b.hr - a.hr);
  },

  async getHotHitters(hitters = []) {
    const results = [];

    for (const hitter of hitters) {
      if (!hitter.id) continue;

      const streak = await this.safe(() => API.getHitStreak(hitter.id), 0);

      if (Number(streak) >= 2) {
        results.push({
          name: hitter.name,
          streak: Number(streak)
        });
      }
    }

    return results.sort((a, b) => b.streak - a.streak);
  },

  async getRecentHRList(hitters = []) {
    const results = [];

    for (const hitter of hitters) {
      if (!hitter.id) continue;

      const hr = await this.safe(() => API.getLast5HR(hitter.id), 0);

      if (Number(hr) > 0) {
        results.push({
          name: hitter.name,
          hr: Number(hr)
        });
      }
    }

    return results.sort((a, b) => b.hr - a.hr);
  },

  getBestTargets(hitters = [], pitcherStats = {}, previousHR = [], hotHitters = [], recentHR = []) {
    return hitters
      .map(hitter => {
        let score = 50;

        const prev = previousHR.find(p => p.name === hitter.name);
        const hot = hotHitters.find(h => h.name === hitter.name);
        const recent = recentHR.find(r => r.name === hitter.name);

        score += Number(pitcherStats.hr9 || 0) * 12;
        score += Number(pitcherStats.era || 0) * 2;

        if (prev) score += prev.hr * 10;
        if (hot) score += Math.min(15, hot.streak * 3);
        if (recent) score += recent.hr * 8;

        if (hitter.lineupSpot >= 1 && hitter.lineupSpot <= 5) score += 8;
        if (Formula && Formula.isKnownPowerBat && Formula.isKnownPowerBat(hitter.name)) score += 10;

        return {
          name: hitter.name,
          score: Math.min(100, Math.round(score))
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  },

  renderCard(card) {
    const stats = card.stats || {};
    const color = this.getColorClass(card.risk);

    return `
      <div class="pitcher-target-card ${color}">
        <h2>${this.getEmoji(card.risk)} ${card.pitcher.name}</h2>

        <p><strong>🎯 Target Bats:</strong> ${card.targetTeam}</p>
        <p><strong>Game:</strong> ${card.gameText}</p>

        <h3>Risk: <span class="risk-score">${card.risk}/100</span></h3>
        <p class="tier">${this.getTier(card.risk)} ${this.getStars(card.risk)}</p>

        <p class="pitching-line">
          ERA: ${stats.era || "N/A"} |
          WHIP: ${stats.whip || "N/A"} |
          HR/9: ${stats.hr9 || "N/A"} |
          HR Allowed: ${stats.hrAllowed || "N/A"} |
          IP: ${stats.ip || stats.inningsPitched || "N/A"}
        </p>

        <p class="pitcher-summary">${this.summarize(stats)}</p>

        <div class="pitcher-grid">
          <div class="mini-card">
            <h4>💣 Previous HR vs Pitcher</h4>
            ${this.renderList(card.previousHR, item => `${item.name}: ${item.hr} HR`)}
          </div>

          <div class="mini-card">
            <h4>🔥 Hot Hitters</h4>
            ${this.renderList(card.hotHitters, item => `${item.name}: ${item.streak}+ game hit streak`)}
          </div>

          <div class="mini-card">
            <h4>💣 HR in Last 5 Games</h4>
            ${this.renderList(card.recentHR, item => `${item.name}: ${item.hr} HR`)}
          </div>

          <div class="mini-card">
            <h4>⭐ POPS Best HR Targets</h4>
            ${this.renderList(card.bestTargets, item => `${item.name}: ${item.score}/100`)}
          </div>
        </div>
      </div>
    `;
  },

  renderList(list = [], formatter) {
    if (!list.length) return `<p class="muted">No strong matches found.</p>`;

    return `
      <ul>
        ${list.map(item => `<li>${formatter(item)}</li>`).join("")}
      </ul>
    `;
  },

  async safe(fn, fallback) {
    try {
      return await fn();
    } catch (err) {
      console.warn("Pitchers safe error:", err);
      return fallback;
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  if (window.Pitchers) Pitchers.init();
});