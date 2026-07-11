/*
=========================================================
POPS PICKZ WEATHER CENTER
File: weather.js
Version: 3.0
=========================================================

DISPLAY ONLY

This file does NOT affect:

- HR Pickz
- Hit Pickz
- Moneyline
- NRFI
- HR Parlays
- Any POPS prediction formula

Weather is displayed for each game's scheduled start time.
=========================================================
*/

const stadiumWeather = {
  "Yankee Stadium": {
    lat: 40.8296,
    lon: -73.9262
  },

  "Citi Field": {
    lat: 40.7571,
    lon: -73.8458
  },

  "Fenway Park": {
    lat: 42.3467,
    lon: -71.0972
  },

  "Wrigley Field": {
    lat: 41.9484,
    lon: -87.6553
  },

  "Dodger Stadium": {
    lat: 34.0739,
    lon: -118.2400
  },

  "Coors Field": {
    lat: 39.7559,
    lon: -104.9942
  },

  "Oracle Park": {
    lat: 37.7786,
    lon: -122.3893
  },

  "Citizens Bank Park": {
    lat: 39.9061,
    lon: -75.1665
  },

  "Oriole Park at Camden Yards": {
    lat: 39.2840,
    lon: -76.6217
  },

  "Camden Yards": {
    lat: 39.2840,
    lon: -76.6217
  },

  "Truist Park": {
    lat: 33.8908,
    lon: -84.4678
  },

  "Rogers Centre": {
    lat: 43.6414,
    lon: -79.3894
  },

  "Tropicana Field": {
    lat: 27.7683,
    lon: -82.6534
  },

  "loanDepot park": {
    lat: 25.7781,
    lon: -80.2197
  },

  "loanDepot Park": {
    lat: 25.7781,
    lon: -80.2197
  },

  "PNC Park": {
    lat: 40.4469,
    lon: -80.0057
  },

  "Great American Ball Park": {
    lat: 39.0979,
    lon: -84.5082
  },

  "American Family Field": {
    lat: 43.0280,
    lon: -87.9712
  },

  "Busch Stadium": {
    lat: 38.6226,
    lon: -90.1928
  },

  "Daikin Park": {
    lat: 29.7573,
    lon: -95.3555
  },

  "Minute Maid Park": {
    lat: 29.7573,
    lon: -95.3555
  },

  "Globe Life Field": {
    lat: 32.7473,
    lon: -97.0842
  },

  "Kauffman Stadium": {
    lat: 39.0517,
    lon: -94.4803
  },

  "Target Field": {
    lat: 44.9817,
    lon: -93.2776
  },

  "Comerica Park": {
    lat: 42.3390,
    lon: -83.0485
  },

  "Progressive Field": {
    lat: 41.4962,
    lon: -81.6852
  },

  "Rate Field": {
    lat: 41.8300,
    lon: -87.6339
  },

  "Guaranteed Rate Field": {
    lat: 41.8300,
    lon: -87.6339
  },

  "T-Mobile Park": {
    lat: 47.5914,
    lon: -122.3325
  },

  "Angel Stadium": {
    lat: 33.8003,
    lon: -117.8827
  },

  "Oakland Coliseum": {
    lat: 37.7516,
    lon: -122.2005
  },

  "Sutter Health Park": {
    lat: 38.5804,
    lon: -121.5139
  },

  "Petco Park": {
    lat: 32.7073,
    lon: -117.1566
  },

  "Chase Field": {
    lat: 33.4455,
    lon: -112.0667
  },

  "Nationals Park": {
    lat: 38.8730,
    lon: -77.0074
  }
};

/*
=========================================================
GENERAL HELPERS
=========================================================
*/

function weatherNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function normalizeDegrees(degrees) {
  const number = weatherNumber(degrees, 0);

  return ((number % 360) + 360) % 360;
}

