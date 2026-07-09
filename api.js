const API = {
  base: "https://statsapi.mlb.com/api/v1",

  today() {
    return new Date().toISOString().split("T")[0];
  },

  async fetchJSON(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("API Error:", err);
      return null;
    }
  },

  async getSchedule() {
    const url = `${this.base}/schedule?sportId=1&date=${this.today()}&hydrate=team,probablePitcher,venue`;
    const data = await this.fetchJSON(url);
    const games = data?.dates?.[0]?.games || [];

    return games.map(game => ({
      id: game.gamePk,
      date: game.gameDate,
      status: game.status?.detailedState || "Scheduled",
      venue: game.venue?.name || "TBD",
      awayTeam: game.teams.away.team.name,
      homeTeam: game.teams.home.team.name,
      awayTeamId: game.teams.away.team.id,
      homeTeamId: game.teams.home.team.id,
      awayPitcher: game.teams.away.probablePitcher?.fullName || "TBD",
      homePitcher: game.teams.home.probablePitcher?.fullName || "TBD",
      awayPitcherId: game.teams.away.probablePitcher?.id || null,
      homePitcherId: game.teams.home.probablePitcher?.id || null,
      awayRecord: game.teams.away.leagueRecord
        ? `${game.teams.away.leagueRecord.wins}-${game.teams.away.leagueRecord.losses}`
        : "0-0",
      homeRecord: game.teams.home.leagueRecord
        ? `${game.teams.home.leagueRecord.wins}-${game.teams.home.leagueRecord.losses}`
        : "0-0"
    }));
  },

  async getPlayerStats(playerId) {
    if (!playerId) return {};
    const url = `${this.base}/people/${playerId}/stats?stats=season&group=pitching`;
    const data = await this.fetchJSON(url);
    return data?.stats?.[0]?.splits?.[0]?.stat || {};
  },

  async getBatterStats(playerId) {
    if (!playerId) return {};
    const url = `${this.base}/people/${playerId}/stats?stats=season&group=hitting`;
    const data = await this.fetchJSON(url);
    return data?.stats?.[0]?.splits?.[0]?.stat || {};
  },

  async getTeamStats(teamId) {
    if (!teamId) return { hitting: {}, pitching: {} };

    const url = `${this.base}/teams/${teamId}/stats?stats=season&group=hitting,pitching`;
    const data = await this.fetchJSON(url);
    const splits = data?.stats?.flatMap(s => s.splits || []) || [];

    return {
      hitting: splits.find(s => s.group?.displayName === "hitting")?.stat || {},
      pitching: splits.find(s => s.group?.displayName === "pitching")?.stat || {}
    };
  },

  async getLiveGame(gameId) {
    if (!gameId) return null;
    const url = `${this.base}/game/${gameId}/feed/live`;
    return await this.fetchJSON(url);
  },

  async getLineup(gameId, teamId) {
    const live = await this.getLiveGame(gameId);
    const boxscore = live?.liveData?.boxscore;

    if (!boxscore) return [];

    const side =
      boxscore.teams.away.team.id === teamId
        ? boxscore.teams.away
        : boxscore.teams.home.team.id === teamId
        ? boxscore.teams.home
        : null;

    if (!side) return [];

    const battingOrder = side.battingOrder || [];

    return battingOrder.map((playerId, index) => {
      const player = side.players[`ID${playerId}`];

      return {
        id: playerId,
        name: player?.person?.fullName || "Unknown",
        position: player?.position?.abbreviation || "",
        lineupSpot: index + 1,
        confirmed: true
      };
    });
  },

  async getRoster(teamId) {
    if (!teamId) return [];

    const url = `${this.base}/teams/${teamId}/roster?rosterType=active`;
    const data = await this.fetchJSON(url);

    return data?.roster?.map(item => ({
      id: item.person.id,
      name: item.person.fullName,
      position: item.position.abbreviation
    })) || [];
  },

  async getHitStreak(playerId) {
    if (!playerId) return 0;

    const season = new Date().getFullYear();
    const url = `${this.base}/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}`;
    const data = await this.fetchJSON(url);
    const logs = data?.stats?.[0]?.splits || [];

    let streak = 0;

    for (const game of logs) {
      const hits = Number(game.stat?.hits || 0);
      if (hits >= 1) streak++;
      else break;
    }

    return streak;
  },

  async getBvPHR(batterId, pitcherId) {
  if (!batterId || !pitcherId) return 0;

  const season = new Date().getFullYear();

  const url =
    `${this.base}/people/${batterId}/stats?stats=vsPlayer&group=hitting&opposingPlayerId=${pitcherId}&season=${season}`;

  const data = await this.fetchJSON(url);
  const stat = data?.stats?.[0]?.splits?.[0]?.stat || {};

  return Number(stat.homeRuns || 0);
},

async getPlayerInfo(playerId) {
  if (!playerId) return {};

  const url = `${this.base}/people/${playerId}`;
  const data = await this.fetchJSON(url);

  const person = data?.people?.[0];

  return {
    id: person?.id,
    name: person?.fullName,
    batSide: person?.batSide?.code || "",
    pitchHand: person?.pitchHand?.code || ""
  };
}
};
