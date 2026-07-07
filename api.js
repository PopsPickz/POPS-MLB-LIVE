const API = {
  today() {
    return new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York"
    });
  },

  async getSchedule() {
    const url =
      "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" +
      this.today() +
      "&hydrate=probablePitcher";

    const res = await fetch(url);
    if (!res.ok) throw new Error("Schedule API failed");
    return await res.json();
  },

  async getGame(gamePk) {
    const url =
      "https://statsapi.mlb.com/api/v1.1/game/" +
      gamePk +
      "/feed/live";

    const res = await fetch(url);
    if (!res.ok) throw new Error("Game API failed");
    return await res.json();
  },

  async getPitcherStats(playerId) {
    const url =
      "https://statsapi.mlb.com/api/v1/people/" +
      playerId +
      "/stats?stats=season&group=pitching&sportId=1";

    const res = await fetch(url);
    if (!res.ok) throw new Error("Pitcher API failed");
    return await res.json();
  }
};
