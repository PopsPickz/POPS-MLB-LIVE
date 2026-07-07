const Scouting = {
  box: null,

  init() {
    this.box = document.getElementById("gameDetailsBox");
  },

  async load(gamePk) {
    this.box.innerHTML = "Loading scouting report...";

    try {
      const data = await API.getGame(gamePk);

      const awayTeam = data.gameData.teams.away.name;
      const homeTeam = data.gameData.teams.home.name;

      const awayPitcher = data.gameData.probablePitchers?.away?.fullName || "TBD";
      const homePitcher = data.gameData.probablePitchers?.home?.fullName || "TBD";

      const players = data.gameData.players || {};
      const awayOrder = data.liveData.boxscore.teams.away.battingOrder || [];
      const homeOrder = data.liveData.boxscore.teams.home.battingOrder || [];

      this.box.innerHTML = `
        <div class="details-card">
          <h3>📊 Game Scouting Report</h3>
          <h2>${awayTeam} vs ${homeTeam}</h2>

          <div class="report-section">
            <h4>⚾ Starting Pitchers</h4>
            <p>${awayPitcher} vs ${homePitcher}</p>
          </div>

          ${this.pitcherRisk(awayPitcher, homePitcher)}

          <div class="report-section">
            <h4>💣 POPS HR Targets</h4>
            ${this.hrTargets(awayOrder, homeOrder, players, awayPitcher, homePitcher)}
          </div>

          <div class="report-section">
            <h4>👥 ${awayTeam} Lineup</h4>
            <ol>${this.lineup(awayOrder, players)}</ol>
          </div>

          <div class="report-section">
            <h4>👥 ${homeTeam} Lineup</h4>
            <ol>${this.lineup(homeOrder, players)}</ol>
          </div>

          <div class="report-section coming-soon">
            <h4>🌦 Weather / Wind</h4>
            <p>Coming soon.</p>
          </div>

          <div class="report-section coming-soon">
            <h4>💰 Moneyline Edge</h4>
            <p>Coming soon.</p>
          </div>
        </div>
      `;

      this.box.scrollIntoView({ behavior: "smooth" });

    } catch (err) {
      console.log(err);
      this.box.innerHTML = "Error loading scouting report.";
    }
  },

  lineup(order, players) {
    if (!order.length) return "<li>Lineup not posted yet</li>";

    return order.map(id => {
      const player = players["ID" + id];
      return "<li>" + (player ? player.fullName : "Unknown Player") + "</li>";
    }).join("");
  },

  pitcherRisk(awayPitcher, homePitcher) {
    const away = Pitchers.get(awayPitcher);
    const home = Pitchers.get(homePitcher);

    return `
      <div class="report-section pitcher-risk">
        <h4>🎯 Pitcher HR Risk</h4>

        <p><strong>${awayPitcher}:</strong> ${away.risk}/100</p>
        <p>HR/9: ${away.hr9} | FB%: ${away.flyBall}% | Hard-Hit%: ${away.hardHit}% | Barrel%: ${away.barrel}%</p>
        <p>${away.note}</p>

        <hr>

        <p><strong>${homePitcher}:</strong> ${home.risk}/100</p>
        <p>HR/9: ${home.hr9} | FB%: ${home.flyBall}% | Hard-Hit%: ${home.hardHit}% | Barrel%: ${home.barrel}%</p>
        <p>${home.note}</p>
      </div>
    `;
  },

  hrTargets(awayOrder, homeOrder, players, awayPitcher, homePitcher) {
    let targets = [];

    this.addTargets(awayOrder, players, homePitcher, targets);
    this.addTargets(homeOrder, players, awayPitcher, targets);

    targets = targets.sort((a, b) => b.score - a.score).slice(0, 5);

    if (!targets.length) {
      return "<p>No strong POPS HR targets yet.</p>";
    }

    return targets.map((t, i) => `
      <div class="pops-target">
        <h4>${i + 1}. 💣 ${t.name} vs ${t.pitcher}</h4>
        <p><strong>POPS HR Score:</strong> ${t.score}/100</p>
        <p><strong>Pitcher Risk:</strong> ${t.pitcherRisk}/100</p>
        <p><strong>Why:</strong> ${t.reasons}</p>
      </div>
    `).join("");
  },

  addTargets(order, players, opposingPitcher, targets) {
    const risk = Pitchers.get(opposingPitcher);

    order.forEach((id, index) => {
      const player = players["ID" + id];
      if (!player) return;

      const result = Formula.getHrScore(player.fullName, index + 1, opposingPitcher);

      if (result.score >= 70) {
        targets.push({
          name: player.fullName,
          pitcher: opposingPitcher,
          score: result.score,
          pitcherRisk: result.pitcherRisk,
          reasons: result.reasons
        });
      }
    });
  }
};
