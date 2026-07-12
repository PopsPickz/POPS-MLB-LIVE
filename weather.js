/*
=========================================================
POPS PICKZ WEATHER CENTER
File: weather.js
Version: 5.0 — NOAA / NWS
=========================================================

DISPLAY ONLY

This file does NOT affect:

- HR Pickz
- Hit Pickz
- Moneyline
- NRFI
- HR Parlays
- Any POPS prediction formula

PRIMARY WEATHER SOURCE:
National Weather Service / NOAA

FALLBACK:
Open-Meteo

Rogers Centre uses Open-Meteo because the NWS API
does not provide Canadian forecasts.
=========================================================
*/

const stadiumWeather = {
  "Yankee Stadium": {
    lat: 40.8296,
    lon: -73.9262,
    centerFieldBearing: 285
  },

  "Citi Field": {
    lat: 40.7571,
    lon: -73.8458,
    centerFieldBearing: 37
  },

  "Fenway Park": {
    lat: 42.3467,
    lon: -71.0972,
    centerFieldBearing: 56
  },

  "Wrigley Field": {
    lat: 41.9484,
    lon: -87.6553,
    centerFieldBearing: 28
  },

  "Dodger Stadium": {
    lat: 34.0739,
    lon: -118.2400,
    centerFieldBearing: 26
  },

  "Coors Field": {
    lat: 39.7559,
    lon: -104.9942,
    centerFieldBearing: 16
  },

  "Oracle Park": {
    lat: 37.7786,
    lon: -122.3893,
    centerFieldBearing: 55
  },

  "Citizens Bank Park": {
    lat: 39.9061,
    lon: -75.1665,
    centerFieldBearing: 28
  },

  "Oriole Park at Camden Yards": {
    lat: 39.284,
    lon: -76.6217,
    centerFieldBearing: 32
  },

  "Camden Yards": {
    lat: 39.284,
    lon: -76.6217,
    centerFieldBearing: 32
  },

  "Truist Park": {
    lat: 33.8908,
    lon: -84.4678,
    centerFieldBearing: 18
  },

  "Rogers Centre": {
    lat: 43.6414,
    lon: -79.3894,
    centerFieldBearing: 340,
    useOpenMeteo: true
  },

  "Tropicana Field": {
    lat: 27.7683,
    lon: -82.6534,
    centerFieldBearing: 44
  },

  "loanDepot park": {
    lat: 25.7781,
    lon: -80.2197,
    centerFieldBearing: 48
  },

  "loanDepot Park": {
    lat: 25.7781,
    lon: -80.2197,
    centerFieldBearing: 48
  },

  "PNC Park": {
    lat: 40.4469,
    lon: -80.0057,
    centerFieldBearing: 50
  },

  "Great American Ball Park": {
    lat: 39.0979,
    lon: -84.5082,
    centerFieldBearing: 58
  },

  "American Family Field": {
    lat: 43.028,
    lon: -87.9712,
    centerFieldBearing: 40
  },

  "Busch Stadium": {
    lat: 38.6226,
    lon: -90.1928,
    centerFieldBearing: 30
  },

  "Daikin Park": {
    lat: 29.7573,
    lon: -95.3555,
    centerFieldBearing: 30
  },

  "Minute Maid Park": {
    lat: 29.7573,
    lon: -95.3555,
    centerFieldBearing: 30
  },

  "Globe Life Field": {
    lat: 32.7473,
    lon: -97.0842,
    centerFieldBearing: 25
  },

  "Kauffman Stadium": {
    lat: 39.0517,
    lon: -94.4803,
    centerFieldBearing: 35
  },

  "Target Field": {
    lat: 44.9817,
    lon: -93.2776,
    centerFieldBearing: 72
  },

  "Comerica Park": {
    lat: 42.339,
    lon: -83.0485,
    centerFieldBearing: 25
  },

  "Progressive Field": {
    lat: 41.4962,
    lon: -81.6852,
    centerFieldBearing: 5
  },

  "Rate Field": {
    lat: 41.83,
    lon: -87.6339,
    centerFieldBearing: 135
  },

  "Guaranteed Rate Field": {
    lat: 41.83,
    lon: -87.6339,
    centerFieldBearing: 135
  },

  "T-Mobile Park": {
    lat: 47.5914,
    lon: -122.3325,
    centerFieldBearing: 55
  },

  "Angel Stadium": {
    lat: 33.8003,
    lon: -117.8827,
    centerFieldBearing: 45
  },

  "Oakland Coliseum": {
    lat: 37.7516,
    lon: -122.2005,
    centerFieldBearing: 55
  },

  "Sutter Health Park": {
    lat: 38.5804,
    lon: -121.5139,
    centerFieldBearing: 45
  },

  "Petco Park": {
    lat: 32.7073,
    lon: -117.1566,
    centerFieldBearing: 25
  },

  "Chase Field": {
    lat: 33.4455,
    lon: -112.0667,
    centerFieldBearing: 25
  },

  "Nationals Park": {
    lat: 38.873,
    lon: -77.0074,
    centerFieldBearing: 30
  }
};

