const Hits = {
  async getHitStreak(playerId) {
    if (!playerId) return 0;

    try {
      const data = await API.getHitterGameLog(playerId);
      const games = data.stats?.[0]?.splits || [];

      let streak = 0;

      for (const game of games) {
        const hits = Number(game.stat?.hits || 0);

        if (hits > 0) streak++;
        else break;
      }

      return streak;
    } catch (err) {
      console.log("Hit streak error:", err);
      return 0;
    }
  },

  async getBvpHR(batterId, pitcherId) {
    if (!batterId || !pitcherId) return 0;

    try {
      const data = await API.getBatterVsPitcher(batterId, pitcherId);
      const stat = data.stats?.[0]?.splits?.[0]?.stat;

      return Number(stat?.homeRuns || 0);
    } catch (err) {
      console.log("BvP HR error:", err);
      return 0;
    }
  },

  async addLineupHitTargets({
    order,
    players,
    team,
    game,
    opposingPitcher,
    opposingPitcherId,
    pitcherRisk,
    targets
  }) {
    if (!order || !order.length) return;

    for (let index = 0; index < order.length; index++) {
      const id = order[index];
      const player = players["ID" + id];

      if (!player) continue;

      const bvpHR = await this.getBvpHR(id, opposingPitcherId);
      const hitStreak = await this.getHitStreak(id);

      if (bvpHR <= 0 && hitStreak < 2) continue;

      const hrResult = Formula.getHrScore(
        player.fullName,
        index + 1,
        pitcherRisk,
        { bvpHR, hitStreak }
      );

      const hitResult = Formula.getHitScore({
        name: player.fullName,
        score: hrResult.score,
        bvpHR,
        hitStreak,
        type: "Confirmed lineup"
      });

      targets.push({
        name: player.fullName,
        team,
        game,
        pitcher: opposingPitcher,
        bvpHR,
        hitStreak,
        hitScore: hitResult.score,
        reasons: hitResult.reasons,
        type: "Confirmed lineup"
      });
    }
  },

  async load(games) {
    let targets = [];

    for (const game of games) {
      try {
        const live = await API.getGame(game.gamePk);

        const away = live.gameData.teams.away.name;
        const home = live.gameData.teams.home.name;
        const gameName = `${away} vs ${home}`;

        const players = live.gameData.players || {};
        const awayOrder = live.liveData.boxscore.teams.away.battingOrder || [];
        const homeOrder = live.liveData.boxscore.teams.home.battingOrder || [];

        const awayPitcherObj = live.gameData.probablePitchers?.away || null;
        const homePitcherObj = live.gameData.probablePitchers?.home || null;

        const awayPitcher = awayPitcherObj?.fullName || "TBD";
        const homePitcher = homePitcherObj?.fullName || "TBD";

        const awayRisk = await pitcherRisk(awayPitcher, awayPitcherObj?.id);
        const homeRisk = await pitcherRisk(homePitcher, homePitcherObj?.id);

        await this.addLineupHitTargets({
          order: awayOrder,
          players,
          team: away,
          game: gameName,
          opposingPitcher: homePitcher,
          opposingPitcherId: homePitcherObj?.id,
          pitcherRisk: homeRisk,
          targets
        });

        await this.addLineupHitTargets({
          order: homeOrder,
          players,
          team: home,
          game: gameName,
          opposingPitcher: awayPitcher,
          opposingPitcherId: awayPitcherObj?.id,
          pitcherRisk: awayRisk,
          targets
        });

      } catch (err) {
        console.log("Hit picks game error:", err);
      }
    }

    targets = targets
      .sort((a, b) => b.hitScore - a.hitScore)
      .slice(0, 20);

    if (!targets.length) {
      updateBox(
        hitPicksBox,
        "hits",
        `
        <div class="pick-card">
          <h3>🔥 No Hit Pickz Loaded Yet</h3>
          <p class="small">
            Hit Pickz will populate when official lineups post and a hitter has a previous HR vs the pitcher or a 2+ game hit streak.
          </p>
        </div>
        `
      );
      return;
    }

    const html = targets.map((p, i) => `
      <div class="pick-card">
        <span class="rank-badge">#${i + 1}</span>
        <h3>🔥 ${p.name}</h3>

        <p><strong>Team:</strong> ${p.team}</p>
        <p><strong>Game:</strong> ${p.game}</p>
        <p><strong>Vs Pitcher:</strong> ${p.pitcher}</p>

        <p><strong>Previous HR vs Pitcher:</strong> ${p.bvpHR}</p>
        <p><strong>Hit Streak:</strong> ${p.hitStreak}+ games</p>

        <p><strong>POPS Hit Score:</strong>
          <span class="hr-score">${p.hitScore}/100</span>
        </p>

        <p class="small">
          ${p.bvpHR > 0 ? "Previous HR history ✅" : ""}
          ${p.hitStreak >= 2 ? " | 2+ game hit streak ✅" : ""}
          <br>${p.reasons}
        </p>
      </div>
    `).join("");

    updateBox(hitPicksBox, "hits", html);
  }
};

async function loadHitPicks(games) {
  return await Hits.load(games);
}
