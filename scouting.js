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

      const awayPitcherObj = data.gameData.probablePitchers?.away || null;
      const homePitcherObj = data.gameData.probablePitchers?.home || null;

      const awayPitcher = awayPitcherObj ? awayPitcherObj.fullName : "TBD";
      const homePitcher = homePitcherObj ? homePitcherObj.fullName : "TBD";

      const awayPitcherId = awayPitcherObj ? awayPitcherObj.id : null;
      const homePitcherId = homePitcherObj ? homePitcherObj.id : null;

      const players = data.gameData.players || {};
      const awayOrder = data.liveData.boxscore.teams.away.battingOrder || [];
      const homeOrder = data.liveData.boxscore.teams.home.battingOrder || [];

      const awayRisk = await this.pitcherAutoRisk(awayPitcher, awayPitcherId);
      const homeRisk = await this.pitcherAutoRisk(homePitcher, homePitcherId);

      this.box.innerHTML = `
        <div class="details-card">
          <h3>📊 Game Scouting Report</h3>
          <h2>${awayTeam} vs ${homeTeam}</h2>

          <div class="report-section">
            <h4>⚾ Starting Pitchers</h4>
            <p>${awayPitcher} vs ${homePitcher}</p>
          </div>

          ${this.pitcherRiskAuto(awayRisk, homeRisk)}

          <div class="report-section">
            <h4>💣 POPS HR Targets</h4>
            ${this.hrTargets(awayOrder, homeOrder, players, awayPitcher, homePitcher, awayRisk, homeRisk)}
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
    if (!order || !order.length) {
      return "<li>Lineup not posted yet</li>";
    }

    return order.map(id => {
      const player = players["ID" + id];
      return "<li>" + (player ? player.fullName : "Unknown Player") + "</li>";
    }).join("");
  },

  async pitcherAutoRisk(pitcherName, pitcherId) {
    if (!pitcherId) {
      return {
        name: pitcherName,
        hr9: "0.00",
        hrAllowed: 0,
        innings: 0,
        era: "N/A",
        risk: 50,
        note: "Pitcher ID not available"
      };
    }

    try {
      const data = await API.getPitcherStats(pitcherId);
      const splits = data.stats?.[0]?.splits || [];

      if (!splits.length) {
        return {
          name: pitcherName,
          hr9: "0.00",
          hrAllowed: 0,
          innings: 0,
          era: "N/A",
          risk: 50,
          note: "No season pitching stats found"
        };
      }

      const stat = splits[0].stat;

      const hrAllowed = Number(stat.homeRuns || 0);
      const innings = parseFloat(stat.inningsPitched || 0);
      const era = stat.era || "N/A";

      const hr9 =
        innings > 0 ? ((hrAllowed / innings) * 9).toFixed(2) : "0.00";

      let risk = 55;

      if (hr9 >= 1.80) risk = 90;
      else if (hr9 >= 1.50) risk = 82;
      else if (hr9 >= 1.20) risk = 74;
      else if (hr9 >= 1.00) risk = 66;

      return {
        name: pitcherName,
        hr9: hr9,
        hrAllowed: hrAllowed,
        innings: innings,
        era: era,
        risk: risk,
        note: "Auto-calculated from MLB season pitching stats"
      };

    } catch (err) {
      console.log("Pitcher stats error:", err);

      return {
        name: pitcherName,
        hr9: "0.00",
        hrAllowed: 0,
        innings: 0,
        era: "N/A",
        risk: 50,
        note: "Unable to load pitcher stats"
      };
    }
  },

  pitcherRiskAuto(away, home) {
    return `
      <div class="report-section pitcher-risk">
        <h4>🎯 Pitcher HR Risk</h4>

        <p><strong>${away.name}:</strong> ${away.risk}/100</p>
        <p>ERA: ${away.era} | HR/9: ${away.hr9} | HR Allowed: ${away.hrAllowed} | IP: ${away.innings}</p>
        <p>${away.note}</p>

        <hr>

        <p><strong>${home.name}:</strong> ${home.risk}/100</p>
        <p>ERA: ${home.era} | HR/9: ${home.hr9} | HR Allowed: ${home.hrAllowed} | IP: ${home.innings}</p>
        <p>${home.note}</p>
      </div>
    `;
  },

  hrTargets(awayOrder, homeOrder, players, awayPitcher, homePitcher, awayRisk, homeRisk) {
    let targets = [];

    this.addTargets(awayOrder, players, homePitcher, homeRisk, targets);
    this.addTargets(homeOrder, players, awayPitcher, awayRisk, targets);

    targets = targets.sort((a, b) => b.score - a.score).slice(0, 5);

    if (!targets.length) {
      return "<p>No strong POPS HR targets yet. Lineups or pitcher data may not be posted.</p>";
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

  addTargets(order, players, opposingPitcher, pitcherRiskObj, targets) {
    if (!order || !order.length) return;

    order.forEach((id, index) => {
      const player = players["ID" + id];
      if (!player) return;

      const lineupSpot = index + 1;
      const result = Formula.getHrScore(player.fullName, lineupSpot, pitcherRiskObj);

      if (result.score >= 70) {
        targets.push({
          name: player.fullName,
          pitcher: opposingPitcher,
          score: result.score,
          pitcherRisk: pitcherRiskObj.risk,
          reasons: result.reasons
        });
      }
    });
  }
};
