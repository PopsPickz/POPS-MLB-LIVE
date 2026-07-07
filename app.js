var scoresBox = document.getElementById("scoresBox");
var hrBox = document.getElementById("hrBox");
var gameDetailsBox = document.getElementById("gameDetailsBox");
var pitcherRiskData = {
  "TBD": {
    hr9: 0,
    flyBall: 0,
    hardHit: 0,
    barrel: 0,
    risk: 50,
    note: "Pitcher data not added yet"
  }
};function getTodayDate() {
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
  "<h3>📊 Game Scouting Report</h3>" +
  "<h2>" + awayTeam + " vs " + homeTeam + "</h2>" +

  "<div class='report-section'>" +
  "<h4>⚾ Starting Pitchers</h4>" +
  "<p>" + awayPitcher + " vs " + homePitcher + "</p>" +
  "</div>" +

  "<div class='report-section'>" +
  "<h4>👥 " + awayTeam + " Lineup</h4>" +
  "<ol>" + awayLineup + "</ol>" +
  "</div>" +

  "<div class='report-section'>" +
  "<h4>👥 " + homeTeam + " Lineup</h4>" +
  "<ol>" + homeLineup + "</ol>" +
  "</div>" +

  "<div class='report-section'>" +
"<h4>💣 POPS HR Targets</h4>" +
buildAutoHrTargets(awayOrder, homeOrder, players, awayPitcher, homePitcher) +
"</div>" +

  "<div class='report-section coming-soon'>" +
  "<h4>🔥 POPS Hitterz</h4>" +
  "<p>Coming soon: best bats for hits and total bases.</p>" +
  "</div>" +

  "<div class='report-section coming-soon'>" +
  "<h4>💰 Moneyline Edge</h4>" +
  "<p>Coming soon: starter, bullpen, offense, defense checklist.</p>" +
  "</div>" +

  "<div class='report-section coming-soon'>" +
  "<h4>🌦 Weather / Wind</h4>" +
  "<p>Coming soon: park weather and HR wind direction.</p>" +
  "</div>" +

  "</div>";

    gameDetailsBox.scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    console.log(err);
    gameDetailsBox.innerHTML = "Error loading game details.";
  }
}
function buildAutoHrTargets(awayOrder, homeOrder, players, awayPitcher, homePitcher) {
  var allBatters = [];

awayOrder.forEach(function(playerId) {
  allBatters.push({
    playerId: playerId,
    opponentPitcher: homePitcher
  });
});

homeOrder.forEach(function(playerId) {
  allBatters.push({
    playerId: playerId,
    opponentPitcher: awayPitcher
  });
});
  var targets = [];

  allBatters.forEach(function(item, index) {
  var playerKey = "ID" + item.playerId;
    var player = players[playerKey];

    if (!player) return;

    var name = player.fullName;
    var lineupSpot = (index % 9) + 1;
    var score = 60;
    var reasons = [];

    if (lineupSpot >= 1 && lineupSpot <= 4) {
      score += 15;
      reasons.push("Top 4 lineup spot");
    }

    if (lineupSpot === 3 || lineupSpot === 4) {
      score += 10;
      reasons.push("Prime power spot");
    }

    if (
      name.includes("Judge") ||
      name.includes("Ohtani") ||
      name.includes("Schwarber") ||
      name.includes("Alonso") ||
      name.includes("Olson") ||
      name.includes("Devers") ||
      name.includes("Raleigh") ||
      name.includes("Guerrero") ||
      name.includes("Tatis") ||
      name.includes("Soto")
    ) {
      score += 15;
      reasons.push("Known power bat");
    }

    if (score > 100) score = 100;

    if (score >= 75) {
      "<h4>" + (index + 1) + ". 💣 " + target.name + " vs " + target.pitcher + "</h4>" +
    }
  });

  targets.sort(function(a, b) {
    return b.score - a.score;
  });

  targets = targets.slice(0, 5);

  if (targets.length === 0) {
    return "<p>No strong HR targets found from this lineup yet.</p>";
  }

  var html = "";

  targets.forEach(function(target, index) {
    html +=
      "<div class='pops-target'>" +
      "<h4>" + (index + 1) + ". 💣 " + target.name + " vs " + target.pitcher + "</h4>" +
      "<p><strong>POPS HR Score:</strong> " + target.score + "/100</p>" +
      "<p><strong>Why:</strong> " + target.reasons + "</p>" +
      "</div>";
  });

  return html;
}loadMLB();
setInterval(loadMLB, 60000);
