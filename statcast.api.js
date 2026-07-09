const StatcastAPI = {
  cache: {},

  currentSeason() {
    return new Date().getFullYear();
  },

  seasonStart() {
    return `${this.currentSeason()}-03-01`;
  },

  seasonEnd() {
    return `${this.currentSeason()}-11-30`;
  },

  async fetchCSV(url) {
    try {
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Statcast HTTP ${res.status}`);
      }

      return await res.text();
    } catch (err) {
      console.warn("Statcast API error:", err);
      return "";
    }
  },

  parseCSV(text) {
    if (!text || !text.trim()) return [];

    const rows = [];
    let current = "";
    let row = [];
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && insideQuotes && next === '"') {
        current += '"';
        i++;
        continue;
      }

      if (char === '"') {
        insideQuotes = !insideQuotes;
        continue;
      }

      if (char === "," && !insideQuotes) {
        row.push(current);
        current = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !insideQuotes) {
        if (current || row.length) {
          row.push(current);
          rows.push(row);
          row = [];
          current = "";
        }
        continue;
      }

      current += char;
    }

    if (current || row.length) {
      row.push(current);
      rows.push(row);
    }

    if (rows.length < 2) return [];

    const headers = rows[0].map(h => h.trim());

    return rows.slice(1).map(values => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] ?? "";
      });
      return obj;
    });
  },

  num(value) {
    const n = Number(String(value ?? "").replace("%", ""));
    return Number.isFinite(n) ? n : 0;
  },

  buildUrl(playerId) {
    const start = this.seasonStart();
    const end = this.seasonEnd();

    return (
      "https://baseballsavant.mlb.com/statcast_search/csv?" +
      "all=true" +
      "&hfPT=" +
      "&hfAB=" +
      "&hfGT=R%7C" +
      "&hfPR=" +
      "&hfZ=" +
      "&stadium=" +
      "&hfBBL=" +
      "&hfNewZones=" +
      "&hfPull=" +
      "&hfC=" +
      `&hfSea=${this.currentSeason()}%7C` +
      "&hfSit=" +
      "&player_type=batter" +
      "&hfOuts=" +
      "&opponent=" +
      "&pitcher_throws=" +
      "&batter_stands=" +
      "&hfSA=" +
      `&game_date_gt=${start}` +
      `&game_date_lt=${end}` +
      "&team=" +
      "&position=" +
      "&hfRO=" +
      "&home_road=" +
      `&batters_lookup%5B%5D=${playerId}` +
      "&hfFlag=" +
      "&hfBBT=" +
      "&metric_1=" +
      "&hfInn=" +
      "&min_pitches=0" +
      "&min_results=0" +
      "&group_by=name" +
      "&sort_col=launch_speed" +
      "&player_event_sort=h_launch_speed" +
      "&sort_order=desc" +
      "&min_pas=0" +
      "&type=details"
    );
  },

  calculateFromRows(rows = []) {
    const battedBalls = rows.filter(row => {
      const launchSpeed = this.num(row.launch_speed);
      const launchAngle = row.launch_angle !== "" && row.launch_angle !== undefined;
      return launchSpeed > 0 && launchAngle;
    });

    const total = battedBalls.length;

    if (!total) {
      return {
        barrelRate: 0,
        hardHitRate: 0,
        exitVelocity: 0,
        avgExitVelo: 0,
        flyBallRate: 0,
        statcastPA: 0,
        hasStatcastData: false
      };
    }

    const hardHits = battedBalls.filter(row => this.num(row.launch_speed) >= 95).length;

    const barrels = battedBalls.filter(row => {
      const ev = this.num(row.launch_speed);
      const la = this.num(row.launch_angle);

      return ev >= 98 && la >= 26 && la <= 30;
    }).length;

    const flyBalls = battedBalls.filter(row => {
      const la = this.num(row.launch_angle);
      return la >= 25 && la <= 50;
    }).length;

    const avgExitVelo =
      battedBalls.reduce((sum, row) => sum + this.num(row.launch_speed), 0) / total;

    return {
      barrelRate: Number(((barrels / total) * 100).toFixed(1)),
      hardHitRate: Number(((hardHits / total) * 100).toFixed(1)),
      exitVelocity: Number(avgExitVelo.toFixed(1)),
      avgExitVelo: Number(avgExitVelo.toFixed(1)),
      flyBallRate: Number(((flyBalls / total) * 100).toFixed(1)),
      statcastPA: total,
      hasStatcastData: true
    };
  },

  async getPlayerPowerStats(playerId) {
    if (!playerId) {
      return {
        barrelRate: 0,
        hardHitRate: 0,
        exitVelocity: 0,
        avgExitVelo: 0,
        flyBallRate: 0,
        statcastPA: 0,
        hasStatcastData: false
      };
    }

    if (this.cache[playerId]) {
      return this.cache[playerId];
    }

    const url = this.buildUrl(playerId);
    const csv = await this.fetchCSV(url);
    const rows = this.parseCSV(csv);
    const stats = this.calculateFromRows(rows);

    this.cache[playerId] = stats;
    return stats;
  }
};
