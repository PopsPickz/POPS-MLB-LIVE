const API = {
  getToday() {
    return new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York"
    });
  },

  async getSchedule() {
    const url =
      "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" +
      this.getToday() +
      "&hydrate=probablePitcher";

    const response = await fetch(url);
    return await response.json();
  },

  async getGame(gamePk) {
  const url =
    "https://statsapi.mlb.com/api/v1.1/game/" +
    gamePk +
    "/feed/live";

  const response = await fetch(url);
  return await response.json();
},

async getPitcherStats(playerId) {
  const url =
    "https://statsapi.mlb.com/api/v1/people/" +
    playerId +
    "/stats?stats=season&group=pitching&sportId=1";

  const response = await fetch(url);
  return await response.json();
}
