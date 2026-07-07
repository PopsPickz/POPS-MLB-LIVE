// ===========================
// POPS Live Home Run Tracker
// Version 6.0
// ===========================

const HomeRuns = {

  async collectFromGames(games) {
    let homeRuns = [];

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      await this.collectGame(game, homeRuns);
    }

    return homeRuns;
  },

  async collectGame(game, homeRuns) {
    try {
      const gamePk = game.gamePk;
      const away = game.teams.away.team.name;
      const home = game.teams.home.team.name;

      const liveData = await API.getGame(gamePk);

      const plays =
        liveData.liveData &&
        liveData.liveData.plays &&
        liveData.liveData.plays.allPlays
          ? liveData.liveData.plays.allPlays
          : [];

      plays.forEach(play => {
        if (play.result && play.result.event === "Home Run") {
          const batter =
            play.matchup && play.matchup.batter
              ? play.matchup.batter.fullName
              : "Unknown Hitter";

          const pitcher =
            play.matchup && play.matchup.pitcher
              ? play.matchup.pitcher.fullName
              : "Unknown Pitcher";

          const inning =
            play.about && play.about.halfInning
              ? play.about.halfInning + " " + play.about.inning
              : "N/A";

          let distance = "N/A";
          let exitVelo = "N/A";

          if (play.hitData) {
            if (play.hitData.totalDistance) {
              distance = play.hitData.totalDistance + " ft";
            }

            if (play.hitData.launchSpeed) {
              exitVelo = play.hitData.launchSpeed + " mph";
            }
          }

          homeRuns.push({
            batter: batter,
            pitcher: pitcher,
            game: away + " vs " + home,
            inning: inning,
            description: play.result.description || "Home Run",
            distance: distance,
            exitVelo: exitVelo
          });
        }
      });

    } catch (err) {
      console.log("Home run error:", err);
    }
  },

  render(homeRuns, hrBox) {
    if (!homeRuns || homeRuns.length === 0) {
      hrBox.innerHTML = "<p>No home runs yet today.</p>";
      return;
    }

    hrBox.innerHTML = "";

    homeRuns.reverse().forEach(hr => {
      hrBox.innerHTML +=
        "<div class='hr-card'>" +
        "<h3>💣 " + hr.batter + "</h3>" +
        "<p><strong>Game:</strong> " + hr.game + "</p>" +
        "<p><strong>Pitcher:</strong> " + hr.pitcher + "</p>" +
        "<p><strong>Inning:</strong> " + hr.inning + "</p>" +
        "<p><strong>Distance:</strong> " + hr.distance + "</p>" +
        "<p><strong>Exit Velo:</strong> " + hr.exitVelo + "</p>" +
        "<p>" + hr.description + "</p>" +
        "</div>";
    });
  }

};
