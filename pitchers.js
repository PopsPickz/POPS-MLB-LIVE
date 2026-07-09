const Pitchers = {
  box: null,

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

  normalizeStats(stats = {}) {
    const ip = Number(stats.ip || stats.inningsPitched || 0);
    const hrAllowed = Number(stats.hrAllowed || stats.homeRuns || stats.hr || 0);
    const hr9 = Number(stats.hr9) || (ip > 0 && hrAllowed > 0 ? Number(((hrAllowed * 9) / ip).toFixed(2)) : 0);

    return {
      ...stats,
      era: Number(stats.era || 0),
      whip: Number(stats.whip || 0),
      ip,
      inningsPitched: ip,
      hrAllowed,
      homeRuns: hrAllowed,
      hr9
    };
  },

  calculateRisk(stats = {}) {
    const s = this.normalizeStats(stats);
    let risk = 45;

    if (s.hr9 >= 2.0) risk += 35;
    else if (s.hr9 >= 1.7) risk += 30;
    else if (s.hr9 >= 1.4) risk += 24;
    else if (s.hr9 >= 1.1) risk += 18;
    else if (s.hr9 >= 0.9) risk += 10;

    if (s.era >= 6.0) risk += 18;
    else if (s.era >= 5.0) risk += 14;
    else if (s.era >= 4.5) risk += 10;
    else if (s.era >= 4.0) risk += 6;

    if (s.whip >= 1.55) risk += 12;
    else if (s.whip >= 1.4) risk += 9;
    else if (s.whip >= 1.3) risk += 5;

    if (s.hrAllowed >= 20) risk += 10;
    else if (s.hrAllowed >= 15) risk += 7;
    else if (s.hrAllowed >= 10) risk += 4;

    return Math.min(100, Math.round(risk));
  },

  async loadPitcherTargets() {
    this.box = document.getElementById("pitchersBox");
    if (!this.box) return;

    this.box.innerHTML = "<p>Loading pitcher targets...</p>";

    try {
      const games = window.todayData?.games || [];

      if (!games.length) {
        this.box.innerHTML = "<p>No games loaded yet.</p>";
        return;
      }

      const pitcherCards = [];

      for (const game of games) {
        const pitchers = [
          {
            pitcherName: game.awayPitcher,
            pitcherId: game.awayPitcherId,
            stats: this.normalizeStats(game.awayPitcherStats || {}),
            targetTeam: game.homeTeam,
            gameText: `${game.awayTeam} vs ${game.homeTeam}`,
            opponentHitters: game.homeLineup || []
          },
          {
            pitcherName: game.homePitcher,
            pitcherId: game.homePitcherId,
            stats: this.normalizeStats(game.homePitcherStats || {}),
            targetTeam: game.awayTeam,
            gameText: `${game.awayTeam} vs ${game.homeTeam}`,
            opponentHitters: game.awayLineup || []
          }
        ];

        for (const item of pitchers) {
          if (!item.pitcherName) continue;

          const risk = this.calculateRisk(item.stats);
          if (risk < 65) continue;

          const previousHR = this.getPreviousHRList(item.opponentHitters);
          const hotHitters = this.getHotHitters(item.opponentHitters);
          const recentHR = this.getRecentHRList(item.opponentHitters);
          const bestTargets = this.getBestTargets(
            item.opponentHitters,
            item.stats,
            previousHR,
            hotHitters,
            recentHR
          );

          pitcherCards.push({
            ...item,
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

  getPreviousHRList(hitters = []) {
    return hitters
      .map(hitter => ({
        name: hitter.name,
        hr: Number(hitter.bvp?.homeRuns || hitter.bvp?.hr || 0)
      }))
      .filter(item => item.hr > 0)
      .sort((a, b) => b.hr - a.hr);
  },

  getHotHitters(hitters = []) {
    return hitters
      .map(hitter => ({
        name: hitter.name,
        streak: Number(hitter.hitStreak || 0)
      }))
      .filter(item => item.streak >= 2)
      .sort((a, b) => b.streak - a.streak);
  },

  getRecentHRList(hitters = []) {
    return hitters
      .map(hitter => ({
        name: hitter.name,
        hr: Number(
          hitter.last5HR ||
          hitter.hrLast5 ||
          hitter.recentHR ||
          hitter.last5HomeRuns ||
          0
        )
      }))
      .filter(item => item.hr > 0)
      .sort((a, b) => b.hr - a.hr);
  },

  getBestTargets(hitters = [], pitcherStats = {}, previousHR = [], hotHitters = [], recentHR = []) {
    const pitcherRisk =
      typeof Formula !== "undefined" && Formula.pitcherRisk
        ? Formula.pitcherRisk(pitcherStats)
        : this.calculateRisk(pitcherStats);

    return hitters
      .map(hitter => {
        const prev = previousHR.find(p => p.name === hitter.name);
        const hot = hotHitters.find(h => h.name === hitter.name);
        const recent = recentHR.find(r => r.name === hitter.name);

        const batterStats = {
          ...(hitter.hitting || {}),
          ...(hitter.statcast || {})
        };

        const bvpHR = Number(prev?.hr || hitter.bvp?.homeRuns || hitter.bvp?.hr || 0);
        const hitStreak = Number(hot?.streak || hitter.hitStreak || 0);

        const result =
          typeof Formula !== "undefined" && Formula.getHrScore
            ? Formula.getHrScore(hitter.name, hitter.lineupSpot, pitcherRisk, {
                batterStats,
                bvpHR,
                hitStreak,
                hasPlatoonAdvantage: false
              })
            : { score: 0, reasons: "" };

        let score = Number(result.score || 0);

        if (recent) score += Number(recent.hr || 0) * 3;

        return {
          name: hitter.name,
          score: Math.min(100, Math.round(score)),
          reasons: result.reasons || ""
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  },

  renderCard(card) {
    const stats = this.normalizeStats(card.stats || {});
    const color = this.getColorClass(card.risk);

    return `
      <div class="pitcher-target-card ${color}">
        <h2>🎯 ${card.pitcherName}</h2>

        <p><strong>Target Bats:</strong> ${card.targetTeam}</p>
        <p><strong>Game:</strong> ${card.gameText}</p>

        <h3>Risk: <span class="risk-score">${card.risk}/100</span></h3>
        <p class="tier">${this.getTier(card.risk)}</p>

        <p class="pitching-line">
          ERA: ${stats.era || "N/A"} |
          WHIP: ${stats.whip || "N/A"} |
          HR/9: ${stats.hr9 || "N/A"} |
          HR Allowed: ${stats.hrAllowed || "N/A"} |
          IP: ${stats.ip || "N/A"}
        </p>

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
  }
};

window.Pitchers = Pitchers;