function parseWeatherDate(dateString) {
  if (!dateString) {
    return null;
  }

  const normalized =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(
      dateString
    )
      ? `${dateString}:00Z`
      : dateString;

  const date = new Date(normalized);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

/*
=========================================================
WIND DIRECTION

Open-Meteo gives the direction wind comes FROM.

The arrow below points toward the direction the wind
is moving.
=========================================================
*/

function windTowardDegrees(directionFrom) {
  return normalizeDegrees(
    weatherNumber(directionFrom, 0) + 180
  );
}

function windArrow(directionFrom) {
  const toward =
    windTowardDegrees(directionFrom);

  if (
    toward >= 337.5 ||
    toward < 22.5
  ) {
    return "⬆️";
  }

  if (toward < 67.5) {
    return "↗️";
  }

  if (toward < 112.5) {
    return "➡️";
  }

  if (toward < 157.5) {
    return "↘️";
  }

  if (toward < 202.5) {
    return "⬇️";
  }

  if (toward < 247.5) {
    return "↙️";
  }

  if (toward < 292.5) {
    return "⬅️";
  }

  return "↖️";
}

function windCompassDirection(directionFrom) {
  const toward =
    windTowardDegrees(directionFrom);

  if (
    toward >= 337.5 ||
    toward < 22.5
  ) {
    return "North";
  }

  if (toward < 67.5) {
    return "Northeast";
  }

  if (toward < 112.5) {
    return "East";
  }

  if (toward < 157.5) {
    return "Southeast";
  }

  if (toward < 202.5) {
    return "South";
  }

  if (toward < 247.5) {
    return "Southwest";
  }

  if (toward < 292.5) {
    return "West";
  }

  return "Northwest";
}

function getWindDisplay(weather = {}) {
  const speed =
    weatherNumber(weather.wind, 0);

  const direction =
    weatherNumber(
      weather.direction,
      0
    );

  if (speed <= 3) {
    return {
      arrow: "➖",
      label: "Calm wind",
      text: `${Math.round(speed)} mph`
    };
  }

  return {
    arrow: windArrow(direction),

    label:
      `Blowing toward ${
        windCompassDirection(direction)
      }`,

    text: `${Math.round(speed)} mph`
  };
}

/*
=========================================================
DISPLAY HELPERS
=========================================================
*/

function formatWeatherGameTime(dateString) {
  if (!dateString) {
    return "Time TBD";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Time TBD";
  }

  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function weatherConditionIcon(
  rainChance = 0,
  temperature = 70
) {
  const rain =
    weatherNumber(rainChance, 0);

  const temp =
    weatherNumber(temperature, 70);

  if (rain >= 70) {
    return "🌧️";
  }

  if (rain >= 40) {
    return "🌦️";
  }

  if (temp >= 85) {
    return "☀️";
  }

  return "⛅";
}

/*
=========================================================
GAME DATA HELPERS

app.js stores:

game.awayTeam as a string
game.homeTeam as a string
game.venue as a string
game.date as the scheduled start time
=========================================================
*/

function getWeatherAwayTeam(game = {}) {
  if (
    typeof game.awayTeam === "string" &&
    game.awayTeam.trim()
  ) {
    return game.awayTeam.trim();
  }

  if (
    game.awayTeam &&
    typeof game.awayTeam === "object"
  ) {
    return (
      game.awayTeam.name ||
      game.awayTeam.teamName ||
      "Away Team"
    );
  }

  return (
    game?.teams?.away?.team?.name ||
    game?.awayTeamName ||
    game?.away?.name ||
    (
      typeof game?.away === "string"
        ? game.away
        : ""
    ) ||
    "Away Team"
  );
}

function getWeatherHomeTeam(game = {}) {
  if (
    typeof game.homeTeam === "string" &&
    game.homeTeam.trim()
  ) {
    return game.homeTeam.trim();
  }

  if (
    game.homeTeam &&
    typeof game.homeTeam === "object"
  ) {
    return (
      game.homeTeam.name ||
      game.homeTeam.teamName ||
      "Home Team"
    );
  }

  return (
    game?.teams?.home?.team?.name ||
    game?.homeTeamName ||
    game?.home?.name ||
    (
      typeof game?.home === "string"
        ? game.home
        : ""
    ) ||
    "Home Team"
  );
}

function getWeatherStadium(game = {}) {
  if (
    typeof game.venue === "string" &&
    game.venue.trim()
  ) {
    return game.venue.trim();
  }

  if (
    game.venue &&
    typeof game.venue === "object"
  ) {
    return (
      game.venue.name ||
      game.venue.venueName ||
      "Stadium TBD"
    );
  }

  if (
    typeof game.stadium === "string" &&
    game.stadium.trim()
  ) {
    return game.stadium.trim();
  }

  return (
    game?.stadium?.name ||
    game?.venueName ||
    game?.ballpark ||
    "Stadium TBD"
  );
}

function getWeatherGameTime(game = {}) {
  return (
    game?.date ||
    game?.gameDate ||
    game?.dateTime ||
    game?.startTime ||
    game?.gameTime ||
    ""
  );
}

/*
=========================================================
FIND TODAY'S GAMES

Priority:

1. window.games from app.js
2. window.todayData.games from app.js
3. direct variables from app.js
4. API.getSchedule() fallback
=========================================================
*/

async function getWeatherGames() {
  if (
    Array.isArray(window.games) &&
    window.games.length
  ) {
    return window.games;
  }

  if (
    Array.isArray(
      window.todayData?.games
    ) &&
    window.todayData.games.length
  ) {
    return window.todayData.games;
  }

  if (
    typeof games !== "undefined" &&
    Array.isArray(games) &&
    games.length
  ) {
    return games;
  }

  if (
    typeof todayData !== "undefined" &&
    Array.isArray(todayData?.games) &&
    todayData.games.length
  ) {
    return todayData.games;
  }

  if (
    typeof API !== "undefined" &&
    typeof API.getSchedule === "function"
  ) {
    try {
      const scheduleData =
        await API.getSchedule(true);

      if (Array.isArray(scheduleData)) {
        return scheduleData;
      }

      if (
        Array.isArray(
          scheduleData?.games
        )
      ) {
        return scheduleData.games;
      }

      if (
        Array.isArray(
          scheduleData?.dates?.[0]?.games
        )
      ) {
        return scheduleData
          .dates[0]
          .games;
      }

      if (
        Array.isArray(
          scheduleData?.dates
        )
      ) {
        return scheduleData.dates.flatMap(
          dateEntry =>
            Array.isArray(dateEntry?.games)
              ? dateEntry.games
              : []
        );
      }
    } catch (error) {
      console.warn(
        "POPS Weather schedule fallback failed:",
        error
      );
    }
  }

  return [];
}

/*
=========================================================
HOURLY FORECAST MATCHING
=========================================================
*/

function getClosestForecastIndex(
  hourlyTimes = [],
  gameDateString = ""
) {
  if (
    !Array.isArray(hourlyTimes) ||
    !hourlyTimes.length
  ) {
    return 0;
  }

  const gameDate =
    new Date(gameDateString);

  if (
    Number.isNaN(
      gameDate.getTime()
    )
  ) {
    return 0;
  }

  let closestIndex = 0;
  let closestDifference = Infinity;

  hourlyTimes.forEach(
    (timeString, index) => {
      const forecastDate =
        parseWeatherDate(timeString);

      if (!forecastDate) {
        return;
      }

      const difference = Math.abs(
        forecastDate.getTime() -
        gameDate.getTime()
      );

      if (
        difference <
        closestDifference
      ) {
        closestDifference =
          difference;

        closestIndex =
          index;
      }
    }
  );

  return closestIndex;
}

/*
=========================================================
FETCH STADIUM WEATHER
=========================================================
*/

async function fetchStadiumWeather(
  stadium,
  gameDateString
) {
  const location =
    stadiumWeather[stadium];

  if (!location) {
    console.warn(
      `POPS Weather: Stadium not found: ${stadium}`
    );

    return null;
  }

  const hourlyFields = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation_probability",
    "wind_speed_10m",
    "wind_direction_10m"
  ].join(",");

  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${location.lat}` +
    `&longitude=${location.lon}` +
    `&hourly=${hourlyFields}` +
    "&temperature_unit=fahrenheit" +
    "&wind_speed_unit=mph" +
    "&timezone=UTC" +
    "&forecast_days=3";

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Weather request failed: ${response.status}`
    );
  }

  const data =
    await response.json();

  const hourly =
    data?.hourly;

  if (!hourly?.time?.length) {
    return null;
  }

  const index =
    getClosestForecastIndex(
      hourly.time,
      gameDateString
    );

  const temperature =
    Math.round(
      weatherNumber(
        hourly.temperature_2m?.[index],
        0
      )
    );

  const humidity =
    Math.round(
      weatherNumber(
        hourly.relative_humidity_2m?.[index],
        0
      )
    );

  const rain =
    Math.round(
      weatherNumber(
        hourly
          .precipitation_probability?.[index],
        0
      )
    );

  const wind =
    Math.round(
      weatherNumber(
        hourly.wind_speed_10m?.[index],
        0
      )
    );

  const direction =
    weatherNumber(
      hourly.wind_direction_10m?.[index],
      0
    );

  const weather = {
    temp: temperature,
    humidity,
    rain,
    wind,
    direction,

    forecastTime:
      hourly.time[index]
  };

  const windDisplay =
    getWindDisplay(weather);

  weather.arrow =
    windDisplay.arrow;

  weather.windLabel =
    windDisplay.label;

  weather.windText =
    windDisplay.text;

  weather.icon =
    weatherConditionIcon(
      rain,
      temperature
    );

  return weather;
}

