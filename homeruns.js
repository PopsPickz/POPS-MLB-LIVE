const HomeRuns = {
  async collectFromGames(games = []) {
    const homeRuns = [];

    if (!Array.isArray(games) || games.length === 0) {
      return homeRuns;
    }

    for (const game of games) {
      try {
        const gamePk = game.gamePk;
        if (!gamePk) continue;

        const liveData = await API.getGame(gamePk);
        const plays = liveData?.liveData?.plays?.allPlays || [];

        plays.forEach(play => {
          const event = play?.result?.event || "";

          if (event.toLowerCase() !== "home run") return;

          const batter = play?.matchup?.batter?.fullName || "Unknown Hitter";
          const pitcher = play?.matchup?.pitcher?.fullName || "Unknown Pitcher";

          const awayTeam =
            game?.teams?.away?.team?.name ||
            liveData?.gameData?.teams?.away?.name ||
            "Away Team";

          const homeTeam =
            game?.teams?.home?.team?.name ||
            liveData?.gameData?.teams?.home?.name ||
            "Home Team";

          homeRuns.push({
            batter,
            pitcher,
            game: `${awayTeam} vs ${homeTeam}`,
            inning: `${play?.about?.halfInning || ""} ${play?.about?.inning || ""}`.trim(),
            description: play?.result?.description || "Home Run",
            distance: play?.hitData?.totalDistance
              ? `${play.hitData.totalDistance} ft`
              : "Tracking soon",
            exitVelo: play?.hitData?.launchSpeed
              ? `${play.hitData.launchSpeed} mph`
              : "Tracking soon"
          });
        });
      } catch (error) {
        console.log("POPS HR tracker error:", error);
      }
    }

    return homeRuns;
  },

  render(homeRuns = [], box) {
    if (!box) return;

    if (!Array.isArray(homeRuns) || homeRuns.length === 0) {
      box.innerHTML = `
        <div class="pick-card">
          <h3>💣 No home runs yet</h3>
          <p class="small">POPS live HR tracker updates automatically once home runs are recorded.</p>
        </div>
      `;
      return;
    }

    const newestFirst = [...homeRuns].reverse();

    box.innerHTML = newestFirst.map(hr => `
      <div class="pick-card">
        <h3>💣 ${hr.batter}</h3>
        <p><strong>Game:</strong> ${hr.game}</p>
        <p><strong>Pitcher:</strong> ${hr.pitcher}</p>
        <p><strong>Inning:</strong> ${hr.inning || "N/A"}</p>
        <p><strong>Distance:</strong> ${hr.distance}</p>
        <p><strong>Exit Velo:</strong> ${hr.exitVelo}</p>
        <p class="small">${hr.description}</p>
      </div>
    `).join("");
  }
};