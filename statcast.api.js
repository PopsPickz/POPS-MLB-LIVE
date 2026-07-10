const StatcastAPI = {
  cache: {},

  /*
  =========================================================
  GENERAL HELPERS
  =========================================================
  */

  currentSeason() {
    return new Date().getFullYear();
  },

  today() {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
      now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  },

  seasonStart() {
    return `${this.currentSeason()}-03-01`;
  },

  seasonEnd() {
    /*
    Use today's date instead of November 30.
    This avoids requesting future Statcast dates.
    */
    return this.today();
  },

  num(value) {
    const number = Number(
      String(value ?? "")
        .replace("%", "")
        .trim()
    );

    return Number.isFinite(number)
      ? number
      : 0;
  },

  round(value, places = 1) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return 0;
    }

    return Number(
      number.toFixed(places)
    );
  },

  emptyStats() {
    return {
      available: false,
      hasStatcastData: false,

      battedBalls: 0,
      statcastPA: 0,

      barrelRate: 0,
      barrelPct: 0,

      hardHitRate: 0,
      hardHitPct: 0,

      exitVelocity: 0,
      avgExitVelo: 0,
      avgExitVelocity: 0,

      launchAngle: 0,
      avgLaunchAngle: 0,

      sweetSpotRate: 0,
      sweetSpotPct: 0,

      flyBallRate: 0,
      flyBallPct: 0,

      pullRate: 0,
      pullPct: 0
    };
  },

  /*
  =========================================================
  CSV NETWORK REQUEST
  =========================================================
  */

  async fetchCSV(
    url,
    forceRefresh = false
  ) {
    try {
      const finalUrl = forceRefresh
        ? `${url}${
            url.includes("?") ? "&" : "?"
          }_=${Date.now()}`
        : url;

      const response = await fetch(
        finalUrl,
        {
          method: "GET",
          cache: forceRefresh
            ? "no-store"
            : "default",

          headers: {
            Accept:
              "text/csv,text/plain,*/*"
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `Statcast HTTP ${response.status}`
        );
      }

      return await response.text();
    } catch (error) {
      console.warn(
        "Statcast API error:",
        error
      );

      return "";
    }
  },

  /*
  =========================================================
  CSV PARSER
  =========================================================
  */

  parseCSV(text) {
    if (!text || !text.trim()) {
      return [];
    }

    const rows = [];

    let currentCell = "";
    let currentRow = [];
    let insideQuotes = false;

    for (
      let index = 0;
      index < text.length;
      index++
    ) {
      const character = text[index];
      const nextCharacter =
        text[index + 1];

      /*
      Escaped quote inside quoted text.
      */
      if (
        character === '"' &&
        insideQuotes &&
        nextCharacter === '"'
      ) {
        currentCell += '"';
        index++;

        continue;
      }

      if (character === '"') {
        insideQuotes = !insideQuotes;
        continue;
      }

      if (
        character === "," &&
        !insideQuotes
      ) {
        currentRow.push(currentCell);
        currentCell = "";

        continue;
      }

      if (
        (
          character === "\n" ||
          character === "\r"
        ) &&
        !insideQuotes
      ) {
        /*
        Skip the second character in CRLF.
        */
        if (
          character === "\r" &&
          nextCharacter === "\n"
        ) {
          index++;
        }

        if (
          currentCell !== "" ||
          currentRow.length
        ) {
          currentRow.push(currentCell);
          rows.push(currentRow);

          currentCell = "";
          currentRow = [];
        }

        continue;
      }

      currentCell += character;
    }

    if (
      currentCell !== "" ||
      currentRow.length
    ) {
      currentRow.push(currentCell);
      rows.push(currentRow);
    }

    if (rows.length < 2) {
      return [];
    }

    const headers = rows[0].map(
      header => String(header).trim()
    );

    return rows
      .slice(1)
      .filter(values =>
        values.some(value =>
          String(value).trim() !== ""
        )
      )
      .map(values => {
        const object = {};

        headers.forEach(
          (header, index) => {
            object[header] =
              values[index] ?? "";
          }
        );

        return object;
      });
  },

  /*
  =========================================================
  BASEBALL SAVANT URL
  =========================================================
  */

  buildUrl(playerId) {
    const params =
      new URLSearchParams();

    params.set("all", "true");
    params.set("hfGT", "R|");

    params.set(
      "hfSea",
      `${this.currentSeason()}|`
    );

    params.set(
      "player_type",
      "batter"
    );

    params.set(
      "game_date_gt",
      this.seasonStart()
    );

    params.set(
      "game_date_lt",
      this.seasonEnd()
    );

    params.append(
      "batters_lookup[]",
      String(playerId)
    );

    params.set("min_pitches", "0");
    params.set("min_results", "0");
    params.set("min_pas", "0");

    params.set(
      "group_by",
      "name"
    );

    params.set(
      "sort_col",
      "launch_speed"
    );

    params.set(
      "player_event_sort",
      "h_launch_speed"
    );

    params.set(
      "sort_order",
      "desc"
    );

    params.set(
      "type",
      "details"
    );

    return (
      "https://baseballsavant.mlb.com/" +
      "statcast_search/csv?" +
      params.toString()
    );
  },

  /*
  =========================================================
  BATTED-BALL HELPERS
  =========================================================
  */

  hasLaunchSpeed(row = {}) {
    return (
      row.launch_speed !== undefined &&
      row.launch_speed !== null &&
      row.launch_speed !== "" &&
      this.num(row.launch_speed) > 0
    );
  },

  hasLaunchAngle(row = {}) {
    return (
      row.launch_angle !== undefined &&
      row.launch_angle !== null &&
      row.launch_angle !== "" &&
      Number.isFinite(
        Number(row.launch_angle)
      )
    );
  },

  isBarrel(row = {}) {
    /*
    Baseball Savant commonly identifies barrels
    with launch_speed_angle category 6.
    */
    const category = this.num(
      row.launch_speed_angle
    );

    if (category === 6) {
      return true;
    }

    /*
    Safe fallback when category is unavailable.
    */
    const exitVelocity =
      this.num(row.launch_speed);

    const launchAngle =
      this.num(row.launch_angle);

    if (exitVelocity < 98) {
      return false;
    }

    const velocityAbove98 =
      Math.floor(exitVelocity - 98);

    const lowerBound = Math.max(
      8,
      26 - velocityAbove98
    );

    const upperBound = Math.min(
      50,
      30 + velocityAbove98
    );

    return (
      launchAngle >= lowerBound &&
      launchAngle <= upperBound
    );
  },

  isHardHit(row = {}) {
    return (
      this.num(row.launch_speed) >= 95
    );
  },

  isSweetSpot(row = {}) {
    /*
    Sweet-spot launch-angle range:
    8 through 32 degrees.
    */
    const launchAngle =
      this.num(row.launch_angle);

    return (
      launchAngle >= 8 &&
      launchAngle <= 32
    );
  },

  isFlyBall(row = {}) {
    const battedBallType = String(
      row.bb_type || ""
    ).toLowerCase();

    if (battedBallType === "fly_ball") {
      return true;
    }

    /*
    Fallback for rows without bb_type.
    */
    const launchAngle =
      this.num(row.launch_angle);

    return (
      launchAngle >= 25 &&
      launchAngle <= 50
    );
  },

  isPulled(row = {}) {
    /*
    Some Savant CSV responses expose an
    if_fielding_alignment or hit-location field,
    but reliable pull direction is not always
    supplied in browser CSV requests.

    Only use explicit pull values when present.
    */
    const pullValue = String(
      row.pull ||
      row.hit_direction ||
      ""
    ).toLowerCase();

    return (
      pullValue === "pull" ||
      pullValue === "pulled"
    );
  },

  /*
  =========================================================
  STATCAST CALCULATION
  =========================================================
  */

  calculateFromRows(rows = []) {
    if (!Array.isArray(rows)) {
      return this.emptyStats();
    }

    const battedBalls = rows.filter(
      row =>
        this.hasLaunchSpeed(row) &&
        this.hasLaunchAngle(row)
    );

    const total =
      battedBalls.length;

    if (!total) {
      return this.emptyStats();
    }

    let totalExitVelocity = 0;
    let totalLaunchAngle = 0;

    let barrelCount = 0;
    let hardHitCount = 0;
    let sweetSpotCount = 0;
    let flyBallCount = 0;
    let pullCount = 0;

    for (const row of battedBalls) {
      totalExitVelocity += this.num(
        row.launch_speed
      );

      totalLaunchAngle += this.num(
        row.launch_angle
      );

      if (this.isBarrel(row)) {
        barrelCount++;
      }

      if (this.isHardHit(row)) {
        hardHitCount++;
      }

      if (this.isSweetSpot(row)) {
        sweetSpotCount++;
      }

      if (this.isFlyBall(row)) {
        flyBallCount++;
      }

      if (this.isPulled(row)) {
        pullCount++;
      }
    }

    const barrelPct =
      (barrelCount / total) * 100;

    const hardHitPct =
      (hardHitCount / total) * 100;

    const sweetSpotPct =
      (sweetSpotCount / total) * 100;

    const flyBallPct =
      (flyBallCount / total) * 100;

    const pullPct =
      (pullCount / total) * 100;

    const avgExitVelocity =
      totalExitVelocity / total;

    const avgLaunchAngle =
      totalLaunchAngle / total;

    return {
      available: true,
      hasStatcastData: true,

      battedBalls: total,
      statcastPA: total,

      /*
      Barrel aliases.
      */
      barrelRate:
        this.round(barrelPct),

      barrelPct:
        this.round(barrelPct),

      /*
      Hard-hit aliases.
      */
      hardHitRate:
        this.round(hardHitPct),

      hardHitPct:
        this.round(hardHitPct),

      /*
      Exit-velocity aliases.
      */
      exitVelocity:
        this.round(avgExitVelocity),

      avgExitVelo:
        this.round(avgExitVelocity),

      avgExitVelocity:
        this.round(avgExitVelocity),

      /*
      Launch-angle aliases.
      */
      launchAngle:
        this.round(avgLaunchAngle),

      avgLaunchAngle:
        this.round(avgLaunchAngle),

      /*
      Sweet-spot aliases.
      */
      sweetSpotRate:
        this.round(sweetSpotPct),

      sweetSpotPct:
        this.round(sweetSpotPct),

      /*
      Fly-ball aliases.
      */
      flyBallRate:
        this.round(flyBallPct),

      flyBallPct:
        this.round(flyBallPct),

      /*
      Pull aliases.
      Pull data may remain zero when Savant
      does not return an explicit direction.
      */
      pullRate:
        this.round(pullPct),

      pullPct:
        this.round(pullPct)
    };
  },

  /*
  =========================================================
  PUBLIC PLAYER STATCAST METHOD
  =========================================================
  */

  async getPlayerPowerStats(
    playerId,
    forceRefresh = false
  ) {
    playerId = Number(playerId || 0);

    if (!playerId) {
      return this.emptyStats();
    }

    const cacheKey =
      `${this.currentSeason()}-${playerId}`;

    if (
      !forceRefresh &&
      this.cache[cacheKey]
    ) {
      return this.cache[cacheKey];
    }

    if (forceRefresh) {
      delete this.cache[cacheKey];
    }

    const url =
      this.buildUrl(playerId);

    const csv =
      await this.fetchCSV(
        url,
        forceRefresh
      );

    const rows =
      this.parseCSV(csv);

    const stats =
      this.calculateFromRows(rows);

    this.cache[cacheKey] = stats;

    /*
    Also make the result available through
    the main API cache when possible.
    */
    if (
      typeof window.API !== "undefined" &&
      window.API?.cache?.statcast
    ) {
      window.API.cache.statcast[
        String(playerId)
      ] = stats;
    }

    return stats;
  },

  /*
  =========================================================
  CACHE MANAGEMENT
  =========================================================
  */

  clearPlayerCache(playerId) {
    playerId = Number(playerId || 0);

    if (!playerId) return;

    const cacheKey =
      `${this.currentSeason()}-${playerId}`;

    delete this.cache[cacheKey];

    if (
      typeof window.API !== "undefined" &&
      window.API?.cache?.statcast
    ) {
      delete window.API.cache.statcast[
        String(playerId)
      ];
    }
  },

  clearCache() {
    this.cache = {};

    if (
      typeof window.API !== "undefined" &&
      window.API?.cache
    ) {
      window.API.cache.statcast = {};
    }

    console.log(
      "🧹 POPS Statcast cache cleared."
    );
  }
};

/*
Makes StatcastAPI available to app.js.
*/
window.StatcastAPI = StatcastAPI;