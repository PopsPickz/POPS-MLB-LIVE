const HomeRuns = {
  async collectFromGames(games) {
    let homeRuns = [];

    for (const game of games) {
      try {
        const liveData = await API.getGame(game.gamePk);
        const plays = liveData.liveData?.plays?.allPlays || [];

        plays.forEach(play => {
          if (play.result?.event === "Home Run") {
            homeRuns.push({
              batter: play.matchup?.batter?.fullName || "Unknown Hitter",
              pitcher: play.matchup?.pitcher?.fullName || "Unknown Pitcher",
              game: game.teams.away.team.name + " vs " + game.teams.home.team.name,
              inning: play.about?.halfInning + " " + play.about?.inning,
              description: play.result?.description || "Home Run",
              distance: play.hitData?.totalDistance ? play.hitData.totalDistance + " ft" : "N/A",
              exitVelo: play.hitData?.launchSpeed ? play.hitData.launchSpeed + " mph" : "N/A"
            });
          }
        });

      } catch (err) {
        console.log("HR tracker error:", err);
      }
    }

    return homeRuns;
  },

  render(homeRuns, box) {
    if (!box) return;

    if (!homeRuns.length) {
      box.innerHTML = `
        <div class="pick-card">
          <h3>💣 No home runs yet</h3>
          <p class="small">Live tracker updates every 60 seconds.</p>
        </div>
      `;
      return;
    }

    box.innerHTML = homeRuns.reverse().map(hr => `
      <div class="pick-card">
        <h3>💣 ${hr.batter}</h3>
        <p><strong>Game:</strong> ${hr.game}</p>
        <p><strong>Pitcher:</strong> ${hr.pitcher}</p>
        <p><strong>Inning:</strong> ${hr.inning}</p>
        <p><strong>Distance:</strong> ${hr.distance}</p>
        <p><strong>Exit Velo:</strong> ${hr.exitVelo}</p>
        <p class="small">${hr.description}</p>
      </div>
    `).join("");
  }
};
