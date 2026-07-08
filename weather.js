const stadiumWeather = {
  "Yankee Stadium": { lat: 40.8296, lon: -73.9262 },
  "Citi Field": { lat: 40.7571, lon: -73.8458 },
  "Fenway Park": { lat: 42.3467, lon: -71.0972 },
  "Wrigley Field": { lat: 41.9484, lon: -87.6553 },
  "Dodger Stadium": { lat: 34.0739, lon: -118.2400 },
  "Coors Field": { lat: 39.7559, lon: -104.9942 },
  "Oracle Park": { lat: 37.7786, lon: -122.3893 },
  "Citizens Bank Park": { lat: 39.9061, lon: -75.1665 },
  "Camden Yards": { lat: 39.2840, lon: -76.6217 },
  "Truist Park": { lat: 33.8908, lon: -84.4678 },
  "Rogers Centre": { lat: 43.6414, lon: -79.3894 },
  "Tropicana Field": { lat: 27.7683, lon: -82.6534 },
  "loanDepot park": { lat: 25.7781, lon: -80.2197 },
  "PNC Park": { lat: 40.4469, lon: -80.0057 },
  "Great American Ball Park": { lat: 39.0979, lon: -84.5082 },
  "American Family Field": { lat: 43.0280, lon: -87.9712 },
  "Busch Stadium": { lat: 38.6226, lon: -90.1928 },
  "Minute Maid Park": { lat: 29.7573, lon: -95.3555 },
  "Globe Life Field": { lat: 32.7473, lon: -97.0842 },
  "Kauffman Stadium": { lat: 39.0517, lon: -94.4803 },
  "Target Field": { lat: 44.9817, lon: -93.2776 },
  "Comerica Park": { lat: 42.3390, lon: -83.0485 },
  "Progressive Field": { lat: 41.4962, lon: -81.6852 },
  "Rate Field": { lat: 41.8300, lon: -87.6339 },
  "T-Mobile Park": { lat: 47.5914, lon: -122.3325 },
  "Angel Stadium": { lat: 33.8003, lon: -117.8827 },
  "Oakland Coliseum": { lat: 37.7516, lon: -122.2005 },
  "Sutter Health Park": { lat: 38.5804, lon: -121.5139 },
  "Petco Park": { lat: 32.7073, lon: -117.1566 },
  "Chase Field": { lat: 33.4455, lon: -112.0667 },
  "Nationals Park": { lat: 38.8730, lon: -77.0074 }
};

function windArrow(deg) {
  if (deg >= 337 || deg < 22) return "⬆️";
  if (deg < 67) return "↗️";
  if (deg < 112) return "➡️";
  if (deg < 157) return "↘️";
  if (deg < 202) return "⬇️";
  if (deg < 247) return "↙️";
  if (deg < 292) return "⬅️";
  return "↖️";
}

function getWeatherScore(weather = {}) {
  let score = 0;

  const wind = Number(weather.wind || 0);
  const temp = Number(weather.temp || 0);
  const rain = Number(weather.rain || 0);
  const windType = weather.windType || "neutral";

  if (windType === "out" && wind >= 15) score += 8;
  else if (windType === "out" && wind >= 8) score += 5;

  if (windType === "in" && wind >= 15) score -= 8;
  else if (windType === "in" && wind >= 8) score -= 5;

  if (temp >= 90) score += 5;
  else if (temp >= 85) score += 3;
  else if (temp < 60) score -= 3;

  if (rain >= 40) score -= 5;

  return Math.max(0, Math.min(score, 15));
}

async function fetchStadiumWeather(stadium) {
  const loc = stadiumWeather[stadium];

  if (!loc) return null;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=1`;

  const res = await fetch(url);
  const data = await res.json();

  const hour = new Date().getHours();

  const temp = Math.round(data.hourly.temperature_2m[hour]);
  const rain = data.hourly.precipitation_probability[hour];
  const wind = Math.round(data.hourly.wind_speed_10m[hour]);
  const direction = data.hourly.wind_direction_10m[hour];

  const weather = {
    temp,
    rain,
    wind,
    direction,
    arrow: windArrow(direction),
    windType: "neutral"
  };

  weather.weatherScore = getWeatherScore(weather);

  return weather;
}

async function showWeather() {
  showTab("weatherSection");

  const box = document.getElementById("weatherBox");
  box.innerHTML = "Loading today's MLB weather...";

  try {
    const data = await API.getSchedule();
    const games = data.dates?.[0]?.games || [];

    if (!games.length) {
      box.innerHTML = "No MLB games today.";
      return;
    }

    let html = "";

    for (const game of games) {
      const matchup =
        game.teams.away.team.name + " vs " + game.teams.home.team.name;

      const stadium = game.venue?.name || "";
      const weather = await fetchStadiumWeather(stadium);

      if (!weather) {
        html += `
          <div class="weather-card">
            <h3>🌦️ ${matchup}</h3>
            <p>${stadium}</p>
            <p>Weather not available for this stadium yet.</p>
          </div>
        `;
        continue;
      }

      html += `
        <div class="weather-card">
          <h3>🌦️ ${matchup}</h3>
          <p>${stadium}</p>
          <p>🌡️ Temp: <strong>${weather.temp}°F</strong></p>
          <p>💨 Wind: <strong>${weather.wind} MPH ${weather.arrow}</strong></p>
          <p>🌧️ Rain Chance: <strong>${weather.rain}%</strong></p>
          <p>💣 HR Weather Score: <strong>${weather.weatherScore}/15</strong></p>
        </div>
      `;
    }

    box.innerHTML = html;

  } catch (err) {
    console.log("Weather load error:", err);
    box.innerHTML = "Error loading MLB weather.";
  }
}