/*
=========================================================
CACHE
=========================================================
*/

const weatherCache = {
  nwsPointData: {},
  nwsForecasts: {},
  openMeteo: {}
};

/*
=========================================================
NWS WIND-DIRECTION CONVERSION
=========================================================

NWS wind direction describes where the wind comes FROM.
=========================================================
*/

const NWS_WIND_DEGREES = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5
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

function shortestAngleDifference(first, second) {
  let difference =
    normalizeDegrees(first) -
    normalizeDegrees(second);

  if (difference > 180) {
    difference -= 360;
  }

  if (difference < -180) {
    difference += 360;
  }

  return difference;
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

function getClosestPeriod(periods = [], gameDateString = "") {
  if (!Array.isArray(periods) || !periods.length) {
    return null;
  }

  const gameDate = new Date(gameDateString);

  if (Number.isNaN(gameDate.getTime())) {
    return periods[0];
  }

  let closestPeriod = periods[0];
  let closestDifference = Infinity;

  for (const period of periods) {
    const periodDate = new Date(
      period?.startTime || ""
    );

    if (Number.isNaN(periodDate.getTime())) {
      continue;
    }

    const difference = Math.abs(
      periodDate.getTime() -
      gameDate.getTime()
    );

    if (difference < closestDifference) {
      closestDifference = difference;
      closestPeriod = period;
    }
  }

  return closestPeriod;
}

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

  const gameDate = new Date(gameDateString);

  if (Number.isNaN(gameDate.getTime())) {
    return 0;
  }

  let closestIndex = 0;
  let closestDifference = Infinity;

  hourlyTimes.forEach((timeString, index) => {
    const forecastDate =
      parseWeatherDate(timeString);

    if (!forecastDate) {
      return;
    }

    const difference = Math.abs(
      forecastDate.getTime() -
      gameDate.getTime()
    );

    if (difference < closestDifference) {
      closestDifference = difference;
      closestIndex = index;
    }
  });

  return closestIndex;
}

/*
=========================================================
WIND HELPERS
=========================================================
*/

function nwsDirectionToDegrees(direction = "") {
  const normalized = String(direction)
    .trim()
    .toUpperCase();

  return weatherNumber(
    NWS_WIND_DEGREES[normalized],
    0
  );
}

function parseNwsWindSpeed(value) {
  const matches = String(value || "")
    .match(/\d+(\.\d+)?/g);

  if (!matches?.length) {
    return 0;
  }

  const speeds = matches
    .map(Number)
    .filter(Number.isFinite);

  if (!speeds.length) {
    return 0;
  }

  /*
  NWS may return:
  "5 mph"
  "5 to 10 mph"

  Use the average for a displayed game-time estimate.
  */

  return Math.round(
    speeds.reduce(
      (total, speed) => total + speed,
      0
    ) / speeds.length
  );
}

function windTowardDegrees(directionFrom) {
  return normalizeDegrees(
    weatherNumber(directionFrom, 0) + 180
  );
}

