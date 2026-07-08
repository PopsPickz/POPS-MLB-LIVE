const Moneyline = {
  async getTeamStats(teamId) {
    try {
      const data = await API.getTeamStats(teamId);

      const hitting =
        data.stats?.find(s => s.group.displayName === "hitting")
          ?.splits?.[0]?.stat || {};

      const pitching =
        data.stats?.find(s => s.group.displayName === "pitching")
          ?.splits?.[0]?.stat || {};

      return {
        runs: Number(hitting.runs || 0),
        ops: Number(hitting.ops || 0),
        avg: Number(hitting.avg || 0),
        era: Number(pitching.era || 99),
        whip: Number(pitching.whip || 99)
      };
    } catch {
      return {
        runs: 0,
        ops: 0,
        avg: 0,
        era: 99,
        whip: 99
      };
    }
  },

  async load(games) {
    let cards = [];

    for (const game of games) {
      const away = game.teams.away.team.name;
      const home = game.teams.home.team.name;

      const awayId = game.teams.away.team.id;
      const homeId = game.teams.home.team.id;

      const awayPitcher = game.teams.away.probablePitcher?.fullName || "TBD";
      const homePitcher = game.teams.home.probablePitcher?.fullName || "TBD";

      const awayPitcherId = game.teams.away.probablePitcher?.id || null;
      const homePitcherId = game.teams.home.probablePitcher?.id || null;

      const awayRisk = await pitcherRisk(awayPitcher, awayPitcherId);
      const homeRisk = await pitcherRisk(homePitcher, homePitcherId);

      const awayStats = await this.getTeamStats(awayId);
      const homeStats = await this.getTeamStats(homeId);

      const awayRiskNum = Number(awayRisk.risk) || 50;
      const homeRiskNum = Number(homeRisk.risk) || 50;

      const awayStarter =
      awayRiskNum < homeRiskNum ||
     (awayRiskNum === homeRiskNum && awayStats.era < homeStats.era);

       const homeStarter =
       homeRiskNum < awayRiskNum ||
      (homeRiskNum === awayRiskNum && homeStats.era < awayStats.era);
       const awayBullpen =
        awayStats.era < homeStats.era &&
        awayStats.whip < homeStats.whip;

      const homeBullpen =
        homeStats.era < awayStats.era &&
        homeStats.whip < awayStats.whip;

      const awayOffense = awayStats.ops > homeStats.ops;
      const homeOffense = homeStats.ops > awayStats.ops;

      const awayRunSupport = awayStats.runs > homeStats.runs;
      const homeRunSupport = homeStats.runs > awayStats.runs;

      let awayScore = 0;
      let homeScore = 0;

      // Starting Pitcher = 40%
      if (awayStarter) awayScore += 40;
      if (homeStarter) homeScore += 40;

      // Bullpen = 25%
      if (awayBullpen) awayScore += 25;
      if (homeBullpen) homeScore += 25;

      // Offense = 20%
      if (awayOffense) awayScore += 20;
      if (homeOffense) homeScore += 20;

      // Run Support = 10%
      if (awayRunSupport) awayScore += 10;
      if (homeRunSupport) homeScore += 10;

      // Home Field = 5%
      homeScore += 5;

      let pick = "No Clear Edge";
      let confidence = 50;

      const totalScore = awayScore + homeScore;

      if (awayScore > homeScore) {
        pick = away;
        confidence = Math.round((awayScore / totalScore) * 100);
      }

      if (homeScore > awayScore) {
        pick = home;
        confidence = Math.round((homeScore / totalScore) * 100);
      }

      confidence = Math.max(50, Math.min(confidence, 90));

      cards.push(`
        <div class="pick-card">
          <h3>💰 ${away} vs ${home}</h3>

          <p><strong>POPS Moneyline Pick:</strong>
            <span class="gold">${pick}</span>
          </p>

          <p><strong>Confidence:</strong>
            <span class="hr-score">${confidence}%</span>
          </p>

          <hr>

          <p><strong>${away}</strong></p>
          <p>Starting Pitcher ${awayStarter ? "✅" : "❌"} — ${awayPitcher}</p>
          <p>Bullpen ${awayBullpen ? "✅" : "❌"}</p>
          <p>Offense ${awayOffense ? "✅" : "❌"}</p>
          <p>Run Support ${awayRunSupport ? "✅" : "❌"}</p>
          <p class="small">
            OPS: ${awayStats.ops} | Runs: ${awayStats.runs} | ERA: ${awayStats.era} | WHIP: ${awayStats.whip}
          </p>

          <hr>

          <p><strong>${home}</strong></p>
          <p>Starting Pitcher ${homeStarter ? "✅" : "❌"} — ${homePitcher}</p>
          <p>Bullpen ${homeBullpen ? "✅" : "❌"}</p>
          <p>Offense ${homeOffense ? "✅" : "❌"}</p>
          <p>Run Support ${homeRunSupport ? "✅" : "❌"}</p>
          <p class="small">
            OPS: ${homeStats.ops} | Runs: ${homeStats.runs} | ERA: ${homeStats.era} | WHIP: ${homeStats.whip}
          </p>
        </div>
      `);
    }

    updateBox(moneylineBox, "moneyline", cards.join(""));
  }
};

async function loadMoneyline(games) {
  return await Moneyline.load(games);
}
