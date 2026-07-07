const API = {
  season: new Date().getFullYear(),

  today() {
    return new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York"
    });
  },

  async fetchJSON(url, label = "API") {
    const res = await fetch(url);
    if (!res.ok) throw new Error(label + " failed");
    return await res.json();
  },

  async getSchedule() {
    const url =
      "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" +
      this.today() +
      "&hydrate=probablePitcher";

    return await this.fetchJSON(url, "Schedule API");
  },

  async getGame(gamePk) {
    const url =
      "https://statsapi.mlb.com/api/v1.1/game/" +
      gamePk +
      "/feed/live";

    return await this.fetchJSON(url, "Game API");
  },

  async getPitcherStats(playerId) {
    const url =
      "https://statsapi.mlb.com/api/v1/people/" +
      playerId +
      "/stats?stats=season&group=pitching&sportId=1&season=" +
      this.season;

    return await this.fetchJSON(url, "Pitcher API");
  },

  async getBatterVsPitcher(batterId, pitcherId) {
    const url =
      "https://statsapi.mlb.com/api/v1/people/" +
      batterId +
      "/stats?stats=vsPlayer&group=hitting&opposingPlayerId=" +
      pitcherId;

    return await this.fetchJSON(url, "BvP API");
  },

  async getHitterGameLog(playerId) {
    const url =
      "https://statsapi.mlb.com/api/v1/people/" +
      playerId +
      "/stats?stats=gameLog&group=hitting&season=" +
      this.season;

    return await this.fetchJSON(url, "Hitter Game Log API");
  },

  async getTeamStats(teamId) {
    const url =
      "https://statsapi.mlb.com/api/v1/teams/" +
      teamId +
      "/stats?stats=season&group=hitting,pitching&season=" +
      this.season;

    return await this.fetchJSON(url, "Team Stats API");
  }
};
