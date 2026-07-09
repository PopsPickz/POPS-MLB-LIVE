const API = {
  base: "https://statsapi.mlb.com/api/v1",

  today() {
    return new Date().toISOString().split("T")[0];
  },

  async getSchedule() {
    const date = this.today();

    const url =
      `${this.base}/schedule?sportId=1&date=${date}&hydrate=team,probablePitcher,venue`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      const games = data.dates?.[0]?.games || [];

      return games.map(game => {
        const away = game.teams.away;
        const home = game.teams.home;

        return {
          id: game.gamePk,
          date: game.gameDate,
          status: game.status?.detailedState || "Scheduled",
          venue: game.venue?.name || "TBD",

          awayTeam: away.team.name,
          homeTeam: home.team.name,

          awayRecord: away.leagueRecord
            ? `${away.leagueRecord.wins}-${away.leagueRecord.losses}`
            : "0-0",

          homeRecord: home.leagueRecord
            ? `${home.leagueRecord.wins}-${home.leagueRecord.losses}`
            : "0-0",

          awayPitcher: away.probablePitcher?.fullName || "TBD",
          homePitcher: home.probablePitcher?.fullName || "TBD",

          awayPitcherId: away.probablePitcher?.id || null,
          homePitcherId: home.probablePitcher?.id || null,

          awayTeamId: away.team.id,
          homeTeamId: home.team.id
        };
      });
    } catch (err) {
      console.error("Schedule error:", err);
      return [];
    }
  },

  async getTeamStats(teamId) {
    const url =
      `${this.base}/teams/${teamId}/stats?stats=season&group=hitting,pitching`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      const splits = data.stats?.flatMap(s => s.splits || []) || [];

      return {
        hitting: splits.find(s => s.group?.displayName === "hitting")?.stat || {},
        pitching: splits.find(s => s.group?.displayName === "pitching")?.stat || {}
      };
    } catch (err) {
      console.error("Team stats error:", err);
      return { hitting: {}, pitching: {} };
    }
  },

  async getPlayerStats(playerId) {
    if (!playerId) return {};

    const url =
      `${this.base}/people/${playerId}/stats?stats=season&group=pitching,hitting`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      return data.stats?.[0]?.splits?.[0]?.stat || {};
    } catch (err) {
      console.error("Player stats error:", err);
      return {};
    }
  },

  async getLiveGame(gameId) {
    const url = `${this.base}/game/${gameId}/feed/live`;

    try {
      const res = await fetch(url);
      return await res.json();
    } catch (err) {
      console.error("Live game error:", err);
      return null;
    }
  },

  async getLineup(gameId, teamId) {
    const live = await this.getLiveGame(gameId);
    const boxscore = live?.liveData?.boxscore;

    if (!boxscore) return [];

    const teams = boxscore.teams;

    const side =
      teams.away.team.id === teamId
        ? teams.away
        : teams.home.team.id === teamId
        ? teams.home
        : null;

    if (!side) return [];

    const battingOrder = side.battingOrder || [];

    return battingOrder.map((playerId, index) => {
      const player = side.players[`ID${playerId}`];

      return {
        id: playerId,
        name: player?.person?.fullName || "Unknown Player",
        position: player?.position?.abbreviation || "",
        lineupSpot: index + 1
      };
    });
  }
};