const scoresBox = document.getElementById("scoresBox");
const hrBox = document.getElementById("hrBox");
const gameDetailsBox = document.getElementById("gameDetailsBox");

async function loadMLB() {
  scoresBox.innerHTML = "Loading MLB games...";
  hrBox.innerHTML = "Checking home runs...";

  try {
    const data = await API.getSchedule();
    const games = data.dates && data.dates.length ? data.dates[0].games : [];

    if (games.length === 0) {
      scoresBox.innerHTML = "No MLB games today.";
      hrBox.innerHTML = "No home runs today.";
      return;
    }

    scoresBox.innerHTML = "";

    games.forEach(game => {
      const away = game.teams.away.team.name;
      const home = game.teams.home.team.name;
      const awayScore = game.teams.away.score || 0;
      const homeScore = game.teams.home.score || 0;
      const status = game.status.detailedState;
      const gamePk = game.gamePk;

      scoresBox.innerHTML +=
        "<div class='game' onclick='Scouting.load(" + gamePk + ")'>" +
        "<h3>" + away + " vs " + home + "</h3>" +
        "<p><strong>Score:</strong> " + awayScore + " - " + homeScore + "</p>" +
        "<p><strong>Status:</strong> " + status + "</p>" +
        "<p class='tap-text'>Tap to view scouting report</p>" +
        "</div>";
    });

    const homeRuns = await HomeRuns.collectFromGames(games);
    HomeRuns.render(homeRuns, hrBox);

  } catch (err) {
    console.log(err);
    scoresBox.innerHTML = "Error loading MLB scores.";
    hrBox.innerHTML = "Error loading home run tracker.";
  }
}

loadMLB();
setInterval(loadMLB, 60000);