/*
=========================================================
WEATHER CARD
=========================================================
*/

function buildWeatherCard({
  matchup,
  stadium,
  gameTime,
  weather
}) {
  if (!weather) {
    return `
      <article class="weather-card">

        <div class="weather-card-header">

          <div>
            <h3>
              🌦️ ${matchup}
            </h3>

            <p class="weather-game-time">
              ${formatWeatherGameTime(
                gameTime
              )}
            </p>
          </div>

        </div>

        <p class="weather-stadium">
          🏟️ ${
            stadium ||
            "Stadium TBD"
          }
        </p>

        <p class="weather-unavailable">
          Weather information is not available for this
          stadium yet.
        </p>

      </article>
    `;
  }

  return `
    <article class="weather-card">

      <div class="weather-card-header">

        <div>

          <h3>
            ${weather.icon}
            ${matchup}
          </h3>

          <p class="weather-game-time">
            ${formatWeatherGameTime(
              gameTime
            )}
          </p>

        </div>

        <div class="weather-temperature">
          ${weather.temp}°F
        </div>

      </div>

      <p class="weather-stadium">
        🏟️ ${stadium}
      </p>

      <div class="weather-details">

        <div class="weather-detail">

          <span class="weather-detail-label">
            Temperature
          </span>

          <strong>
            🌡️ ${weather.temp}°F
          </strong>

        </div>

        <div class="weather-detail">

          <span class="weather-detail-label">
            Wind
          </span>

          <strong class="weather-wind-value">

            <span class="weather-wind-arrow">
              ${weather.arrow}
            </span>

            ${weather.windText}

          </strong>

          <small class="weather-wind-direction">
            ${weather.windLabel}
          </small>

        </div>

        <div class="weather-detail">

          <span class="weather-detail-label">
            Rain chance
          </span>

          <strong>
            🌧️ ${weather.rain}%
          </strong>

        </div>

        <div class="weather-detail">

          <span class="weather-detail-label">
            Humidity
          </span>

          <strong>
            💧 ${weather.humidity}%
          </strong>

        </div>

      </div>

      <p class="weather-display-note">
        Weather information only — not included in POPS
        prediction scores.
      </p>

    </article>
  `;
}

