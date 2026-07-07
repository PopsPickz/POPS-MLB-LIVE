var scoresBox = document.getElementById("scoresBox");
var lineupsBox = document.getElementById("lineupsBox");
var hrBox = document.getElementById("hrBox");

function getTodayDate() {
  var now = new Date();

  return now.toLocaleDateString("en-CA", {
    timeZone: "America/New_York"
  });
}

async function loadMLB() {
  var today = getTodayDate();

  scoresBox.innerHTML = "Loading games for " + today + "...";
  lineupsBox.innerHTML = "Lineups will load after scores.";
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

    games.forEach(function(game) {
      var away = game.teams.away.team.name;
      var home = game.teams.home.team.name;
      var awayScore = game.teams.away.score || 0;
      var homeScore = game.teams.home.score || 0;
      var status = game.status.detailedState;

      scoresBox.innerHTML +=
        "<div class='game'>" +
        "<h3>" + away + " vs " + home + "</h3>" +
        "<p><strong>Score:</strong> " + awayScore + " - " + homeScore + "</p>" +
        "<p><strong>Status:</strong> " + status + "</p>" +
        "</div>";
    });

    hrBox.innerHTML = "💣 Home run tracker comes next.";

  } catch (err) {
    scoresBox.innerHTML = "Error loading MLB data.";
    hrBox.innerHTML = "Error loading home runs.";
  }
}

loadMLB();
setInterval(loadMLB, 60000);
