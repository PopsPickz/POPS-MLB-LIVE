/*
=========================================================
POPS PICKZ 11.0
MANUAL STATCAST FALLBACK DATA
=========================================================

This file is used only when live Baseball Savant
Statcast data is unavailable.

Live data should come from:

StatcastAPI.getPlayerPowerStats(playerId)

This manual object supplies fallback values for selected
players and uses every field expected by formula.js.
=========================================================
*/

const StatcastData = {
  /*
  =========================================================
  NORMALIZATION HELPERS
  =========================================================
  */

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

  empty() {
    return {
      available: false,
      hasStatcastData: false,
      source: "none",

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

  normalize(stats = {}) {
    const barrel = this.num(
      stats.barrelRate ??
      stats.barrelPct
    );

    const hardHit = this.num(
      stats.hardHitRate ??
      stats.hardHitPct
    );

    const exitVelocity = this.num(
      stats.exitVelocity ??
      stats.avgExitVelo ??
      stats.avgExitVelocity
    );

    const launchAngle = this.num(
      stats.launchAngle ??
      stats.avgLaunchAngle
    );

    const sweetSpot = this.num(
      stats.sweetSpotRate ??
      stats.sweetSpotPct
    );

    const flyBall = this.num(
      stats.flyBallRate ??
      stats.flyBallPct
    );

    const pull = this.num(
      stats.pullRate ??
      stats.pullPct
    );

    const hasData = Boolean(
      barrel ||
      hardHit ||
      exitVelocity ||
      launchAngle ||
      sweetSpot ||
      flyBall
    );

    return {
      available: hasData,
      hasStatcastData: hasData,

      source:
        stats.source ||
        "manual-fallback",

      battedBalls:
        this.num(stats.battedBalls),

      statcastPA:
        this.num(stats.statcastPA),

      barrelRate: barrel,
      barrelPct: barrel,

      hardHitRate: hardHit,
      hardHitPct: hardHit,

      exitVelocity,
      avgExitVelo: exitVelocity,
      avgExitVelocity: exitVelocity,

      launchAngle,
      avgLaunchAngle: launchAngle,

      sweetSpotRate: sweetSpot,
      sweetSpotPct: sweetSpot,

      flyBallRate: flyBall,
      flyBallPct: flyBall,

      pullRate: pull,
      pullPct: pull
    };
  },

  /*
  =========================================================
  MANUAL PLAYER FALLBACKS
  =========================================================

  These values are only backups. Live Statcast results
  should take priority whenever StatcastAPI succeeds.
  =========================================================
  */

  players: {
    "Juan Soto": {
      barrelRate: 17.2,
      hardHitRate: 55.1,
      exitVelocity: 92.4,
      launchAngle: 14.5,
      sweetSpotRate: 36.0,
      flyBallRate: 38.7,
      pullRate: 41.0
    },

    "Aaron Judge": {
      barrelRate: 26.0,
      hardHitRate: 60.0,
      exitVelocity: 96.0,
      launchAngle: 15.8,
      sweetSpotRate: 38.0,
      flyBallRate: 36.0,
      pullRate: 45.0
    },

    "Shohei Ohtani": {
      barrelRate: 19.0,
      hardHitRate: 55.0,
      exitVelocity: 94.0,
      launchAngle: 16.5,
      sweetSpotRate: 37.0,
      flyBallRate: 39.0,
      pullRate: 46.0
    },

    "Kyle Schwarber": {
      barrelRate: 18.0,
      hardHitRate: 52.0,
      exitVelocity: 92.5,
      launchAngle: 20.0,
      sweetSpotRate: 35.0,
      flyBallRate: 45.0,
      pullRate: 48.0
    },

    "Pete Alonso": {
      barrelRate: 16.5,
      hardHitRate: 50.0,
      exitVelocity: 91.5,
      launchAngle: 18.0,
      sweetSpotRate: 34.0,
      flyBallRate: 44.0,
      pullRate: 47.0
    }
  },

  /*
  =========================================================
  PUBLIC LOOKUP METHOD
  =========================================================
  */

  getPlayerStats(playerName) {
    const name = String(
      playerName || ""
    ).trim();

    if (!name) {
      return this.empty();
    }

    const exactMatch =
      this.players[name];

    if (exactMatch) {
      return this.normalize(
        exactMatch
      );
    }

    /*
    Case-insensitive fallback.
    */
    const matchedName =
      Object.keys(this.players).find(
        key =>
          key.toLowerCase() ===
          name.toLowerCase()
      );

    if (!matchedName) {
      return this.empty();
    }

    return this.normalize(
      this.players[matchedName]
    );
  },

  /*
  =========================================================
  LIVE + MANUAL MERGE
  =========================================================

  Live Statcast values always take priority.
  Manual values fill only missing fields.
  =========================================================
  */

  mergeWithLive(
    playerName,
    liveStats = {}
  ) {
    const fallback =
      this.getPlayerStats(playerName);

    const live =
      this.normalize({
        ...liveStats,
        source: "live-statcast"
      });

    if (!live.hasStatcastData) {
      return fallback;
    }

    const merged = {
      ...fallback,
      ...live,

      barrelRate:
        live.barrelRate ||
        fallback.barrelRate,

      hardHitRate:
        live.hardHitRate ||
        fallback.hardHitRate,

      exitVelocity:
        live.exitVelocity ||
        fallback.exitVelocity,

      launchAngle:
        live.launchAngle ||
        fallback.launchAngle,

      sweetSpotRate:
        live.sweetSpotRate ||
        fallback.sweetSpotRate,

      flyBallRate:
        live.flyBallRate ||
        fallback.flyBallRate,

      pullRate:
        live.pullRate ||
        fallback.pullRate,

      available: true,
      hasStatcastData: true,
      source: "live-statcast"
    };

    return this.normalize(merged);
  }
};

/*
Makes the fallback object available to app.js.
*/
window.StatcastData = StatcastData;