/*
=========================================================
SHOW WEATHER
=========================================================
*/

async function showWeather() {
  const box =
    document.getElementById(
      "weatherBox"
    );

  if (!box) {
    console.warn(
      "POPS Weather: #weatherBox was not found."
    );

    return;
  }

  box.innerHTML = `
    <p class="weather-loading">
      Loading today's MLB weather...
    </p>
  `;

  try {
    const scheduleGames =
      await getWeatherGames();

    if (!scheduleGames.length) {
      box.innerHTML = `
        <p class="weather-empty">
          Today's games are still loading.
          Please wait a moment and tap Weather again.
        </p>
      `;

      return;
    }

    const weatherResults =
      await Promise.all(
        scheduleGames.map(
          async game => {
            const awayTeam =
              getWeatherAwayTeam(game);

            const homeTeam =
              getWeatherHomeTeam(game);

            const matchup =
              `${awayTeam} at ${homeTeam}`;

            const stadium =
              getWeatherStadium(game);

            const gameTime =
              getWeatherGameTime(game);

            let weather = null;

            try {
              weather =
                await fetchStadiumWeather(
                  stadium,
                  gameTime
                );
            } catch (error) {
              console.warn(
                `Weather unavailable for ${stadium}:`,
                error
              );
            }

            return {
              matchup,
              stadium,
              gameTime,
              weather
            };
          }
        )
      );

    box.innerHTML =
      weatherResults
        .map(result =>
          buildWeatherCard(result)
        )
        .join("");

  } catch (error) {
    console.error(
      "POPS Weather load error:",
      error
    );

    box.innerHTML = `
      <p class="weather-error">
        Error loading MLB weather.
      </p>
    `;
  }
}
