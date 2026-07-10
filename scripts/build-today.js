const fs = require("fs");
const path = require("path");

const MLB_BASE = "https://statsapi.mlb.com/api/v1";
const MLB_LIVE_BASE = "https://statsapi.mlb.com/api/v1.1";

function getLocalDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function fetchJSON(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "POPS-Pickz-MLB"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  return response.json();
}

async function getSchedule(date) {
  const url =
    `${MLB_BASE}/schedule` +
    `?sportId=1` +
    `&date=${date}` +
    `&hydrate=team,probablePitcher,venue`;

  const data = await fetchJSON(url);

  return data?.dates?.[0]?.games || [];
}

async function getLiveGame(gamePk) {
  if (!gamePk) return null;

  const url =
    `${MLB_LIVE_BASE}/game/${gamePk}/feed/live`;

  try {
    return await fetchJSON(url);
  } catch (error) {
    console.warn(
      `Could not load live feed for game ${gamePk}:`,
      error.message
    );

    return null;
  }
}

function getProbablePitcher(game, side) {
  const pitcher =
    game?.teams?.[side]?.probablePitcher || {};

  return {
    id: Number(pitcher.id || 0) || null,
    name: pitcher.fullName || "TBD"
  };
}

function getConfirmedLineup(liveData, side) {
  const teamBox =
    liveData?.liveData?.boxscore?.teams?.[side];

  if (!teamBox) return [];

  const battingOrder = teamBox.battingOrder || [];
  const players = teamBox.players || {};

  return battingOrder
    .map((playerId, index) => {
      const player =
        players[`ID${playerId}`];

      if (!player) return null;

      return {
        id: Number(playerId),
        name:
          player?.person?.fullName ||
          "Unknown",

        position:
          player?.position?.abbreviation ||
          "",

        lineupSpot: index + 1,
        confirmed: true
      };
    })
    .filter(Boolean);
}

async function buildGame(game) {
  const liveData = await getLiveGame(game.gamePk);

  const awayPitcher =
    liveData?.gameData?.probablePitchers?.away ||
    getProbablePitcher(game, "away");

  const homePitcher =
    liveData?.gameData?.probablePitchers?.home ||
    getProbablePitcher(game, "home");

  return {
    gamePk: game.gamePk,
    date: game.gameDate,

    status:
      game?.status?.detailedState ||
      "Scheduled",

    venue:
      game?.venue?.name ||
      "TBD",

    awayTeam:
      game?.teams?.away?.team?.name ||
      "Away Team",

    homeTeam:
      game?.teams?.home?.team?.name ||
      "Home Team",

    awayTeamId:
      Number(game?.teams?.away?.team?.id || 0),

    homeTeamId:
      Number(game?.teams?.home?.team?.id || 0),

    awayPitcher:
      awayPitcher?.fullName ||
      awayPitcher?.name ||
      "TBD",

    homePitcher:
      homePitcher?.fullName ||
      homePitcher?.name ||
      "TBD",

    awayPitcherId:
      Number(awayPitcher?.id || 0) || null,

    homePitcherId:
      Number(homePitcher?.id || 0) || null,

    awayLineup:
      getConfirmedLineup(liveData, "away"),

    homeLineup:
      getConfirmedLineup(liveData, "home")
  };
}

async function buildTodayData() {
  const date = getLocalDate();

  console.log(`Building POPS data for ${date}...`);

  const schedule = await getSchedule(date);
  const games = [];

  for (const game of schedule) {
    console.log(
      `Loading ${game.teams.away.team.name} vs ${game.teams.home.team.name}`
    );

    const builtGame = await buildGame(game);
    games.push(builtGame);
  }

  return {
    generatedAt: new Date().toISOString(),
    date,
    games
  };
}

async function saveTodayData(todayData) {
  const dataDirectory = path.join(
    process.cwd(),
    "data"
  );

  const outputPath = path.join(
    dataDirectory,
    "today.json"
  );

  fs.mkdirSync(dataDirectory, {
    recursive: true
  });

  fs.writeFileSync(
    outputPath,
    JSON.stringify(todayData, null, 2),
    "utf8"
  );

  console.log(
    `POPS data saved to ${outputPath}`
  );
}

async function main() {
  try {
    const todayData = await buildTodayData();
    await saveTodayData(todayData);

    console.log(
      `✅ Finished: ${todayData.games.length} games loaded.`
    );
  } catch (error) {
    console.error(
      "❌ POPS data build failed:",
      error
    );

    process.exitCode = 1;
  }
}

main();
