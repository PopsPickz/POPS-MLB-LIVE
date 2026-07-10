const API = {
  base: "https://statsapi.mlb.com/api/v1",
  liveBase: "https://statsapi.mlb.com/api/v1.1",

  cache: {
    playerInfo: {},
    pitcherStats: {},
    batterStats: {},
    teamStats: {},

    recentForm: {},
    last10: {},
    statcast: {},

    bvp: {},
    hitStreak: {},
    roster: {},
    lineup: {},

    schedule: {},
    liveFeed: {},
    splits: {},
    weather: {}
  },

  /*
  =========================================================
  DATE HELPERS
  =========================================================
  */

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

  currentSeason() {
    return new Date().getFullYear();
  },

  /*
  =========================================================
  NETWORK HELPER
  =========================================================
  */

  async fetchJSON(
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
          cache: forceRefresh
            ? "no-store"
            : "default"
        }
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${finalUrl}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(
        "MLB API Error:",
        error
      );

      return null;
    }
  },

  /*
  =========================================================
  DAILY MLB SCHEDULE
  =========================================================
  */

  async getSchedule(
    forceRefresh = false
  ) {
    const date = this.today();

    const cacheKey = date;

    if (
      !forceRefresh &&
      this.cache.schedule[cacheKey]
    ) {
      return this.cache.schedule[cacheKey];
    }

    if (forceRefresh) {
      delete this.cache.schedule[cacheKey];
    }

    const url =
      `${this.base}/schedule` +
      `?sportId=1` +
      `&date=${date}` +
      `&hydrate=team,probablePitcher,venue,status`;

    const data = await this.fetchJSON(
      url,
      forceRefresh
    );

    const rawGames =
      data?.dates?.[0]?.games || [];

    const games = rawGames.map(game => ({
      id: Number(game.gamePk || 0),

      gamePk:
        Number(game.gamePk || 0),

      date:
        game.gameDate || "",

      status:
        game.status?.detailedState ||
        game.status?.abstractGameState ||
        "Scheduled",

      statusObject:
        game.status || {},

      venue:
        game.venue?.name || "TBD",

      awayTeam:
        game.teams?.away?.team?.name ||
        "Away Team",

      homeTeam:
        game.teams?.home?.team?.name ||
        "Home Team",

      awayTeamId:
        Number(
          game.teams?.away?.team?.id || 0
        ),

      homeTeamId:
        Number(
          game.teams?.home?.team?.id || 0
        ),

      awayPitcher:
        game.teams?.away
          ?.probablePitcher
          ?.fullName || "TBD",

      homePitcher:
        game.teams?.home
          ?.probablePitcher
          ?.fullName || "TBD",

      awayPitcherId:
        Number(
          game.teams?.away
            ?.probablePitcher?.id || 0
        ) || null,

      homePitcherId:
        Number(
          game.teams?.home
            ?.probablePitcher?.id || 0
        ) || null,

      awayRecord:
        game.teams?.away?.leagueRecord
          ? `${
              game.teams.away
                .leagueRecord.wins
            }-${
              game.teams.away
                .leagueRecord.losses
            }`
          : "0-0",

      homeRecord:
        game.teams?.home?.leagueRecord
          ? `${
              game.teams.home
                .leagueRecord.wins
            }-${
              game.teams.home
                .leagueRecord.losses
            }`
          : "0-0"
    }));

    this.cache.schedule[cacheKey] =
      games;

    return games;
  },

  /*
  =========================================================
  LIVE GAME FEED
  =========================================================
  */

  async getLiveGame(
    gameId,
    forceRefresh = true
  ) {
    gameId = Number(gameId || 0);

    if (!gameId) return null;

    const cacheKey = String(gameId);

    if (
      !forceRefresh &&
      this.cache.liveFeed[cacheKey]
    ) {
      return this.cache.liveFeed[
        cacheKey
      ];
    }

    if (forceRefresh) {
      delete this.cache.liveFeed[
        cacheKey
      ];
    }

    const url =
      `${this.liveBase}/game/` +
      `${gameId}/feed/live`;

    const data = await this.fetchJSON(
      url,
      forceRefresh
    );

    if (data) {
      this.cache.liveFeed[cacheKey] =
        data;
    }

    return data;
  },

  async getProbablePitchers(
    gameId,
    forceRefresh = true
  ) {
    const live = await this.getLiveGame(
      gameId,
      forceRefresh
    );

    const away =
      live?.gameData
        ?.probablePitchers?.away ||
      null;

    const home =
      live?.gameData
        ?.probablePitchers?.home ||
      null;

    return {
      away: {
        id: Number(away?.id || 0),

        name:
          away?.fullName || "TBD"
      },

      home: {
        id: Number(home?.id || 0),

        name:
          home?.fullName || "TBD"
      },

      status:
        live?.gameData?.status || {}
    };
  },

  /*
  =========================================================
  PITCHER STATS
  =========================================================
  */

  async getPitcherStats(
    playerId,
    forceRefresh = false
  ) {
    playerId = Number(playerId || 0);

    if (!playerId) return {};

    const cacheKey = String(playerId);

    if (
      !forceRefresh &&
      this.cache.pitcherStats[
        cacheKey
      ]
    ) {
      return this.cache.pitcherStats[
        cacheKey
      ];
    }

    if (forceRefresh) {
      delete this.cache.pitcherStats[
        cacheKey
      ];
    }

    const season =
      this.currentSeason();

    const url =
      `${this.base}/people/` +
      `${playerId}/stats` +
      `?stats=season` +
      `&group=pitching` +
      `&season=${season}`;

    const data = await this.fetchJSON(
      url,
      forceRefresh
    );

    const stat =
      data?.stats?.[0]?.splits?.[0]
        ?.stat || {};

    const inningsPitched =
      Number(
        stat.inningsPitched || 0
      );

    const homeRuns =
      Number(stat.homeRuns || 0);

    let homeRunsPer9 =
      Number(
        stat.homeRunsPer9 || 0
      );

    if (
      !homeRunsPer9 &&
      inningsPitched > 0
    ) {
      homeRunsPer9 = Number(
        (
          (homeRuns * 9) /
          inningsPitched
        ).toFixed(2)
      );
    }

    const stats = {
      ...stat,

      id: playerId,

      era:
        Number(stat.era || 0),

      whip:
        Number(stat.whip || 0),

      wins:
        Number(stat.wins || 0),

      losses:
        Number(stat.losses || 0),

      gamesPlayed:
        Number(
          stat.gamesPlayed || 0
        ),

      gamesStarted:
        Number(
          stat.gamesStarted || 0
        ),

      inningsPitched,

      ip: inningsPitched,

      hits:
        Number(stat.hits || 0),

      runs:
        Number(stat.runs || 0),

      earnedRuns:
        Number(
          stat.earnedRuns || 0
        ),

      homeRuns,

      hrAllowed: homeRuns,

      baseOnBalls:
        Number(
          stat.baseOnBalls || 0
        ),

      strikeOuts:
        Number(
          stat.strikeOuts || 0
        ),

      strikeoutsPer9Inn:
        Number(
          stat.strikeoutsPer9Inn ||
          0
        ),

      walksPer9Inn:
        Number(
          stat.walksPer9Inn || 0
        ),

      homeRunsPer9,

      hr9: homeRunsPer9
    };

    this.cache.pitcherStats[
      cacheKey
    ] = stats;

    return stats;
  },

  async getPlayerStats(
    playerId,
    forceRefresh = false
  ) {
    return await this.getPitcherStats(
      playerId,
      forceRefresh
    );
  },

  /*
  =========================================================
  BATTER STATS
  =========================================================
  */

  async getBatterStats(
    playerId,
    forceRefresh = false
  ) {
    playerId = Number(playerId || 0);

    if (!playerId) return {};

    const cacheKey = String(playerId);

    if (
      !forceRefresh &&
      this.cache.batterStats[
        cacheKey
      ]
    ) {
      return this.cache.batterStats[
        cacheKey
      ];
    }

    if (forceRefresh) {
      delete this.cache.batterStats[
        cacheKey
      ];
    }

    const season =
      this.currentSeason();

    const url =
      `${this.base}/people/` +
      `${playerId}/stats` +
      `?stats=season` +
      `&group=hitting` +
      `&season=${season}`;

    const data = await this.fetchJSON(
      url,
      forceRefresh
    );

    const stat =
      data?.stats?.[0]?.splits?.[0]
        ?.stat || {};

    const avg =
      Number(stat.avg || 0);

    const slg =
      Number(stat.slg || 0);

    const ops =
      Number(stat.ops || 0);

    const homeRuns =
      Number(stat.homeRuns || 0);

    const hits =
      Number(stat.hits || 0);

    const atBats =
      Number(stat.atBats || 0);

    const plateAppearances =
      Number(
        stat.plateAppearances || 0
      );

    const doubles =
      Number(stat.doubles || 0);

    const triples =
      Number(stat.triples || 0);

    const extraBaseHits =
      doubles +
      triples +
      homeRuns;

    const denominator =
      plateAppearances || atBats;

    const stats = {
      ...stat,

      id: playerId,

      avg,
      slg,
      ops,

      homeRuns,
      hits,
      atBats,
      plateAppearances,

      rbi:
        Number(stat.rbi || 0),

      doubles,
      triples,
      extraBaseHits,

      iso:
        slg > 0
          ? Number(
              (slg - avg).toFixed(3)
            )
          : 0,

      hrRate:
        denominator > 0
          ? Number(
              (
                homeRuns /
                denominator
              ).toFixed(4)
            )
          : 0,

      extraBaseHitRate:
        denominator > 0
          ? Number(
              (
                extraBaseHits /
                denominator
              ).toFixed(4)
            )
          : 0,

      hasSeasonPowerData:
        Boolean(
          homeRuns ||
          slg ||
          ops
        )
    };

    this.cache.batterStats[
      cacheKey
    ] = stats;

    return stats;
  },

  /*
  =========================================================
  TEAM STATS
  =========================================================
  */

  async getTeamStats(
    teamId,
    forceRefresh = false
  ) {
    teamId = Number(teamId || 0);

    if (!teamId) {
      return {
        hitting: {},
        pitching: {},
        fielding: {}
      };
    }

    const cacheKey = String(teamId);

    if (
      !forceRefresh &&
      this.cache.teamStats[cacheKey]
    ) {
      return this.cache.teamStats[
        cacheKey
      ];
    }

    if (forceRefresh) {
      delete this.cache.teamStats[
        cacheKey
      ];
    }

    const season =
      this.currentSeason();

    const url =
      `${this.base}/teams/` +
      `${teamId}/stats` +
      `?stats=season` +
      `&group=hitting,pitching,fielding` +
      `&season=${season}`;

    const data = await this.fetchJSON(
      url,
      forceRefresh
    );

    const hittingGroup =
      data?.stats?.find(item =>
        item.group?.displayName
          ?.toLowerCase()
          .includes("hitting")
      );

    const pitchingGroup =
      data?.stats?.find(item =>
        item.group?.displayName
          ?.toLowerCase()
          .includes("pitching")
      );

    const fieldingGroup =
      data?.stats?.find(item =>
        item.group?.displayName
          ?.toLowerCase()
          .includes("fielding")
      );

    const result = {
      hitting:
        hittingGroup?.splits?.[0]
          ?.stat || {},

      pitching:
        pitchingGroup?.splits?.[0]
          ?.stat || {},

      fielding:
        fieldingGroup?.splits?.[0]
          ?.stat || {}
    };

    this.cache.teamStats[cacheKey] =
      result;

    return result;
  },

  /*
  =========================================================
  CONFIRMED LINEUPS
  =========================================================
  */

  async getLineup(
    gameId,
    teamId,
    forceRefresh = true
  ) {
    gameId = Number(gameId || 0);
    teamId = Number(teamId || 0);

    if (!gameId || !teamId) {
      return [];
    }

    const cacheKey =
      `${gameId}-${teamId}`;

    if (
      !forceRefresh &&
      this.cache.lineup[cacheKey]
    ) {
      return this.cache.lineup[
        cacheKey
      ];
    }

    if (forceRefresh) {
      delete this.cache.lineup[
        cacheKey
      ];
    }

    const live = await this.getLiveGame(
      gameId,
      forceRefresh
    );

    const boxscore =
      live?.liveData?.boxscore;

    if (!boxscore) return [];

    const awaySide =
      boxscore?.teams?.away;

    const homeSide =
      boxscore?.teams?.home;

    let side = null;

    if (
      Number(
        awaySide?.team?.id || 0
      ) === teamId
    ) {
      side = awaySide;
    } else if (
      Number(
        homeSide?.team?.id || 0
      ) === teamId
    ) {
      side = homeSide;
    }

    if (!side) return [];

    const battingOrder =
      side.battingOrder || [];

    const lineup = battingOrder
      .map((playerId, index) => {
        const player =
          side.players?.[
            `ID${playerId}`
          ];

        if (!player) return null;

        return {
          id: Number(playerId),

          name:
            player?.person?.fullName ||
            "Unknown",

          position:
            player?.position
              ?.abbreviation || "",

          lineupSpot:
            index + 1,

          confirmed: true,

          batSide:
            player?.batSide?.code ||
            player?.person?.batSide
              ?.code ||
            ""
        };
      })
      .filter(Boolean);

    this.cache.lineup[cacheKey] =
      lineup;

    return lineup;
  },

  /*
  =========================================================
  ACTIVE ROSTERS
  =========================================================
  */

  async getRoster(
    teamId,
    forceRefresh = false
  ) {
    teamId = Number(teamId || 0);

    if (!teamId) return [];

    const cacheKey = String(teamId);

    if (
      !forceRefresh &&
      this.cache.roster[cacheKey]
    ) {
      return this.cache.roster[
        cacheKey
      ];
    }

    if (forceRefresh) {
      delete this.cache.roster[
        cacheKey
      ];
    }

    const url =
      `${this.base}/teams/` +
      `${teamId}/roster` +
      `?rosterType=active`;

    const data = await this.fetchJSON(
      url,
      forceRefresh
    );

    const roster =
      (data?.roster || []).map(
        item => ({
          id:
            Number(
              item?.person?.id || 0
            ),

          name:
            item?.person?.fullName ||
            "Unknown",

          position:
            item?.position
              ?.abbreviation || ""
        })
      );

    this.cache.roster[cacheKey] =
      roster;

    return roster;
  },

  /*
  =========================================================
  HIT STREAKS
  =========================================================
  */

  async getHitStreak(
    playerId,
    forceRefresh = false
  ) {
    playerId = Number(playerId || 0);

    if (!playerId) return 0;

    const cacheKey = String(playerId);

    if (
      !forceRefresh &&
      this.cache.hitStreak[
        cacheKey
      ] !== undefined
    ) {
      return this.cache.hitStreak[
        cacheKey
      ];
    }

    if (forceRefresh) {
      delete this.cache.hitStreak[
        cacheKey
      ];
    }

    const season =
      this.currentSeason();

    const url =
      `${this.base}/people/` +
      `${playerId}/stats` +
      `?stats=gameLog` +
      `&group=hitting` +
      `&season=${season}`;

    const data = await this.fetchJSON(
      url,
      forceRefresh
    );

    let logs =
      data?.stats?.[0]?.splits || [];

    logs = logs
      .filter(game => game.date)
      .sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      );

    let streak = 0;

    for (const game of logs) {
      const hits =
        Number(
          game.stat?.hits || 0
        );

      if (hits >= 1) {
        streak++;
      } else {
        break;
      }
    }

    this.cache.hitStreak[cacheKey] =
      streak;

    return streak;
  },

  /*
  =========================================================
  RECENT FORM — LAST 10 GAMES
  =========================================================
  */

  async getRecentForm(
    playerId,
    forceRefresh = false
  ) {
    playerId = Number(playerId || 0);

    const empty = {
      games: 0,
      avg: 0,
      obp: 0,
      slg: 0,
      ops: 0,
      iso: 0,

      atBats: 0,
      hits: 0,
      doubles: 0,
      triples: 0,
      homeRuns: 0,

      walks: 0,
      hitByPitch: 0,
      sacFlies: 0,

      extraBaseHits: 0
    };

    if (!playerId) {
      return empty;
    }

    const cacheKey = String(playerId);

    if (
      !forceRefresh &&
      this.cache.recentForm[
        cacheKey
      ]
    ) {
      return this.cache.recentForm[
        cacheKey
      ];
    }

    if (forceRefresh) {
      delete this.cache.recentForm[
        cacheKey
      ];
    }

    const season =
      this.currentSeason();

    const url =
      `${this.base}/people/` +
      `${playerId}/stats` +
      `?stats=gameLog` +
      `&group=hitting` +
      `&season=${season}`;

    const data = await this.fetchJSON(
      url,
      forceRefresh
    );

    let logs =
      data?.stats?.[0]?.splits || [];

    logs = logs
      .filter(game => game.date)
      .sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      )
      .slice(0, 10);

    let atBats = 0;
    let hits = 0;
    let doubles = 0;
    let triples = 0;
    let homeRuns = 0;
    let walks = 0;
    let hitByPitch = 0;
    let sacFlies = 0;

    for (const game of logs) {
      const stat =
        game.stat || {};

      atBats += Number(
        stat.atBats || 0
      );

      hits += Number(
        stat.hits || 0
      );

      doubles += Number(
        stat.doubles || 0
      );

      triples += Number(
        stat.triples || 0
      );

      homeRuns += Number(
        stat.homeRuns || 0
      );

      walks += Number(
        stat.baseOnBalls || 0
      );

      hitByPitch += Number(
        stat.hitByPitch || 0
      );

      sacFlies += Number(
        stat.sacFlies || 0
      );
    }

    const singles = Math.max(
      0,
      hits -
      doubles -
      triples -
      homeRuns
    );

    const totalBases =
      singles +
      doubles * 2 +
      triples * 3 +
      homeRuns * 4;

    const avg =
      atBats > 0
        ? hits / atBats
        : 0;

    const obpDenominator =
      atBats +
      walks +
      hitByPitch +
      sacFlies;

    const obp =
      obpDenominator > 0
        ? (
            hits +
            walks +
            hitByPitch
          ) /
          obpDenominator
        : 0;

    const slg =
      atBats > 0
        ? totalBases / atBats
        : 0;

    const ops =
      obp + slg;

    const iso =
      Math.max(0, slg - avg);

    const result = {
      games: logs.length,

      avg:
        Number(avg.toFixed(3)),

      obp:
        Number(obp.toFixed(3)),

      slg:
        Number(slg.toFixed(3)),

      ops:
        Number(ops.toFixed(3)),

      iso:
        Number(iso.toFixed(3)),

      atBats,
      hits,
      doubles,
      triples,
      homeRuns,
      walks,
      hitByPitch,
      sacFlies,

      extraBaseHits:
        doubles +
        triples +
        homeRuns
    };

    this.cache.recentForm[
      cacheKey
    ] = result;

    this.cache.last10[
      cacheKey
    ] = result;

    return result;
  },

  /*
  =========================================================
  BATTER VS PITCHER STATS
  =========================================================
  */

  async getBvPStats(
    batterId,
    pitcherId,
    forceRefresh = false
  ) {
    batterId =
      Number(batterId || 0);

    pitcherId =
      Number(pitcherId || 0);

    const empty = {
      atBats: 0,
      hits: 0,
      avg: ".000",
      homeRuns: 0
    };

    if (!batterId || !pitcherId) {
      return empty;
    }

    const cacheKey =
      `${batterId}-${pitcherId}`;

    if (
      !forceRefresh &&
      this.cache.bvp[cacheKey]
    ) {
      return this.cache.bvp[
        cacheKey
      ];
    }

    if (forceRefresh) {
      delete this.cache.bvp[
        cacheKey
      ];
    }

    const season =
      this.currentSeason();

    const url =
      `${this.base}/people/` +
      `${batterId}/stats` +
      `?stats=vsPlayer` +
      `&group=hitting` +
      `&opposingPlayerId=${pitcherId}` +
      `&season=${season}`;

    const data = await this.fetchJSON(
      url,
      forceRefresh
    );

    const stat =
      data?.stats?.[0]?.splits?.[0]
        ?.stat || {};

    const result = {
      atBats:
        Number(stat.atBats || 0),

      hits:
        Number(stat.hits || 0),

      avg:
        stat.avg || ".000",

      homeRuns:
        Number(stat.homeRuns || 0)
    };

    this.cache.bvp[cacheKey] =
      result;

    return result;
  },

  async getBvP(
    batterId,
    pitcherId,
    forceRefresh = false
  ) {
    return await this.getBvPStats(
      batterId,
      pitcherId,
      forceRefresh
    );
  },

  async getBVP(
    batterId,
    pitcherId,
    forceRefresh = false
  ) {
    return await this.getBvPStats(
      batterId,
      pitcherId,
      forceRefresh
    );
  },

  async getBatterVsPitcher(
    batterId,
    pitcherId,
    forceRefresh = false
  ) {
    return await this.getBvPStats(
      batterId,
      pitcherId,
      forceRefresh
    );
  },

  async getBvPHR(
    batterId,
    pitcherId,
    forceRefresh = false
  ) {
    const stats =
      await this.getBvPStats(
        batterId,
        pitcherId,
        forceRefresh
      );

    return Number(
      stats.homeRuns || 0
    );
  },

  /*
  =========================================================
  PLAYER INFORMATION
  =========================================================
  */

  async getPlayerInfo(
    playerId,
    forceRefresh = false
  ) {
    playerId = Number(playerId || 0);

    if (!playerId) return {};

    const cacheKey = String(playerId);

    if (
      !forceRefresh &&
      this.cache.playerInfo[
        cacheKey
      ]
    ) {
      return this.cache.playerInfo[
        cacheKey
      ];
    }

    if (forceRefresh) {
      delete this.cache.playerInfo[
        cacheKey
      ];
    }

    const url =
      `${this.base}/people/${playerId}`;

    const data = await this.fetchJSON(
      url,
      forceRefresh
    );

    const person =
      data?.people?.[0];

    const result = {
      id:
        Number(
          person?.id || playerId
        ),

      name:
        person?.fullName || "",

      batSide:
        person?.batSide?.code ||
        "",

      pitchHand:
        person?.pitchHand?.code ||
        ""
    };

    this.cache.playerInfo[
      cacheKey
    ] = result;

    return result;
  },

  /*
  =========================================================
  CACHE MANAGEMENT
  =========================================================
  */

  clearPitcherCache(
    oldPitcherId,
    newPitcherId
  ) {
    const ids = [
      Number(oldPitcherId || 0),
      Number(newPitcherId || 0)
    ].filter(Boolean);

    ids.forEach(id => {
      delete this.cache.pitcherStats[
        String(id)
      ];

      delete this.cache.playerInfo[
        String(id)
      ];
    });

    this.cache.bvp = {};

    console.log(
      "🧹 POPS pitcher cache cleared:",
      ids
    );
  },

  clearBvpCache() {
    this.cache.bvp = {};

    console.log(
      "🧹 POPS BvP cache cleared."
    );
  },

  clearAllCaches() {
    this.cache.playerInfo = {};
    this.cache.pitcherStats = {};
    this.cache.batterStats = {};
    this.cache.teamStats = {};

    this.cache.recentForm = {};
    this.cache.last10 = {};
    this.cache.statcast = {};

    this.cache.bvp = {};
    this.cache.hitStreak = {};
    this.cache.roster = {};
    this.cache.lineup = {};

    this.cache.schedule = {};
    this.cache.liveFeed = {};
    this.cache.splits = {};
    this.cache.weather = {};

    console.log(
      "🧹 All POPS API caches cleared."
    );
  }
};

/*
Makes the API available to all other scripts.
*/
window.API = API;