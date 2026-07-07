var scoresBox = document.getElementById("scoresBox");
var hrBox = document.getElementById("hrBox");
var gameDetailsBox = document.getElementById("gameDetailsBox");

function getTodayDate() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York"
  });
}

async function loadMLB() {
  var today = getTodayDate();

  scoresBox.innerHTML = "Loading MLB games...";
  hrBox.innerHTML = "Checking home runs...";

  var scheduleURL =
    "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" +
    today +
    "&hydrate=probablePitcher";

  try {
    var response = await fetch(scheduleURL);
    var data = await response.json();
    var games = data.dates && data.dates.length ? data.dates[0].games : [];

    if (games.length === 0) {
      scoresBox.innerHTML = "No MLB games today.";
      hrBox.innerHTML = "No home runs today.";
      return;
    }

    scoresBox.innerHTML = "";
    var homeRuns = [];

    for (var i = 0; i < games.length; i++) {
      var game = games[i];

      var away = game.teams.away.team.name;
      var home = game.teams.home.team.name;
      var awayScore = game.teams.away.score || 0;
      var homeScore = game.teams.home.score || 0;
      var status = game.status.detailedState;
      var gamePk = game.gamePk;

      scoresBox.innerHTML +=
        "<div class='game' onclick='loadGameDetails(" + gamePk + ")'>" +
        "<h3>" + away + " vs " + home + "</h3>" +
        "<p><strong>Score:</strong> " + awayScore + " - " + homeScore + "</p>" +
        "<p><strong>Status:</strong> " + status + "</p>" +
        "<p class='tap-text'>Tap to view pitchers and lineups</p>" +
        "</div>";

      try {
        var liveURL =
          "https://statsapi.mlb.com/api/v1.1/game/" +
          gamePk +
          "/feed/live";

        var liveResponse = await fetch(liveURL);
        var liveData = await liveResponse.json();

        var plays =
          liveData.liveData &&
          liveData.liveData.plays &&
          liveData.liveData.plays.allPlays
            ? liveData.liveData.plays.allPlays
            : [];

        plays.forEach(function(play) {
          if (play.result && play.result.event === "Home Run") {
            var batter =
              play.matchup && play.matchup.batter
                ? play.matchup.batter.fullName
                : "Unknown Hitter";

            var pitcher =
              play.matchup && play.matchup.pitcher
                ? play.matchup.pitcher.fullName
                : "Unknown Pitcher";

            var inning = play.about.halfInning + " " + play.about.inning;
            var description = play.result.description || "Home Run";

            var distance = "N/A";
            var exitVelo = "N/A";

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
              description: description,
              distance: distance,
              exitVelo: exitVelo
            });
          }
        });
      } catch (liveErr) {
        console.log("Live feed error for game " + gamePk, liveErr);
      }
    }

    if (homeRuns.length === 0) {
      hrBox.innerHTML = "<p>No home runs yet today.</p>";
    } else {
      hrBox.innerHTML = "";

      homeRuns.reverse().forEach(function(hr) {
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
  } catch (err) {
    console.log(err);
    scoresBox.innerHTML = "Error loading MLB scores.";
    hrBox.innerHTML = "Error loading home run tracker.";
  }
}

async function loadGameDetails(gamePk) {
  gameDetailsBox.innerHTML = "Loading game details...";

  var liveURL =
    "https://statsapi.mlb.com/api/v1.1/game/" +
    gamePk +
    "/feed/live";

  try {
    var response = await fetch(liveURL);
    var data = await response.json();

    var awayTeam = data.gameData.teams.away.name;
    var homeTeam = data.gameData.teams.home.name;

    var awayPitcher = "TBD";
    var homePitcher = "TBD";

    if (data.gameData.probablePitchers && data.gameData.probablePitchers.away) {
      awayPitcher = data.gameData.probablePitchers.away.fullName;
    }

    if (data.gameData.probablePitchers && data.gameData.probablePitchers.home) {
      homePitcher = data.gameData.probablePitchers.home.fullName;
    }

    var players = data.gameData.players || {};

    var awayOrder =
      data.liveData.boxscore.teams.away.battingOrder || [];

    var homeOrder =
      data.liveData.boxscore.teams.home.battingOrder || [];

    var awayLineup = "";
    var homeLineup = "";

    awayOrder.forEach(function(playerId) {
      var playerKey = "ID" + playerId;
      var playerName = players[playerKey]
        ? players[playerKey].fullName
        : "Unknown Player";

      awayLineup += "<li>" + playerName + "</li>";
    });

    homeOrder.forEach(function(playerId) {
      var playerKey = "ID" + playerId;
      var playerName = players[playerKey]
        ? players[playerKey].fullName
        : "Unknown Player";

      homeLineup += "<li>" + playerName + "</li>";
    });

    if (awayLineup === "") {
      awayLineup = "<li>Lineup not posted yet</li>";
    }

    if (homeLineup === "") {
      homeLineup = "<li>Lineup not posted yet</li>";
    }

    gameDetailsBox.innerHTML =
      "<div class='details-card'>" +
      "<h3>" + awayTeam + " vs " + homeTeam + "</h3>" +
      "<p><strong>Starting Pitchers:</strong></p>" +
      "<p>" + awayPitcher + " vs " + homePitcher + "</p>" +
      "<h4>" + awayTeam + " Lineup</h4>" +
      "<ol>" + awayLineup + "</ol>" +
      "<h4>" + homeTeam + " Lineup</h4>" +
      "<ol>" + homeLineup + "</ol>" +
      "</div>";

    gameDetailsBox.scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    console.log(err);
    gameDetailsBox.innerHTML = "Error loading game details.";
  }
}

loadMLB();
setInterval(loadMLB, 60000);
