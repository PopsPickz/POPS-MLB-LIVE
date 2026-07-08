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
  "Truist Park": { lat: 33.8908, lon: -84.4678 }
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

async function fetchStadiumWeather(stadium) {
  const loc = stadiumWeather[stadium];

  if (!loc) {
    return null;
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=1`;

  const res = await fetch(url);
  const data = await res.json();

  const hour = new Date().getHours();

  return {
    temp: Math.round(data.hourly.temperature_2m[hour]),
    rain: data.hourly.precipitation_probability[hour],
    wind: Math.round(data.hourly.wind_speed_10m[hour]),
    arrow: windArrow(data.hourly.wind_direction_10m[hour])
  };
}

async function showWeather() {
  showTab("weatherSection");

  const box = document.getElementById("weatherBox");
  box.innerHTML = "Loading weather...";

  const testGames = [
    {
      matchup: "Yankees Game",
      stadium: "Yankee Stadium"
    },
    {
      matchup: "Mets Game",
      stadium: "Citi Field"
    }
  ];

  let html = "";

  for (const game of testGames) {
    const weather = await fetchStadiumWeather(game.stadium);

    if (!weather) continue;

    html += `
      <div class="weather-card">
        <h3>🌦️ ${game.matchup}</h3>
        <p>${game.stadium}</p>
        <p>🌡️ Temp: <strong>${weather.temp}°F</strong></p>
        <p>💨 Wind: <strong>${weather.wind} MPH ${weather.arrow}</strong></p>
        <p>🌧️ Rain Chance: <strong>${weather.rain}%</strong></p>
      </div>
    `;
  }

  box.innerHTML = html;
}
