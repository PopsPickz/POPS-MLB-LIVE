const Scouting = {
  box: null,

  init() {
    this.box = document.getElementById("scoutingBox");
  },

  async load(gamePk) {
    if (!this.box) this.init();
    if (!this.box) return;

    this.box.innerHTML = "Loading scouting report...";

    try {
      const data = await API.getGame(gamePk);

      const awayTeam = data.gameData.teams.away.name;
      const homeTeam = data.gameData.teams.home.name;

      const awayPitcherObj = data.gameData.probablePitchers?.away || null;
      const homePitcherObj = data.gameData.probablePitchers?.home || null;

      const awayPitcher = awayPitcherObj?.fullName || "TBD";
      const homePitcher = homePitcherObj?.fullName || "TBD";

      const awayPitcherId = awayPitcherObj?.id || null;
      const homePitcherId = homePitcherObj?.id || null;

      const players = data.gameData.players || {};
      const awayOrder = data.liveData.boxscore.teams.away.battingOrder || [];
      const homeOrder = data.liveData.boxscore.teams.home.battingOrder || [];

      const awayRisk = await this.pitcherAutoRisk(awayPitcher, awayPitcherId);
      const homeRisk = await this.pitcherAutoRisk(homePitcher, homePitcherId);

      const hrTargets = await this.hrTargets(
        awayOrder,
        homeOrder,
        players,
        awayPitcher,
        homePitcher,
        awayRisk,
        homeRisk,
        awayPitcherId,
        homePitcherId
      );

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
            ${hrTargets}
          </div>

          <div class="report-section">
            <h4>👥 ${awayTeam} Lineup</h4>
            <ol>${this.lineup(awayOrder, players)}</ol>
          </div>

          <div class="report-section">
            <h4>👥 ${homeTeam} Lineup</h4>
            <ol>${this.lineup(homeOrder, players)}</ol>
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
      return `<li>${player ? player.fullName : "Unknown Player"}</li>`;
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
        whip: "N/A",
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
          whip: "N/A",
          risk: 50,
          note: "No season pitching stats found"
        };
      }

      const stat = splits[0].stat;
      const hrAllowed = Number(stat.homeRuns || 0);
      const innings = parseFloat(stat.inningsPitched || 0);
      const era = stat.era || "N/A";
      const whip = stat.whip || "N/A";
      const hr9 = innings > 0 ? ((hrAllowed / innings) * 9).toFixed(2) : "0.00";

      let risk = 55;

      if (Number(hr9) >= 1.80) risk += 30;
      else if (Number(hr9) >= 1.50) risk += 24;
      else if (Number(hr9) >= 1.20) risk += 18;
      else if (Number(hr9) >= 1.00) risk += 12;

      if (Number(era) >= 5.00) risk += 10;
      else if (Number(era) >= 4.50) risk += 7;
      else if (Number(era) >= 4.00) risk += 4;

      if (Number(whip) >= 1.40) risk += 6;

      risk = Math.min(100, risk);

      return {
        name: pitcherName,
        hr9,
        hrAllowed,
        innings,
        era,
        whip,
        risk,
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
        whip: "N/A",
        risk: 50,
        note: "Unable to load pitcher stats"
      };
    }
  },

  pitcherRiskAuto(away, home) {
    return `
      <div class="report-section">
        <h4>🎯 Pitcher HR Risk</h4>

        <p><strong>${away.name}:</strong> ${away.risk}/100</p>
        <p>ERA: ${away.era} | WHIP: ${away.whip} | HR/9: ${away.hr9} | HR Allowed: ${away.hrAllowed} | IP: ${away.innings}</p>
        <p class="small-note">${away.note}</p>

        <hr>

        <p><strong>${home.name}:</strong> ${home.risk}/100</p>
        <p>ERA: ${home.era} | WHIP: ${home.whip} | HR/9: ${home.hr9} | HR Allowed: ${home.hrAllowed} | IP: ${home.innings}</p>
        <p class="small-note">${home.note}</p>
      </div>
    `;
  },

  async getBvpHR(batterId, pitcherId) {
    if (!batterId || !pitcherId) return 0;

    try {
      const data = await API.getBatterVsPitcher(batterId, pitcherId);
      const stat = data.stats?.[0]?.splits?.[0]?.stat;
      return Number(stat?.homeRuns || 0);
    } catch {
      return 0;
    }
  },

  async hrTargets(
    awayOrder,
    homeOrder,
    players,
    awayPitcher,
    homePitcher,
    awayRisk,
    homeRisk,
    awayPitcherId,
    homePitcherId
  ) {
    let targets = [];

    await this.addTargets(awayOrder, players, homePitcher, homeRisk, homePitcherId, targets);
    await this.addTargets(homeOrder, players, awayPitcher, awayRisk, awayPitcherId, targets);

    targets = targets.sort((a, b) => b.score - a.score).slice(0, 5);

    if (!targets.length) {
      return "<p>No confirmed lineup targets yet. Main page will use projected power bats until lineups post.</p>";
    }

    return targets.map((t, i) => `
      <div class="pops-target">
        <h4>${i + 1}. 💣 ${t.name} vs ${t.pitcher}</h4>
        <p><strong>POPS HR Score:</strong> ${t.score}/100</p>
        <p><strong>Previous HR vs Pitcher:</strong> ${t.bvpHR}</p>
        <p><strong>Pitcher Risk:</strong> ${t.pitcherRisk}/100</p>
        <p><strong>Why:</strong> ${t.reasons}</p>
      </div>
    `).join("");
  },

  async addTargets(order, players, opposingPitcher, pitcherRiskObj, opposingPitcherId, targets) {
    if (!order || !order.length) return;

    for (let index = 0; index < order.length; index++) {
      const id = order[index];
      const player = players["ID" + id];
      if (!player) continue;

      const lineupSpot = index + 1;
      const bvpHR = await this.getBvpHR(id, opposingPitcherId);

      const result = Formula.getHrScore(player.fullName, lineupSpot, pitcherRiskObj, {
        bvpHR
      });

      if (result.score >= 70 || bvpHR > 0) {
        targets.push({
          name: player.fullName,
          pitcher: opposingPitcher,
          score: result.score,
          bvpHR,
          pitcherRisk: pitcherRiskObj.risk,
          reasons: result.reasons
        });
      }
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  Scouting.init();
});