function windCompassDirection(directionFrom) {
  const toward =
    windTowardDegrees(directionFrom);

  if (toward >= 337.5 || toward < 22.5) {
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

/*
=========================================================
BASEBALL WIND DESCRIPTION
=========================================================
*/

function getBaseballWindInfo(
  weather = {},
  stadium = ""
) {
  const speed =
    weatherNumber(weather.wind, 0);

  const directionFrom =
    weatherNumber(weather.direction, 0);

  const towardDegrees =
    windTowardDegrees(directionFrom);

  const stadiumInfo =
    stadiumWeather[stadium];

  const centerFieldBearing =
    weatherNumber(
      stadiumInfo?.centerFieldBearing,
      NaN
    );

  const arrowRotation =
    towardDegrees - 90;

  if (speed <= 3) {
    return {
      type: "calm",
      label: "Calm Wind",
      shortLabel: "Calm",
      impactLabel: "Minimal Wind Impact",
      impactClass: "neutral",
      towardDegrees,
      arrowRotation
    };
  }

  if (!Number.isFinite(centerFieldBearing)) {
    const compass =
      windCompassDirection(directionFrom);

    return {
      type: "compass",
      label: `Blowing Toward ${compass}`,
      shortLabel: compass,
      impactLabel: "Wind Direction Available",
      impactClass: "neutral",
      towardDegrees,
      arrowRotation
    };
  }

  const difference =
    shortestAngleDifference(
      towardDegrees,
      centerFieldBearing
    );

  const absoluteDifference =
    Math.abs(difference);

  let type = "cross";
  let label = "Crosswind Across the Field";
  let shortLabel = "Crosswind";
  let impactLabel = "Neutral Wind";
  let impactClass = "neutral";

  if (absoluteDifference <= 22.5) {
    type = "out-center";
    label = "Blowing Out to Center Field";
    shortLabel = "Out to CF";
    impactLabel = "Favorable for HRs";
    impactClass = "favorable";
  } else if (
    difference > 22.5 &&
    difference <= 67.5
  ) {
    type = "out-right";
    label = "Blowing Out to Right Field";
    shortLabel = "Out to RF";
    impactLabel = "Favorable for HRs";
    impactClass = "favorable";
  } else if (
    difference < -22.5 &&
    difference >= -67.5
  ) {
    type = "out-left";
    label = "Blowing Out to Left Field";
    shortLabel = "Out to LF";
    impactLabel = "Favorable for HRs";
    impactClass = "favorable";
  } else if (absoluteDifference >= 157.5) {
    type = "in-center";
    label = "Blowing In from Center Field";
    shortLabel = "In from CF";
    impactLabel = "Suppressing HR Distance";
    impactClass = "suppressing";
  } else if (
    difference > 112.5 &&
    difference < 157.5
  ) {
    type = "in-left";
    label = "Blowing In from Left Field";
    shortLabel = "In from LF";
    impactLabel = "Suppressing HR Distance";
    impactClass = "suppressing";
  } else if (
    difference < -112.5 &&
    difference > -157.5
  ) {
    type = "in-right";
    label = "Blowing In from Right Field";
    shortLabel = "In from RF";
    impactLabel = "Suppressing HR Distance";
    impactClass = "suppressing";
  } else if (difference > 0) {
    type = "cross-right";
    label = "Crosswind Toward Right Field";
    shortLabel = "Toward RF";
    impactLabel = "Crosswind";
    impactClass = "neutral";
  } else {
    type = "cross-left";
    label = "Crosswind Toward Left Field";
    shortLabel = "Toward LF";
    impactLabel = "Crosswind";
    impactClass = "neutral";
  }

  return {
    type,
    label,
    shortLabel,
    impactLabel,
    impactClass,
    towardDegrees,
    arrowRotation
  };
}

function getWindDisplay(
  weather = {},
  stadium = ""
) {
  const speed =
    weatherNumber(weather.wind, 0);

  const baseballWind =
    getBaseballWindInfo(weather, stadium);

  return {
    label:
      baseballWind.label,

    shortLabel:
      baseballWind.shortLabel,

    impactLabel:
      baseballWind.impactLabel,

    impactClass:
      baseballWind.impactClass,

    type:
      baseballWind.type,

    towardDegrees:
      baseballWind.towardDegrees,

    arrowRotation:
      baseballWind.arrowRotation,

    text:
      `${Math.round(speed)} MPH`
  };
}

/*
=========================================================
CONDITION HELPERS
=========================================================
*/

function getConditionFromText(text = "") {
  const value = String(text).toLowerCase();

  if (
    value.includes("thunder") ||
    value.includes("storm")
  ) {
    return {
      label: text || "Thunderstorms",
      icon: "⛈️"
    };
  }

  if (
    value.includes("snow") ||
    value.includes("sleet")
  ) {
    return {
      label: text || "Snow",
      icon: "🌨️"
    };
  }

  if (
    value.includes("rain") ||
    value.includes("shower")
  ) {
    return {
      label: text || "Rain",
      icon: "🌧️"
    };
  }

  if (
    value.includes("drizzle")
  ) {
    return {
      label: text || "Drizzle",
      icon: "🌦️"
    };
  }

  if (
    value.includes("fog") ||
    value.includes("mist")
  ) {
    return {
      label: text || "Foggy",
      icon: "🌫️"
    };
  }

  if (
    value.includes("mostly cloudy") ||
    value.includes("cloudy") ||
    value.includes("overcast")
  ) {
    return {
      label: text || "Cloudy",
      icon: "☁️"
    };
  }

  if (
    value.includes("partly cloudy") ||
    value.includes("mostly sunny") ||
    value.includes("partly sunny")
  ) {
    return {
      label: text || "Partly Cloudy",
      icon: "🌤️"
    };
  }

  if (
    value.includes("sunny") ||
    value.includes("clear")
  ) {
    return {
      label: text || "Clear",
      icon: "☀️"
    };
  }

  return {
    label: text || "Conditions Available",
    icon: "⛅"
  };
}

function getOpenMeteoCondition(weatherCode = 0) {
  const code =
    weatherNumber(weatherCode, 0);

  if (code === 0) {
    return {
      label: "Clear",
      icon: "☀️"
    };
  }

  if ([1, 2].includes(code)) {
    return {
      label: "Partly Cloudy",
      icon: "🌤️"
    };
  }

  if (code === 3) {
    return {
      label: "Cloudy",
      icon: "☁️"
    };
  }

  if ([45, 48].includes(code)) {
    return {
      label: "Foggy",
      icon: "🌫️"
    };
  }

  if (
    [
      51,
      53,
      55,
      56,
      57
    ].includes(code)
  ) {
    return {
      label: "Drizzle",
      icon: "🌦️"
    };
  }

  if (
    [
      61,
      63,
      65,
      66,
      67,
      80,
      81,
      82
    ].includes(code)
  ) {
    return {
      label: "Rain",
      icon: "🌧️"
    };
  }

  if (
    [
      71,
      73,
      75,
      77,
      85,
      86
    ].includes(code)
  ) {
    return {
      label: "Snow",
      icon: "🌨️"
    };
  }

  if ([95, 96, 99].includes(code)) {
    return {
      label: "Thunderstorms",
      icon: "⛈️"
    };
  }

  return {
    label: "Partly Cloudy",
    icon: "⛅"
  };
}

/*
=========================================================
DISPLAY-ONLY HR WEATHER RATING
=========================================================
*/

function getHRWeatherRating(
  weather = {},
  windInfo = {}
) {
  const temperature =
    weatherNumber(weather.temp, 70);

  const humidity =
    weatherNumber(weather.humidity, 50);

  const rain =
    weatherNumber(weather.rain, 0);

  const wind =
    weatherNumber(weather.wind, 0);

  let score = 3;

  if (temperature >= 90) {
    score += 1;
  } else if (temperature >= 80) {
    score += 0.5;
  } else if (temperature < 60) {
    score -= 1;
  }

  if (windInfo.impactClass === "favorable") {
    if (wind >= 15) {
      score += 1.5;
    } else if (wind >= 8) {
      score += 1;
    } else if (wind >= 4) {
      score += 0.5;
    }
  }

  if (windInfo.impactClass === "suppressing") {
    if (wind >= 15) {
      score -= 1.5;
    } else if (wind >= 8) {
      score -= 1;
    } else if (wind >= 4) {
      score -= 0.5;
    }
  }

  if (humidity >= 75) {
    score += 0.25;
  }

  if (rain >= 60) {
    score -= 1;
  } else if (rain >= 35) {
    score -= 0.5;
  }

  const stars =
    Math.max(
      1,
      Math.min(
        5,
        Math.round(score)
      )
    );

  let label = "Neutral Hitting Weather";
  let ratingClass = "neutral";

  if (stars >= 5) {
    label = "Excellent Hitting Weather";
    ratingClass = "excellent";
  } else if (stars === 4) {
    label = "Good Hitting Weather";
    ratingClass = "good";
  } else if (stars === 2) {
    label = "Poor Hitting Weather";
    ratingClass = "poor";
  } else if (stars === 1) {
    label = "Strong HR Suppression";
    ratingClass = "suppressing";
  }

  return {
    stars,
    label,
    ratingClass
  };
}

function buildWeatherStars(totalStars = 3) {
  let html = "";

  for (
    let index = 1;
    index <= 5;
    index++
  ) {
    html += `
      <span
        class="weather-rating-star ${
          index <= totalStars
            ? "filled"
            : "empty"
        }"
      >
        ★
      </span>
    `;
  }

  return html;
}

/*
=========================================================
FINALIZE WEATHER OBJECT
=========================================================
*/

function finalizeWeather(
  rawWeather,
  stadium,
  source
) {
  if (!rawWeather) {
    return null;
  }

  const weather = {
    ...rawWeather,
    source
  };

  const windDisplay =
    getWindDisplay(weather, stadium);

  weather.windLabel =
    windDisplay.label;

  weather.windShortLabel =
    windDisplay.shortLabel;

  weather.windText =
    windDisplay.text;

  weather.windImpact =
    windDisplay.impactLabel;

  weather.windImpactClass =
    windDisplay.impactClass;

  weather.windType =
    windDisplay.type;

  weather.towardDegrees =
    windDisplay.towardDegrees;

  weather.arrowRotation =
    windDisplay.arrowRotation;

  weather.rating =
    getHRWeatherRating(
      weather,
      windDisplay
    );

  return weather;
}

/*
=========================================================
NATIONAL WEATHER SERVICE
=========================================================
*/

async function fetchNwsJSON(url) {
  const response = await fetch(url, {
    cache: "no-store",

    headers: {
      Accept:
        "application/geo+json, application/ld+json, application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `NWS request failed: HTTP ${response.status}`
    );
  }

  return response.json();
}

async function getNwsHourlyForecastURL(location) {
  const key =
    `${location.lat},${location.lon}`;

  if (weatherCache.nwsPointData[key]) {
    return weatherCache.nwsPointData[key];
  }

  const pointsURL =
    "https://api.weather.gov/points/" +
    `${location.lat},${location.lon}`;

  const pointData =
    await fetchNwsJSON(pointsURL);

  const hourlyURL =
    pointData?.properties?.forecastHourly;

  if (!hourlyURL) {
    throw new Error(
      "NWS forecastHourly URL was unavailable."
    );
  }

  weatherCache.nwsPointData[key] =
    hourlyURL;

  return hourlyURL;
}

async function fetchNwsStadiumWeather(
  stadium,
  gameDateString
) {
  const location =
    stadiumWeather[stadium];

  if (!location) {
    return null;
  }

  const hourlyURL =
    await getNwsHourlyForecastURL(location);

  let forecastData =
    weatherCache.nwsForecasts[hourlyURL];

  if (!forecastData) {
    forecastData =
      await fetchNwsJSON(hourlyURL);

    weatherCache.nwsForecasts[hourlyURL] =
      forecastData;
  }

  const periods =
    forecastData?.properties?.periods || [];

  const period =
    getClosestPeriod(
      periods,
      gameDateString
    );

  if (!period) {
    return null;
  }

  const wind =
    parseNwsWindSpeed(
      period.windSpeed
    );

  const direction =
    nwsDirectionToDegrees(
      period.windDirection
    );

  const rain =
    Math.round(
      weatherNumber(
        period
          ?.probabilityOfPrecipitation
          ?.value,
        0
      )
    );

  const humidity =
    Math.round(
      weatherNumber(
        period
          ?.relativeHumidity
          ?.value,
        0
      )
    );

  const condition =
    getConditionFromText(
      period.shortForecast
    );

  return finalizeWeather(
    {
      temp:
        Math.round(
          weatherNumber(
            period.temperature,
            0
          )
        ),

      humidity,
      rain,
      wind,
      direction,

      condition:
        condition.label,

      icon:
        condition.icon,

      forecastTime:
        period.startTime
    },
    stadium,
    "National Weather Service"
  );
}

/*
=========================================================
OPEN-METEO FALLBACK
=========================================================
*/

async function fetchOpenMeteoWeather(
  stadium,
  gameDateString
) {
  const location =
    stadiumWeather[stadium];

  if (!location) {
    return null;
  }

  const hourlyFields = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation_probability",
    "wind_speed_10m",
    "wind_direction_10m",
    "weather_code"
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

  let data =
    weatherCache.openMeteo[url];

  if (!data) {
    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Open-Meteo request failed: HTTP ${response.status}`
      );
    }

    data = await response.json();

    weatherCache.openMeteo[url] =
      data;
  }

  const hourly = data?.hourly;

  if (!hourly?.time?.length) {
    return null;
  }

  const index =
    getClosestForecastIndex(
      hourly.time,
      gameDateString
    );

  const weatherCode =
    weatherNumber(
      hourly.weather_code?.[index],
      0
    );

  const condition =
    getOpenMeteoCondition(
      weatherCode
    );

  return finalizeWeather(
    {
      temp:
        Math.round(
          weatherNumber(
            hourly
              .temperature_2m?.[index],
            0
          )
        ),

      humidity:
        Math.round(
          weatherNumber(
            hourly
              .relative_humidity_2m?.[
                index
              ],
            0
          )
        ),

      rain:
        Math.round(
          weatherNumber(
            hourly
              .precipitation_probability?.[
                index
              ],
            0
          )
        ),

      wind:
        Math.round(
          weatherNumber(
            hourly
              .wind_speed_10m?.[index],
            0
          )
        ),

      direction:
        weatherNumber(
          hourly
            .wind_direction_10m?.[
              index
            ],
          0
        ),

      condition:
        condition.label,

      icon:
        condition.icon,

      forecastTime:
        hourly.time[index]
    },
    stadium,
    "Open-Meteo fallback"
  );
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

  /*
  Canadian stadium.
  */

  if (location.useOpenMeteo) {
    return fetchOpenMeteoWeather(
      stadium,
      gameDateString
    );
  }

  /*
  Use NWS first for U.S. stadiums.
  */

  try {
    return await fetchNwsStadiumWeather(
      stadium,
      gameDateString
    );
  } catch (nwsError) {
    console.warn(
      `NWS weather failed for ${stadium}. Using fallback:`,
      nwsError
    );

    return fetchOpenMeteoWeather(
      stadium,
      gameDateString
    );
  }
}

/*
=========================================================
GAME DATA HELPERS
=========================================================
*/

function formatWeatherGameTime(dateString) {
  if (!dateString) {
    return "Time TBD";
  }

  const date =
    new Date(dateString);

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

function getWeatherAwayTeam(game = {}) {
  if (
    typeof game.awayTeam === "string" &&
    game.awayTeam.trim()
  ) {
    return game.awayTeam.trim();
  }

  return (
    game?.awayTeam?.name ||
    game?.teams?.away?.team?.name ||
    game?.awayTeamName ||
    game?.away?.name ||
    game?.away ||
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

  return (
    game?.homeTeam?.name ||
    game?.teams?.home?.team?.name ||
    game?.homeTeamName ||
    game?.home?.name ||
    game?.home ||
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

  return (
    game?.venue?.name ||
    game?.venueName ||
    game?.stadium?.name ||
    game?.stadium ||
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
    Array.isArray(window.todayData?.games) &&
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
        Array.isArray(scheduleData?.games)
      ) {
        return scheduleData.games;
      }

      if (
        Array.isArray(
          scheduleData?.dates?.[0]?.games
        )
      ) {
        return scheduleData.dates[0].games;
      }

      if (
        Array.isArray(scheduleData?.dates)
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
      <article class="weather-card weather-card-unavailable">

        <div class="weather-card-header">
          <div>
            <h3>🌦️ ${matchup}</h3>

            <p class="weather-game-time">
              ${formatWeatherGameTime(gameTime)}
            </p>
          </div>
        </div>

        <p class="weather-stadium">
          🏟️ ${stadium || "Stadium TBD"}
        </p>

        <p class="weather-unavailable">
          Weather information is currently unavailable.
        </p>

      </article>
    `;
  }

  const rating =
    weather.rating || {
      stars: 3,
      label: "Neutral Hitting Weather",
      ratingClass: "neutral"
    };

  return `
    <article
      class="
        weather-card
        premium-weather-card
        weather-rating-${rating.ratingClass}
      "
    >

      <div class="weather-card-top">

        <div class="weather-matchup">

          <span class="weather-baseball-icon">
            ⚾
          </span>

          <h3>
            ${matchup}
          </h3>

        </div>

        <div class="weather-condition-badge">

          <span>
            ${weather.icon}
          </span>

          <strong>
            ${weather.condition}
          </strong>

        </div>

      </div>

      <div class="weather-game-meta">

        <span>
          🕒 ${formatWeatherGameTime(gameTime)}
        </span>

        <span>
          🏟️ ${stadium}
        </span>

      </div>

      <div class="weather-main-grid">

        <div class="weather-wind-panel">

          <div class="weather-wind-heading">
            <span></span>
            <strong>WIND</strong>
            <span></span>
          </div>

          <div class="weather-wind-speed">
            ${weather.windText}
          </div>

          <div class="weather-compass">

            <span class="weather-compass-north">
              N
            </span>

            <span class="weather-compass-east">
              E
            </span>

            <span class="weather-compass-south">
              S
            </span>

            <span class="weather-compass-west">
              W
            </span>

            <div class="weather-compass-circle">

              <span
                class="weather-wind-arrow-large"
                style="
                  --wind-arrow-rotation:
                  ${weather.arrowRotation}deg;
                "
              >
                ➜
              </span>

              <span
                class="weather-wind-streak streak-one"
              ></span>

              <span
                class="weather-wind-streak streak-two"
              ></span>

              <span
                class="weather-wind-streak streak-three"
              ></span>

            </div>

          </div>

          <div
            class="
              weather-baseball-wind-label
              ${weather.windImpactClass}
            "
          >
            ${weather.windLabel}
          </div>

          <div
            class="
              weather-wind-impact
              ${weather.windImpactClass}
            "
          >
            ${weather.windImpact}
          </div>

        </div>

        <div class="weather-stat-panel">

          <div class="weather-premium-stat temperature">

            <span class="weather-stat-icon">
              🌡️
            </span>

            <div>
              <small>Temperature</small>

              <strong>
                ${weather.temp}°F
              </strong>
            </div>

          </div>

          <div class="weather-premium-stat humidity">

            <span class="weather-stat-icon">
              💧
            </span>

            <div>
              <small>Humidity</small>

              <strong>
                ${weather.humidity}%
              </strong>
            </div>

          </div>

          <div class="weather-premium-stat rain">

            <span class="weather-stat-icon">
              🌧️
            </span>

            <div>
              <small>Rain Chance</small>

              <strong>
                ${weather.rain}%
              </strong>
            </div>

          </div>

          <div class="weather-premium-stat conditions">

            <span class="weather-stat-icon">
              ${weather.icon}
            </span>

            <div>
              <small>Conditions</small>

              <strong>
                ${weather.condition}
              </strong>
            </div>

          </div>

        </div>

      </div>

      <div
        class="
          weather-rating-panel
          ${rating.ratingClass}
        "
      >

        <div class="weather-rating-title">
          <span></span>

          <strong>
            🔥 HR WEATHER RATING
          </strong>

          <span></span>
        </div>

        <div class="weather-rating-content">

          <div class="weather-rating-stars">
            ${buildWeatherStars(rating.stars)}
          </div>

          <div class="weather-rating-label">

            <strong>
              ${rating.label}
            </strong>

            <small>
              Display only
            </small>

          </div>

        </div>

      </div>

      <p class="weather-display-note">
        ⓘ Source: ${weather.source}. Weather information
        is not included in POPS prediction scores.
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
    document.getElementById("weatherBox");

  if (!box) {
    console.warn(
      "POPS Weather: #weatherBox was not found."
    );

    return;
  }

  box.innerHTML = `
    <p class="weather-loading">
      Loading NOAA game-time weather...
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
        scheduleGames.map(async game => {
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
        })
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
