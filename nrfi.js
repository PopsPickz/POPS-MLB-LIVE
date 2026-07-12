/*

=========================================================

POPS PICKZ NRFI MODEL

File: nrfi.js

Version: 2.0

=========================================================

PURPOSE

Automatically evaluates every MLB game loaded by app.js

and predicts:

- Elite NRFI

- Strong NRFI

- Lean NRFI

- Toss-Up

- YRFI Alert

MODEL INPUTS

The model uses data already available on the site and

automatically uses enhanced data when those fields exist:

PITCHING

- First-inning ERA when available

- First-inning WHIP when available

- Season ERA

- Season WHIP

- HR/9

- Strikeout-to-walk ratio

- Starting-pitcher confirmation

OFFENSE

- Team first-inning scoring rate when available

- Team first-inning runs per game when available

- Team OPS

- Team batting average

- Team runs per game

- Top-four lineup danger

- Recent top-order form

- Confirmed or projected lineup

IMPORTANT

Weather is NOT included in this model.

This file does not read from weather.js and does not

use temperature, wind, rain, humidity, or weather ratings.

REQUIRED HTML

<div id="nrfiBox">

  <p>Loading NRFI predictions...</p>

</div>

REQUIRED SCRIPT ORDER

<script src="nrfi.js"></script>

<script src="app.js"></script>

CALL FROM app.js

await NRFI.load(games);

=========================================================

*/

const NRFI = {

  box: null,

  settings: {

    eliteMinimum: 86,

    strongMinimum: 76,

    leanMinimum: 66,

    tossUpMinimum: 52,

    requireBothStarters: true,

    maximumTopOrderBatters: 4,

    minimumConfirmedBatters: 7,

    /*

    Maximum final score is 100.

    Starting pitchers:

    25 points each = 50

    Team offenses:

    15 points each = 30

    Lineups and data confidence:

    20 points

    */

    maximumPitcherScore: 25,

    maximumOffenseScore: 15,

    maximumContextScore: 20

  },

  /*

  =======================================================

  BASIC HELPERS

  =======================================================

  */

  num(value, fallback = 0) {

    const number = Number(value);

    return Number.isFinite(number)

      ? number

      : fallback;

  },

  text(value, fallback = "") {

    if (

      value === null ||

      value === undefined

    ) {

      return fallback;

    }

    const result =

      String(value).trim();

    return result || fallback;

  },

  clamp(

    value,

    minimum,

    maximum

  ) {

    return Math.min(

      maximum,

      Math.max(

        minimum,

        value

      )

    );

  },

  escapeHTML(value = "") {

    return String(value)

      .replaceAll("&", "&amp;")

      .replaceAll("<", "&lt;")

      .replaceAll(">", "&gt;")

      .replaceAll('"', "&quot;")

      .replaceAll("'", "&#039;");

  },

  formatNumber(

    value,

    places = 2,

    fallback = "N/A"

  ) {

    const number =

      Number(value);

    if (

      !Number.isFinite(number) ||

      number < 0

    ) {

      return fallback;

    }

    return number.toFixed(

      places

    );

  },

  formatPercent(

    value,

    places = 1,

    fallback = "N/A"

  ) {

    const number =

      Number(value);

    if (

      !Number.isFinite(number) ||

      number < 0

    ) {

      return fallback;

    }

    const normalized =

      number <= 1

        ? number * 100

        : number;

    return `${normalized.toFixed(

      places

    )}%`;

  },

  normalizePitcherName(name) {

    const value =

      this.text(

        name,

        "TBD"

      );

    const lower =

      value.toLowerCase();

    if (

      lower === "unknown" ||

      lower === "tbd" ||

      lower === "to be determined"

    ) {

      return "TBD";

    }

    return value;

  },

  hasStarter(

    name,

    id

  ) {

    return (

      this.normalizePitcherName(

        name

      ) !== "TBD" &&

      this.num(

        id,

        0

      ) > 0

    );

  },

  getNestedValue(

    object = {},

    paths = []

  ) {

    for (const path of paths) {

      const parts =

        String(path).split(".");

      let current =

        object;

      let valid =

        true;

      for (const part of parts) {

        if (

          current === null ||

          current === undefined ||

          typeof current !== "object" ||

          !(part in current)

        ) {

          valid = false;

          break;

        }

        current =

          current[part];

      }

      if (

        valid &&

        current !== null &&

        current !== undefined &&

        current !== ""

      ) {

        return current;

      }

    }

    return undefined;

  },

  getFirstAvailableNumber(

    object = {},

    paths = [],

    fallback = 0

  ) {

    const value =

      this.getNestedValue(

        object,

        paths

      );

    return this.num(

      value,

      fallback

    );

  },

  /*

  =======================================================

  PITCHER STAT HELPERS

  =======================================================

  */

  getPitcherERA(stats = {}) {

    return this.getFirstAvailableNumber(

      stats,

      [

        "era",

        "earnedRunAverage",

        "ERA",

        "season.era",

        "pitching.era"

      ],

      0

    );

  },

  getPitcherWHIP(stats = {}) {

    return this.getFirstAvailableNumber(

      stats,

      [

        "whip",

        "WHIP",

        "season.whip",

        "pitching.whip"

      ],

      0

    );

  },

  getPitcherInnings(stats = {}) {

    return this.getFirstAvailableNumber(

      stats,

      [

        "inningsPitched",

        "innings",

        "ip",

        "season.inningsPitched",

        "pitching.inningsPitched"

      ],

      0

    );

  },

  getPitcherHomeRuns(stats = {}) {

    return this.getFirstAvailableNumber(

      stats,

      [

        "homeRuns",

        "homeRunsAllowed",

        "hrAllowed",

        "hr",

        "season.homeRuns",

        "pitching.homeRuns"

      ],

      0

    );

  },

  getPitcherHR9(stats = {}) {

    const directValue =

      this.getFirstAvailableNumber(

        stats,

        [

          "hr9",

          "homeRunsPer9",

          "homeRunsPerNine",

          "homeRunsPer9Inn",

          "season.hr9",

          "pitching.hr9"

        ],

        0

      );

    if (directValue > 0) {

      return directValue;

    }

    const innings =

      this.getPitcherInnings(

        stats

      );

    const homeRuns =

      this.getPitcherHomeRuns(

        stats

      );

    if (innings <= 0) {

      return 0;

    }

    return (

      homeRuns * 9

    ) / innings;

  },

  getPitcherStrikeouts(stats = {}) {

    return this.getFirstAvailableNumber(

      stats,

      [

        "strikeOuts",

        "strikeouts",

        "so",

        "k",

        "season.strikeOuts",

        "pitching.strikeOuts"

      ],

      0

    );

  },

  getPitcherWalks(stats = {}) {

    return this.getFirstAvailableNumber(

      stats,

      [

        "baseOnBalls",

        "walks",

        "bb",

        "season.baseOnBalls",

        "pitching.baseOnBalls"

      ],

      0

    );

  },

  getPitcherKBB(stats = {}) {

    const directValue =

      this.getFirstAvailableNumber(

        stats,

        [

          "kbb",

          "strikeoutWalkRatio",

          "strikeOutWalkRatio",

          "season.kbb"

        ],

        0

      );

    if (directValue > 0) {

      return directValue;

    }

    const strikeouts =

      this.getPitcherStrikeouts(

        stats

      );

    const walks =

      this.getPitcherWalks(

        stats

      );

    if (walks <= 0) {

      return strikeouts > 0

        ? strikeouts

        : 0;

    }

    return strikeouts / walks;

  },

  /*

  =======================================================

  FIRST-INNING PITCHER HELPERS

  These fields are optional.

  The model automatically uses them when they exist in

  pitcher stats or an attached firstInning object.

  =======================================================

  */

  getFirstInningERA(stats = {}) {

    return this.getFirstAvailableNumber(

      stats,

      [

        "firstInningERA",

        "firstInningEra",

        "inning1ERA",

        "inningOneERA",

        "firstInning.era",

        "firstInningStats.era",

        "splits.firstInning.era",

        "firstInningSplits.era"

      ],

      0

    );

  },

  getFirstInningWHIP(stats = {}) {

    return this.getFirstAvailableNumber(

      stats,

      [

        "firstInningWHIP",

        "firstInningWhip",

        "inning1WHIP",

        "inningOneWHIP",

        "firstInning.whip",

        "firstInningStats.whip",

        "splits.firstInning.whip",

        "firstInningSplits.whip"

      ],

      0

    );

  },

  getFirstInningRunsAllowed(stats = {}) {

    return this.getFirstAvailableNumber(

      stats,

      [

        "firstInningRunsAllowed",

        "inning1RunsAllowed",

        "firstInning.runsAllowed",

        "firstInningStats.runsAllowed",

        "splits.firstInning.runsAllowed"

      ],

      0

    );

  },

  getFirstInningAppearances(stats = {}) {

    return this.getFirstAvailableNumber(

      stats,

      [

        "firstInningAppearances",

        "firstInningGames",

        "inning1Games",

        "firstInning.games",

        "firstInningStats.games",

        "splits.firstInning.games"

      ],

      0

    );

  },

  getFirstInningScorelessRate(stats = {}) {

    const directValue =

      this.getFirstAvailableNumber(

        stats,

        [

          "firstInningScorelessRate",

          "scorelessFirstRate",

          "nrfiRate",

          "firstInning.scorelessRate",

          "firstInning.nrfiRate",

          "firstInningStats.scorelessRate"

        ],

        -1

      );

    if (directValue >= 0) {

      return directValue > 1

        ? directValue / 100

        : directValue;

    }

    const appearances =

      this.getFirstInningAppearances(

        stats

      );

    const runsAllowedGames =

      this.getFirstAvailableNumber(

        stats,

        [

          "firstInningGamesWithRun",

          "firstInningScoredAgainst",

          "firstInning.gamesWithRun"

        ],

        -1

      );

    if (

      appearances > 0 &&

      runsAllowedGames >= 0

    ) {

      return this.clamp(

        (

          appearances -

          runsAllowedGames

        ) / appearances,

        0,

        1

      );

    }

    return -1;

  },

  /*

  =======================================================

  TEAM OFFENSE HELPERS

  =======================================================

  */

  getTeamHittingStats(stats = {}) {

    if (

      stats.hitting &&

      typeof stats.hitting === "object"

    ) {

      return stats.hitting;

    }

    return stats;

  },

  getTeamAverage(stats = {}) {

    const hitting =

      this.getTeamHittingStats(

        stats

      );

    return this.getFirstAvailableNumber(

      hitting,

      [

        "avg",

        "battingAverage",

        "average"

      ],

      0

    );

  },

  getTeamOPS(stats = {}) {

    const hitting =

      this.getTeamHittingStats(

        stats

      );

    return this.getFirstAvailableNumber(

      hitting,

      [

        "ops",

        "OPS"

      ],

      0

    );

  },

  getTeamRuns(stats = {}) {

    const hitting =

      this.getTeamHittingStats(

        stats

      );

    return this.getFirstAvailableNumber(

      hitting,

      [

        "runs",

        "r",

        "runsScored"

      ],

      0

    );

  },

  getTeamGamesPlayed(stats = {}) {

    const hitting =

      this.getTeamHittingStats(

        stats

      );

    return this.getFirstAvailableNumber(

      hitting,

      [

        "gamesPlayed",

        "games",

        "g"

      ],

      0

    );

  },

  getTeamRunsPerGame(stats = {}) {

    const hitting =

      this.getTeamHittingStats(

        stats

      );

    const directValue =

      this.getFirstAvailableNumber(

        hitting,

        [

          "runsPerGame",

          "rpg"

        ],

        0

      );

    if (directValue > 0) {

      return directValue;

    }

    const gamesPlayed =

      this.getTeamGamesPlayed(

        stats

      );

    const runs =

      this.getTeamRuns(

        stats

      );

    if (gamesPlayed <= 0) {

      return 0;

    }

    return runs / gamesPlayed;

  },

  /*

  =======================================================

  TEAM FIRST-INNING OFFENSE HELPERS

  These fields are optional.

  The model uses them when available and falls back to

  season offense when unavailable.

  =======================================================

  */

  getTeamFirstInningScoringRate(stats = {}) {

    const hitting =

      this.getTeamHittingStats(

        stats

      );

    const value =

      this.getFirstAvailableNumber(

        hitting,

        [

          "firstInningScoringRate",

          "firstInningRunRate",

          "yrfiRate",

          "inning1ScoringRate",

          "firstInning.scoringRate",

          "firstInning.yrfiRate",

          "firstInningStats.scoringRate"

        ],

        -1

      );

    if (value < 0) {

      return -1;

    }

    return value > 1

      ? value / 100

      : value;

  },

  getTeamFirstInningRunsPerGame(stats = {}) {

    const hitting =

      this.getTeamHittingStats(

        stats

      );

    const directValue =

      this.getFirstAvailableNumber(

        hitting,

        [

          "firstInningRunsPerGame",

          "inning1RunsPerGame",

          "firstInningRPG",

          "firstInning.runsPerGame",

          "firstInningStats.runsPerGame"

        ],

        -1

      );

    if (directValue >= 0) {

      return directValue;

    }

    const firstInningRuns =

      this.getFirstAvailableNumber(

        hitting,

        [

          "firstInningRuns",

          "inning1Runs",

          "firstInning.runs",

          "firstInningStats.runs"

        ],

        -1

      );

    const gamesPlayed =

      this.getTeamGamesPlayed(

        hitting

      );

    if (

      firstInningRuns >= 0 &&

      gamesPlayed > 0

    ) {

      return (

        firstInningRuns /

        gamesPlayed

      );

    }

    return -1;

  },

  /*

  =======================================================

  LINEUP HELPERS

  =======================================================

  */

  getLineup(

    game = {},

    side = "away"

  ) {

    const lineup =

      side === "away"

        ? game.awayLineup

        : game.homeLineup;

    return Array.isArray(lineup)

      ? lineup

      : [];

  },

  getTopOrderBatters(

    game = {},

    side = "away"

  ) {

    return this.getLineup(

      game,

      side

    )

      .filter(Boolean)

      .sort(

        (a, b) =>

          this.num(

            a.lineupSpot,

            99

          ) -

          this.num(

            b.lineupSpot,

            99

          )

      )

      .slice(

        0,

        this.settings

          .maximumTopOrderBatters

      );

  },

  getBatterOPS(batter = {}) {

    return this.getFirstAvailableNumber(

      batter,

      [

        "hitting.ops",

        "ops",

        "stats.ops"

      ],

      0

    );

  },

  getBatterISO(batter = {}) {

    const directISO =

      this.getFirstAvailableNumber(

        batter,

        [

          "hitting.iso",

          "iso",

          "stats.iso"

        ],

        0

      );

    if (directISO > 0) {

      return directISO;

    }

    const average =

      this.getFirstAvailableNumber(

        batter,

        [

          "hitting.avg",

          "avg",

          "stats.avg"

        ],

        0

      );

    const slugging =

      this.getFirstAvailableNumber(

        batter,

        [

          "hitting.slg",

          "slg",

          "stats.slg"

        ],

        0

      );

    return slugging > 0

      ? Math.max(

          0,

          slugging - average

        )

      : 0;

  },

  getBatterHomeRuns(batter = {}) {

    return this.getFirstAvailableNumber(

      batter,

      [

        "hitting.homeRuns",

        "homeRuns",

        "stats.homeRuns"

      ],

      0

    );

  },

  getBatterBarrelRate(batter = {}) {

    return this.getFirstAvailableNumber(

      batter,

      [

        "statcast.barrelRate",

        "statcast.barrelPct",

        "barrelRate"

      ],

      0

    );

  },

  getBatterHardHitRate(batter = {}) {

    return this.getFirstAvailableNumber(

      batter,

      [

        "statcast.hardHitRate",

        "statcast.hardHitPct",

        "hardHitRate"

      ],

      0

    );

  },

  getBatterRecentOPS(batter = {}) {

    return this.getFirstAvailableNumber(

      batter,

      [

        "recentForm.ops",

        "last10.ops",

        "recent.ops"

      ],

      0

    );

  },

  getBatterRecentHomeRuns(batter = {}) {

    return this.getFirstAvailableNumber(

      batter,

      [

        "recentForm.homeRuns",

        "last10.homeRuns",

        "recent.homeRuns"

      ],

      0

    );

  },

  getBatterHitStreak(batter = {}) {

    return this.getFirstAvailableNumber(

      batter,

      [

        "hitStreak",

        "currentHitStreak"

      ],

      0

    );

  },

  isLineupConfirmed(lineup = []) {

    if (!lineup.length) {

      return false;

    }

    const confirmedCount =

      lineup.filter(

        batter =>

          batter?.confirmed === true

      ).length;

    return (

      confirmedCount >=

      this.settings

        .minimumConfirmedBatters

    );

  },

  getTopOrderRisk(

    game = {},

    side = "away"

  ) {

    const batters =

      this.getTopOrderBatters(

        game,

        side

      );

    if (!batters.length) {

      return {

        score: 12,

        batterCount: 0,

        averageOPS: 0,

        averageISO: 0,

        averageRecentOPS: 0,

        totalHomeRuns: 0,

        recentHomeRuns: 0,

        dangerousBatters: 0,

        hotBatters: 0,

        dataAvailable: false

      };

    }

    let totalOPS = 0;

    let totalISO = 0;

    let totalRecentOPS = 0;

    let totalHomeRuns = 0;

    let recentHomeRuns = 0;

    let opsCount = 0;

    let isoCount = 0;

    let recentOPSCount = 0;

    let dangerousBatters = 0;

    let hotBatters = 0;

    for (const batter of batters) {

      const ops =

        this.getBatterOPS(

          batter

        );

      const iso =

        this.getBatterISO(

          batter

        );

      const homeRuns =

        this.getBatterHomeRuns(

          batter

        );

      const barrelRate =

        this.getBatterBarrelRate(

          batter

        );

      const hardHitRate =

        this.getBatterHardHitRate(

          batter

        );

      const recentOPS =

        this.getBatterRecentOPS(

          batter

        );

      const recentHR =

        this.getBatterRecentHomeRuns(

          batter

        );

      const hitStreak =

        this.getBatterHitStreak(

          batter

        );

      if (ops > 0) {

        totalOPS += ops;

        opsCount += 1;

      }

      if (iso > 0) {

        totalISO += iso;

        isoCount += 1;

      }

      if (recentOPS > 0) {

        totalRecentOPS +=

          recentOPS;

        recentOPSCount += 1;

      }

      totalHomeRuns +=

        homeRuns;

      recentHomeRuns +=

        recentHR;

      if (

        ops >= 0.840 ||

        iso >= 0.215 ||

        barrelRate >= 12 ||

        hardHitRate >= 47

      ) {

        dangerousBatters += 1;

      }

      if (

        recentOPS >= 0.900 ||

        recentHR >= 2 ||

        hitStreak >= 6

      ) {

        hotBatters += 1;

      }

    }

    const batterCount =

      batters.length;

    const averageOPS =

      opsCount > 0

        ? totalOPS / opsCount

        : 0;

    const averageISO =

      isoCount > 0

        ? totalISO / isoCount

        : 0;

    const averageRecentOPS =

      recentOPSCount > 0

        ? totalRecentOPS /

          recentOPSCount

        : 0;

    let risk = 0;

    /*

    Season OPS risk — maximum 8

    */

    if (averageOPS >= 0.875) {

      risk += 8;

    } else if (

      averageOPS >= 0.825

    ) {

      risk += 6;

    } else if (

      averageOPS >= 0.775

    ) {

      risk += 4;

    } else if (

      averageOPS >= 0.725

    ) {

      risk += 2;

    }

    /*

    ISO risk — maximum 7

    */

    if (averageISO >= 0.240) {

      risk += 7;

    } else if (

      averageISO >= 0.210

    ) {

      risk += 5;

    } else if (

      averageISO >= 0.180

    ) {

      risk += 3;

    } else if (

      averageISO >= 0.150

    ) {

      risk += 1;

    }

    /*

    Recent-form risk — maximum 6

    */

    if (

      averageRecentOPS >=

      1.000

    ) {

      risk += 6;

    } else if (

      averageRecentOPS >=

      0.900

    ) {

      risk += 4;

    } else if (

      averageRecentOPS >=

      0.800

    ) {

      risk += 2;

    }

    /*

    Dangerous/hot batter risk

    */

    risk += Math.min(

      5,

      dangerousBatters

    );

    risk += Math.min(

      4,

      hotBatters * 2

    );

    if (recentHomeRuns >= 5) {

      risk += 4;

    } else if (

      recentHomeRuns >= 3

    ) {

      risk += 2;

    }

    return {

      score:

        this.clamp(

          risk,

          0,

          30

        ),

      batterCount,

      averageOPS,

      averageISO,

      averageRecentOPS,

      totalHomeRuns,

      recentHomeRuns,

      dangerousBatters,

      hotBatters,

      dataAvailable: true

    };

  },

  /*

  =======================================================

  STARTING PITCHER NRFI SCORE

  Maximum: 25 points per pitcher

  =======================================================

  */

  scorePitcher(

    pitcherName,

    pitcherId,

    stats = {}

  ) {

    const reasons = [];

    const warnings = [];

    const hasStarter =

      this.hasStarter(

        pitcherName,

        pitcherId

      );

    const era =

      this.getPitcherERA(

        stats

      );

    const whip =

      this.getPitcherWHIP(

        stats

      );

    const hr9 =

      this.getPitcherHR9(

        stats

      );

    const kbb =

      this.getPitcherKBB(

        stats

      );

    const firstInningERA =

      this.getFirstInningERA(

        stats

      );

    const firstInningWHIP =

      this.getFirstInningWHIP(

        stats

      );

    const firstInningScorelessRate =

      this.getFirstInningScorelessRate(

        stats

      );

    if (!hasStarter) {

      return {

        score: 0,

        reasons,

        warnings: [

          "Starting pitcher is not confirmed"

        ],

        era,

        whip,

        hr9,

        kbb,

        firstInningERA,

        firstInningWHIP,

        firstInningScorelessRate,

        hasStarter: false,

        firstInningDataAvailable:

          firstInningERA > 0 ||

          firstInningWHIP > 0 ||

          firstInningScorelessRate >= 0

      };

    }

    let score = 0;

    let firstInningPoints = 0;

    let eraPoints = 0;

    let whipPoints = 0;

    let hr9Points = 0;

    let commandPoints = 0;

    /*

    First-inning performance — maximum 9

    Priority:

    1. Scoreless first rate

    2. First-inning ERA

    3. First-inning WHIP

    */

    if (

      firstInningScorelessRate >= 0

    ) {

      if (

        firstInningScorelessRate >=

        0.82

      ) {

        firstInningPoints += 6;

        reasons.push(

          `${pitcherName} has an elite scoreless-first rate`

        );

      } else if (

        firstInningScorelessRate >=

        0.75

      ) {

        firstInningPoints += 5;

        reasons.push(

          `${pitcherName} has a strong scoreless-first rate`

        );

      } else if (

        firstInningScorelessRate >=

        0.68

      ) {

        firstInningPoints += 3;

      } else if (

        firstInningScorelessRate >=

        0.60

      ) {

        firstInningPoints += 1;

      } else {

        warnings.push(

          `${pitcherName} has allowed frequent first-inning scoring`

        );

      }

    }

    if (firstInningERA > 0) {

      if (firstInningERA <= 2.25) {

        firstInningPoints += 3;

        reasons.push(

          `${pitcherName} has an elite first-inning ERA`

        );

      } else if (

        firstInningERA <= 3.25

      ) {

        firstInningPoints += 2;

      } else if (

        firstInningERA <= 4.25

      ) {

        firstInningPoints += 1;

      } else if (

        firstInningERA >= 6

      ) {

        firstInningPoints -= 2;

        warnings.push(

          `${pitcherName} has a high first-inning ERA`

        );

      } else if (

        firstInningERA >= 5

      ) {

        firstInningPoints -= 1;

      }

    }

    if (firstInningWHIP > 0) {

      if (

        firstInningWHIP <= 1

      ) {

        firstInningPoints += 2;

      } else if (

        firstInningWHIP <= 1.20

      ) {

        firstInningPoints += 1;

      } else if (

        firstInningWHIP >= 1.55

      ) {

        firstInningPoints -= 2;

        warnings.push(

          `${pitcherName} allows too many first-inning baserunners`

        );

      }

    }

    firstInningPoints =

      this.clamp(

        firstInningPoints,

        0,

        9

      );

    /*

    Season ERA — maximum 5

    */

    if (

      era > 0 &&

      era <= 2.75

    ) {

      eraPoints = 5;

      reasons.push(

        `${pitcherName} has an elite season ERA`

      );

    } else if (

      era > 0 &&

      era <= 3.40

    ) {

      eraPoints = 4;

      reasons.push(

        `${pitcherName} has a strong season ERA`

      );

    } else if (

      era > 0 &&

      era <= 4

    ) {

      eraPoints = 3;

    } else if (

      era > 0 &&

      era <= 4.60

    ) {

      eraPoints = 1;

    } else if (

      era >= 5

    ) {

      warnings.push(

        `${pitcherName} has an elevated season ERA`

      );

    }

    /*

    Season WHIP — maximum 5

    */

    if (

      whip > 0 &&

      whip <= 1.05

    ) {

      whipPoints = 5;

      reasons.push(

        `${pitcherName} limits baserunners`

      );

    } else if (

      whip > 0 &&

      whip <= 1.17

    ) {

      whipPoints = 4;

    } else if (

      whip > 0 &&

      whip <= 1.28

    ) {

      whipPoints = 3;

    } else if (

      whip > 0 &&

      whip <= 1.38

    ) {

      whipPoints = 1;

    } else if (

      whip >= 1.45

    ) {

      warnings.push(

        `${pitcherName} allows too many baserunners`

      );

    }

    /*

    HR/9 — maximum 3

    */

    if (

      hr9 > 0 &&

      hr9 <= 0.80

    ) {

      hr9Points = 3;

      reasons.push(

        `${pitcherName} suppresses home runs`

      );

    } else if (

      hr9 > 0 &&

      hr9 <= 1.10

    ) {

      hr9Points = 2;

    } else if (

      hr9 > 0 &&

      hr9 <= 1.35

    ) {

      hr9Points = 1;

    } else if (

      hr9 >= 1.55

    ) {

      warnings.push(

        `${pitcherName} has elevated home-run risk`

      );

    }

    /*

    Command — maximum 3

    */

    if (kbb >= 4) {

      commandPoints = 3;

      reasons.push(

        `${pitcherName} has excellent strikeout-to-walk command`

      );

    } else if (

      kbb >= 3

    ) {

      commandPoints = 2;

    } else if (

      kbb >= 2

    ) {

      commandPoints = 1;

    } else if (

      kbb > 0 &&

      kbb < 1.5

    ) {

      warnings.push(

        `${pitcherName} has weak strikeout-to-walk command`

      );

    }

    /*

    When first-inning splits are unavailable, redistribute

    part of the first-inning category using season quality.

    */

    const firstInningDataAvailable =

      firstInningERA > 0 ||

      firstInningWHIP > 0 ||

      firstInningScorelessRate >= 0;

    if (!firstInningDataAvailable) {

      let fallbackPoints = 0;

      if (

        era > 0 &&

        era <= 3.25

      ) {

        fallbackPoints += 3;

      } else if (

        era > 0 &&

        era <= 4

      ) {

        fallbackPoints += 2;

      } else if (

        era > 0 &&

        era <= 4.60

      ) {

        fallbackPoints += 1;

      }

      if (

        whip > 0 &&

        whip <= 1.15

      ) {

        fallbackPoints += 2;

      } else if (

        whip > 0 &&

        whip <= 1.30

      ) {

        fallbackPoints += 1;

      }

      if (kbb >= 3) {

        fallbackPoints += 1;

      }

      firstInningPoints =

        this.clamp(

          fallbackPoints,

          0,

          6

        );

    }

    score =

      firstInningPoints +

      eraPoints +

      whipPoints +

      hr9Points +

      commandPoints;

    /*

    Pitcher-specific risk penalties

    */

    if (era >= 5.50) {

      score -= 3;

    } else if (

      era >= 5

    ) {

      score -= 2;

    }

    if (whip >= 1.55) {

      score -= 3;

    } else if (

      whip >= 1.45

    ) {

      score -= 2;

    }

    if (hr9 >= 1.80) {

      score -= 2;

    }

    if (

      firstInningERA >= 6.50

    ) {

      score -= 3;

    }

    if (

      firstInningWHIP >= 1.65

    ) {

      score -= 2;

    }

    return {

      score:

        this.clamp(

          score,

          0,

          this.settings

            .maximumPitcherScore

        ),

      reasons:

        [...new Set(reasons)],

      warnings:

        [...new Set(warnings)],

      era,

      whip,

      hr9,

      kbb,

      firstInningERA,

      firstInningWHIP,

      firstInningScorelessRate,

      firstInningPoints,

      eraPoints,

      whipPoints,

      hr9Points,

      commandPoints,

      hasStarter: true,

      firstInningDataAvailable

    };

  },

  /*

  =======================================================

  TEAM OFFENSE NRFI SCORE

  Maximum: 15 points per team

  Higher score means the offense is less likely to score

  in the first inning.

  =======================================================

  */

  scoreOffense(

    teamName,

    stats = {},

    topOrderRisk = {}

  ) {

    const reasons = [];

    const warnings = [];

    const average =

      this.getTeamAverage(

        stats

      );

    const ops =

      this.getTeamOPS(

        stats

      );

    const runsPerGame =

      this.getTeamRunsPerGame(

        stats

      );

    const firstInningScoringRate =

      this.getTeamFirstInningScoringRate(

        stats

      );

    const firstInningRunsPerGame =

      this.getTeamFirstInningRunsPerGame(

        stats

      );

    let score = 0;

    let firstInningPoints = 0;

    let opsPoints = 0;

    let averagePoints = 0;

    let scoringPoints = 0;

    /*

    First-inning scoring tendency — maximum 6

    */

    if (

      firstInningScoringRate >= 0

    ) {

      if (

        firstInningScoringRate <= 0.20

      ) {

        firstInningPoints = 6;

        reasons.push(

          `${teamName} rarely scores in the first inning`

        );

      } else if (

        firstInningScoringRate <= 0.25

      ) {

        firstInningPoints = 5;

      } else if (

        firstInningScoringRate <= 0.30

      ) {

        firstInningPoints = 3;

      } else if (

        firstInningScoringRate <= 0.35

      ) {

        firstInningPoints = 1;

      } else if (

        firstInningScoringRate >= 0.40

      ) {

        warnings.push(

          `${teamName} scores frequently in the first inning`

        );

      }

    } else if (

      firstInningRunsPerGame >= 0

    ) {

      if (

        firstInningRunsPerGame <= 0.20

      ) {

        firstInningPoints = 6;

        reasons.push(

          `${teamName} has low first-inning run production`

        );

      } else if (

        firstInningRunsPerGame <= 0.28

      ) {

        firstInningPoints = 4;

      } else if (

        firstInningRunsPerGame <= 0.35

      ) {

        firstInningPoints = 2;

      } else if (

        firstInningRunsPerGame >= 0.45

      ) {

        warnings.push(

          `${teamName} produces runs early`

        );

      }

    } else {

      /*

      Fallback when first-inning team data is unavailable.

      */

      if (

        runsPerGame > 0 &&

        runsPerGame <= 3.9

      ) {

        firstInningPoints = 4;

      } else if (

        runsPerGame > 0 &&

        runsPerGame <= 4.3

      ) {

        firstInningPoints = 3;

      } else if (

        runsPerGame > 0 &&

        runsPerGame <= 4.7

      ) {

        firstInningPoints = 2;

      } else if (

        runsPerGame > 0 &&

        runsPerGame <= 5

      ) {

        firstInningPoints = 1;

      }

    }

    /*

    Team OPS — maximum 4

    */

    if (

      ops > 0 &&

      ops <= 0.680

    ) {

      opsPoints = 4;

      reasons.push(

        `${teamName} has a low team OPS`

      );

    } else if (

      ops > 0 &&

      ops <= 0.720

    ) {

      opsPoints = 3;

    } else if (

      ops > 0 &&

      ops <= 0.755

    ) {

      opsPoints = 2;

    } else if (

      ops > 0 &&

      ops <= 0.785

    ) {

      opsPoints = 1;

    } else if (

      ops >= 0.810

    ) {

      warnings.push(

        `${teamName} has a dangerous team OPS`

      );

    }

    /*

    Team batting average — maximum 2

    */

    if (

      average > 0 &&

      average <= 0.230

    ) {

      averagePoints = 2;

    } else if (

      average > 0 &&

      average <= 0.250

    ) {

      averagePoints = 1;

    }

    /*

    Runs per game — maximum 3

    */

    if (

      runsPerGame > 0 &&

      runsPerGame <= 3.8

    ) {

      scoringPoints = 3;

      reasons.push(

        `${teamName} scores fewer runs per game`

      );

    } else if (

      runsPerGame > 0 &&

      runsPerGame <= 4.3

    ) {

      scoringPoints = 2;

    } else if (

      runsPerGame > 0 &&

      runsPerGame <= 4.7

    ) {

      scoringPoints = 1;

    } else if (

      runsPerGame >= 5

    ) {

      warnings.push(

        `${teamName} scores at a high rate`

      );

    }

    score =

      firstInningPoints +

      opsPoints +

      averagePoints +

      scoringPoints;

    /*

    Top-order danger penalty

    */

    const topOrderPenalty =

      this.clamp(

        this.num(

          topOrderRisk.score,

          0

        ) * 0.32,

        0,

        9

      );

    score -=

      topOrderPenalty;

    if (

      topOrderRisk

        .dangerousBatters >= 3

    ) {

      warnings.push(

        `${teamName} has a dangerous top four`

      );

    }

    if (

      topOrderRisk.hotBatters >= 2

    ) {

      warnings.push(

        `${teamName} has multiple hot hitters near the top`

      );

    }

    if (

      topOrderRisk.recentHomeRuns >= 4

    ) {

      warnings.push(

        `${teamName}'s top order has recent home-run power`

      );

    }

    return {

      score:

        this.clamp(

          score,

          0,

          this.settings

            .maximumOffenseScore

        ),

      reasons:

        [...new Set(reasons)],

      warnings:

        [...new Set(warnings)],

      average,

      ops,

      runsPerGame,

      firstInningScoringRate,

      firstInningRunsPerGame,

      firstInningPoints,

      opsPoints,

      averagePoints,

      scoringPoints,

      topOrderPenalty,

      firstInningDataAvailable:

        firstInningScoringRate >= 0 ||

        firstInningRunsPerGame >= 0

    };

  },

  /*

  =======================================================

  CONTEXT AND DATA CONFIDENCE

  Maximum: 20 points

  =======================================================

  */

  scoreContext({

    awayPitcher,

    homePitcher,

    awayLineup,

    homeLineup,

    awayConfirmed,

    homeConfirmed,

    awayTopOrderRisk,

    homeTopOrderRisk

  }) {

    const reasons = [];

    const warnings = [];

    let score = 0;

    /*

    Starting pitchers — maximum 6

    */

    if (

      awayPitcher.hasStarter &&

      homePitcher.hasStarter

    ) {

      score += 6;

      reasons.push(

        "Both starting pitchers are confirmed"

      );

    } else if (

      awayPitcher.hasStarter ||

      homePitcher.hasStarter

    ) {

      score += 2;

      warnings.push(

        "Only one starting pitcher is confirmed"

      );

    } else {

      warnings.push(

        "Neither starting pitcher is confirmed"

      );

    }

    /*

    Confirmed lineups — maximum 6

    */

    if (

      awayConfirmed &&

      homeConfirmed

    ) {

      score += 6;

      reasons.push(

        "Both lineups are confirmed"

      );

    } else if (

      awayConfirmed ||

      homeConfirmed

    ) {

      score += 4;

    } else if (

      awayLineup.length >= 7 &&

      homeLineup.length >= 7

    ) {

      score += 2;

    } else {

      warnings.push(

        "Lineup data is incomplete"

      );

    }

    /*

    First-inning pitcher data — maximum 4

    */

    if (

      awayPitcher

        .firstInningDataAvailable &&

      homePitcher

        .firstInningDataAvailable

    ) {

      score += 4;

      reasons.push(

        "First-inning pitcher splits are available"

      );

    } else if (

      awayPitcher

        .firstInningDataAvailable ||

      homePitcher

        .firstInningDataAvailable

    ) {

      score += 2;

    }

    /*

    Top-order data — maximum 4

    */

    if (

      awayTopOrderRisk

        .dataAvailable &&

      homeTopOrderRisk

        .dataAvailable &&

      awayTopOrderRisk

        .batterCount >= 4 &&

      homeTopOrderRisk

        .batterCount >= 4

    ) {

      score += 4;

    } else if (

      awayTopOrderRisk

        .dataAvailable ||

      homeTopOrderRisk

        .dataAvailable

    ) {

      score += 2;

    }

    return {

      score:

        this.clamp(

          score,

          0,

          this.settings

            .maximumContextScore

        ),

      reasons,

      warnings

    };

  },

  /*

  =======================================================

  GAME EVALUATION

  =======================================================

  */

  evaluateGame(game = {}) {

    const awayTeam =

      this.text(

        typeof game.awayTeam ===

          "object"

          ? game.awayTeam?.name

          : game.awayTeam,

        "Away Team"

      );

    const homeTeam =

      this.text(

        typeof game.homeTeam ===

          "object"

          ? game.homeTeam?.name

          : game.homeTeam,

        "Home Team"

      );

    const awayPitcherName =

      this.normalizePitcherName(

        game.awayPitcher

      );

    const homePitcherName =

      this.normalizePitcherName(

        game.homePitcher

      );

    const awayPitcher =

      this.scorePitcher(

        awayPitcherName,

        game.awayPitcherId,

        game.awayPitcherStats || {}

      );

    const homePitcher =

      this.scorePitcher(

        homePitcherName,

        game.homePitcherId,

        game.homePitcherStats || {}

      );

    /*

    The away offense faces the home pitcher.

    The home offense faces the away pitcher.

    */

    const awayTopOrderRisk =

      this.getTopOrderRisk(

        game,

        "away"

      );

    const homeTopOrderRisk =

      this.getTopOrderRisk(

        game,

        "home"

      );

    const awayOffense =

      this.scoreOffense(

        awayTeam,

        game.awayTeamStats || {},

        awayTopOrderRisk

      );

    const homeOffense =

      this.scoreOffense(

        homeTeam,

        game.homeTeamStats || {},

        homeTopOrderRisk

      );

    const awayLineup =

      this.getLineup(

        game,

        "away"

      );

    const homeLineup =

      this.getLineup(

        game,

        "home"

      );

    const awayConfirmed =

      this.isLineupConfirmed(

        awayLineup

      );

    const homeConfirmed =

      this.isLineupConfirmed(

        homeLineup

      );

    const context =

      this.scoreContext({

        awayPitcher,

        homePitcher,

        awayLineup,

        homeLineup,

        awayConfirmed,

        homeConfirmed,

        awayTopOrderRisk,

        homeTopOrderRisk

      });

    let score =

      awayPitcher.score +

      homePitcher.score +

      awayOffense.score +

      homeOffense.score +

      context.score;

    const reasons = [

      ...awayPitcher.reasons,

      ...homePitcher.reasons,

      ...awayOffense.reasons,

      ...homeOffense.reasons,

      ...context.reasons

    ];

    const warnings = [

      ...awayPitcher.warnings,

      ...homePitcher.warnings,

      ...awayOffense.warnings,

      ...homeOffense.warnings,

      ...context.warnings

    ];

    /*

    =====================================================

    MAJOR GAME-LEVEL PENALTIES

    =====================================================

    */

    if (

      !awayPitcher.hasStarter ||

      !homePitcher.hasStarter

    ) {

      score -= 12;

      warnings.push(

        "Both starting pitchers are not confirmed"

      );

    }

    /*

    One very weak starting pitcher can ruin an NRFI.

    */

    if (

      awayPitcher.score <= 7 ||

      homePitcher.score <= 7

    ) {

      score -= 8;

      warnings.push(

        "At least one starter grades as a major first-inning risk"

      );

    } else if (

      awayPitcher.score <= 11 ||

      homePitcher.score <= 11

    ) {

      score -= 4;

    }

    /*

    High season ERA penalties

    */

    if (

      awayPitcher.era >= 5.50 ||

      homePitcher.era >= 5.50

    ) {

      score -= 8;

    } else if (

      awayPitcher.era >= 5 ||

      homePitcher.era >= 5

    ) {

      score -= 5;

    }

    /*

    High WHIP penalties

    */

    if (

      awayPitcher.whip >= 1.55 ||

      homePitcher.whip >= 1.55

    ) {

      score -= 7;

    } else if (

      awayPitcher.whip >= 1.45 ||

      homePitcher.whip >= 1.45

    ) {

      score -= 4;

    }

    /*

    First-inning split penalties

    */

    if (

      awayPitcher.firstInningERA >= 6 ||

      homePitcher.firstInningERA >= 6

    ) {

      score -= 7;

      warnings.push(

        "At least one starter has poor first-inning results"

      );

    }

    if (

      awayPitcher

        .firstInningScorelessRate >= 0 &&

      awayPitcher

        .firstInningScorelessRate < 0.58

    ) {

      score -= 5;

    }

    if (

      homePitcher

        .firstInningScorelessRate >= 0 &&

      homePitcher

        .firstInningScorelessRate < 0.58

    ) {

      score -= 5;

    }

    /*

    Dangerous top orders

    */

    if (

      awayTopOrderRisk.score >= 25

    ) {

      score -= 6;

    } else if (

      awayTopOrderRisk.score >= 20

    ) {

      score -= 3;

    }

    if (

      homeTopOrderRisk.score >= 25

    ) {

      score -= 6;

    } else if (

      homeTopOrderRisk.score >= 20

    ) {

      score -= 3;

    }

    /*

    Team early-scoring penalties

    */

    if (

      awayOffense

        .firstInningScoringRate >=

        0.40

    ) {

      score -= 5;

    }

    if (

      homeOffense

        .firstInningScoringRate >=

        0.40

    ) {

      score -= 5;

    }

    /*

    Strong dual-pitcher bonus

    */

    if (

      awayPitcher.score >= 21 &&

      homePitcher.score >= 21

    ) {

      score += 4;

      reasons.push(

        "Both starting pitchers grade as strong NRFI arms"

      );

    }

    /*

    Weak dual-offense bonus

    */

    if (

      awayOffense.score >= 11 &&

      homeOffense.score >= 11

    ) {

      score += 3;

      reasons.push(

        "Both offenses grade as lower first-inning threats"

      );

    }

    score =

      Math.round(

        this.clamp(

          score,

          0,

          100

        )

      );

    const prediction =

      this.getPrediction(

        score

      );

    const availableDataPoints = [

      awayPitcher.era > 0,

      awayPitcher.whip > 0,

      homePitcher.era > 0,

      homePitcher.whip > 0,

      awayPitcher

        .firstInningDataAvailable,

      homePitcher

        .firstInningDataAvailable,

      awayOffense.ops > 0,

      homeOffense.ops > 0,

      awayOffense

        .firstInningDataAvailable,

      homeOffense

        .firstInningDataAvailable,

      awayTopOrderRisk

        .dataAvailable,

      homeTopOrderRisk

        .dataAvailable,

      awayConfirmed,

      homeConfirmed

    ].filter(Boolean).length;

    const dataConfidence =

      Math.round(

        (

          availableDataPoints /

          14

        ) * 100

      );

    return {

      gamePk:

        this.num(

          game.gamePk ||

          game.id,

          0

        ),

      awayTeam,

      homeTeam,

      matchup:

        `${awayTeam} vs ${homeTeam}`,

      gameTime:

        this.text(

          game.date ||

          game.gameDate,

          ""

        ),

      venue:

        this.text(

          typeof game.venue ===

            "object"

            ? game.venue?.name

            : game.venue,

          "Venue TBD"

        ),

      score,

      prediction,

      dataConfidence,

      awayPitcherName,

      homePitcherName,

      awayPitcher,

      homePitcher,

      awayOffense,

      homeOffense,

      awayTopOrderRisk,

      homeTopOrderRisk,

      context,

      awayConfirmed,

      homeConfirmed,

      reasons:

        [...new Set(reasons)]

          .slice(0, 8),

      warnings:

        [...new Set(warnings)]

          .slice(0, 8)

    };

  },

  getPrediction(score = 0) {

    if (

      score >=

      this.settings.eliteMinimum

    ) {

      return {

        key: "elite",

        label: "Elite NRFI",

        icon: "🟢",

        recommendation:

          "Top NRFI candidate"

      };

    }

    if (

      score >=

      this.settings.strongMinimum

    ) {

      return {

        key: "strong",

        label: "Strong NRFI",

        icon: "✅",

        recommendation:

          "Strong NRFI lean"

      };

    }

    if (

      score >=

      this.settings.leanMinimum

    ) {

      return {

        key: "lean",

        label: "Lean NRFI",

        icon: "🟡",

        recommendation:

          "Moderate NRFI lean"

      };

    }

    if (

      score >=

      this.settings.tossUpMinimum

    ) {

      return {

        key: "tossup",

        label: "Toss-Up",

        icon: "⚪",

        recommendation:

          "No strong first-inning edge"

      };

    }

    return {

      key: "yrfi",

      label: "YRFI Alert",

      icon: "🔴",

      recommendation:

        "Elevated first-inning run risk"

    };

  },

  /*

  =======================================================

  BUILD EVERY GAME

  =======================================================

  */

  build(games = []) {

    if (!Array.isArray(games)) {

      return [];

    }

    return games

      .filter(Boolean)

      .map(

        game =>

          this.evaluateGame(

            game

          )

      )

      .sort(

        (a, b) =>

          b.score - a.score

      );

  },

  /*

  =======================================================

  DISPLAY HELPERS

  =======================================================

  */

  formatGameTime(value) {

    if (!value) {

      return "Time TBD";

    }

    const date =

      new Date(value);

    if (

      Number.isNaN(

        date.getTime()

      )

    ) {

      return "Time TBD";

    }

    return date.toLocaleString(

      [],

      {

        weekday: "short",

        month: "short",

        day: "numeric",

        hour: "numeric",

        minute: "2-digit"

      }

    );

  },

  renderOptionalStat(

    label,

    value,

    places = 2,

    suffix = ""

  ) {

    const number =

      Number(value);

    if (

      !Number.isFinite(number) ||

      number < 0 ||

      number === 0

    ) {

      return "";

    }

    return `

      <span>

        ${this.escapeHTML(label)}

        <strong>

          ${number.toFixed(

            places

          )}${suffix}

        </strong>

      </span>

    `;

  },

  renderPitcher(

    name,

    result = {}

  ) {

    const firstInningRate =

      result.firstInningScorelessRate;

    const firstInningRateHTML =

      Number.isFinite(

        Number(firstInningRate)

      ) &&

      Number(firstInningRate) >= 0

        ? `

          <span>

            Scoreless 1st

            <strong>

              ${this.formatPercent(

                firstInningRate,

                1

              )}

            </strong>

          </span>

        `

        : "";

    return `

      <div class="nrfi-pitcher">

        <h4>

          ${this.escapeHTML(name)}

        </h4>

        <div class="nrfi-stat-grid">

          <span>

            ERA

            <strong>

              ${this.formatNumber(

                result.era,

                2

              )}

            </strong>

          </span>

          <span>

            WHIP

            <strong>

              ${this.formatNumber(

                result.whip,

                2

              )}

            </strong>

          </span>

          <span>

            HR/9

            <strong>

              ${this.formatNumber(

                result.hr9,

                2

              )}

            </strong>

          </span>

          <span>

            K/BB

            <strong>

              ${this.formatNumber(

                result.kbb,

                2

              )}

            </strong>

          </span>

          ${this.renderOptionalStat(

            "1st-Inning ERA",

            result.firstInningERA,

            2

          )}

          ${this.renderOptionalStat(

            "1st-Inning WHIP",

            result.firstInningWHIP,

            2

          )}

          ${firstInningRateHTML}

          <span>

            Pitcher Score

            <strong>

              ${Math.round(

                result.score || 0

              )}/25

            </strong>

          </span>

        </div>

        <p class="nrfi-data-note">

          ${

            result.firstInningDataAvailable

              ? "✅ First-inning splits available"

              : "ℹ️ Season-stat fallback"

          }

        </p>

      </div>

    `;

  },

  renderFactors(

    title,

    items = [],

    type = "positive"

  ) {

    if (!items.length) {

      return "";

    }

    return `

      <div class="nrfi-factors ${type}">

        <h4>

          ${this.escapeHTML(title)}

        </h4>

        ${items

          .map(

            item => `

              <p>

                ${

                  type === "positive"

                    ? "✓"

                    : "!"

                }

                ${this.escapeHTML(item)}

              </p>

            `

          )

          .join("")}

      </div>

    `;

  },

  renderOffensePanel(

    teamName,

    offense = {},

    topOrderRisk = {}

  ) {

    const firstInningRate =

      offense

        .firstInningScoringRate;

    const firstInningRateText =

      Number.isFinite(

        Number(firstInningRate)

      ) &&

      Number(firstInningRate) >= 0

        ? this.formatPercent(

            firstInningRate,

            1

          )

        : "N/A";

    const firstInningRPG =

      offense

        .firstInningRunsPerGame;

    const firstInningRPGText =

      Number.isFinite(

        Number(firstInningRPG)

      ) &&

      Number(firstInningRPG) >= 0

        ? this.formatNumber(

            firstInningRPG,

            2

          )

        : "N/A";

    return `

      <div>

        <h4>

          ${this.escapeHTML(

            teamName

          )} offense

        </h4>

        <p>

          OPS:

          ${this.formatNumber(

            offense.ops,

            3

          )}

        </p>

        <p>

          Runs/Game:

          ${this.formatNumber(

            offense.runsPerGame,

            2

          )}

        </p>

        <p>

          First-Inning Scoring Rate:

          ${firstInningRateText}

        </p>

        <p>

          First-Inning Runs/Game:

          ${firstInningRPGText}

        </p>

        <p>

          Top-Order Risk:

          ${Math.round(

            topOrderRisk.score || 0

          )}/30

        </p>

        <p>

          Hot Top-Order Batters:

          ${Math.round(

            topOrderRisk.hotBatters || 0

          )}

        </p>

        <p>

          Offense Safety Score:

          ${Math.round(

            offense.score || 0

          )}/15

        </p>

      </div>

    `;

  },

  renderGameCard(

    result = {},

    index = 0

  ) {

    const prediction =

      result.prediction || {};

    return `

      <article

        class="

          nrfi-game-card

          nrfi-${prediction.key}

        "

      >

        <div class="nrfi-card-header">

          <div>

            <span class="nrfi-rank">

              #${index + 1}

            </span>

            <h3>

              ${this.escapeHTML(

                result.matchup

              )}

            </h3>

            <p>

              ⏰ ${this.escapeHTML(

                this.formatGameTime(

                  result.gameTime

                )

              )}

            </p>

            <p>

              🏟️ ${this.escapeHTML(

                result.venue

              )}

            </p>

          </div>

          <div class="nrfi-score-box">

            <span>

              POPS NRFI

            </span>

            <strong>

              ${result.score}

            </strong>

            <small>

              /100

            </small>

          </div>

        </div>

        <div class="nrfi-prediction">

          <span class="nrfi-prediction-icon">

            ${prediction.icon || "⚪"}

          </span>

          <div>

            <strong>

              ${

                prediction.label ||

                "Toss-Up"

              }

            </strong>

            <small>

              ${

                prediction.recommendation ||

                ""

              }

            </small>

          </div>

        </div>

        <div class="nrfi-confidence-row">

          <span>

            Data confidence

          </span>

          <strong>

            ${result.dataConfidence}%

          </strong>

        </div>

        <div class="nrfi-pitcher-grid">

          ${this.renderPitcher(

            result.awayPitcherName,

            result.awayPitcher

          )}

          ${this.renderPitcher(

            result.homePitcherName,

            result.homePitcher

          )}

        </div>

        <div class="nrfi-lineup-status">

          <span>

            Away lineup:

            ${

              result.awayConfirmed

                ? "✅ Confirmed"

                : "🟡 Projected"

            }

          </span>

          <span>

            Home lineup:

            ${

              result.homeConfirmed

                ? "✅ Confirmed"

                : "🟡 Projected"

            }

          </span>

        </div>

        <details class="nrfi-breakdown">

          <summary>

            View prediction breakdown

          </summary>

          <div class="nrfi-breakdown-content">

            ${this.renderFactors(

              "NRFI Advantages",

              result.reasons,

              "positive"

            )}

            ${this.renderFactors(

              "YRFI Risk Factors",

              result.warnings,

              "warning"

            )}

            <div class="nrfi-offense-grid">

              ${this.renderOffensePanel(

                result.awayTeam,

                result.awayOffense,

                result.awayTopOrderRisk

              )}

              ${this.renderOffensePanel(

                result.homeTeam,

                result.homeOffense,

                result.homeTopOrderRisk

              )}

            </div>

            <div class="nrfi-context-score">

              <h4>

                Data and lineup context

              </h4>

              <p>

                Context Score:

                ${Math.round(

                  result.context?.score ||

                  0

                )}/20

              </p>

              <p>

                Weather:

                Not included

              </p>

            </div>

          </div>

        </details>

      </article>

    `;

  },

  /*

  =======================================================

  MAIN LOAD AND RENDER

  =======================================================

  */

  async load(

    games =

      window.games || []

  ) {

    this.box =

      document.getElementById(

        "nrfiBox"

      );

    if (!this.box) {

      console.warn(

        "POPS NRFI: #nrfiBox was not found."

      );

      return [];

    }

    this.box.innerHTML = `

      <div class="nrfi-loading">

        <p>

          Analyzing starting pitchers,

          first-inning tendencies and

          top-of-order danger...

        </p>

      </div>

    `;

    const sourceGames =

      Array.isArray(games)

        ? games

        : [];

    const predictions =

      this.build(

        sourceGames

      );

    window.nrfiPredictions =

      predictions;

    if (!predictions.length) {

      this.box.innerHTML = `

        <div class="pick-card">

          <h3>

            No NRFI Predictions Available

          </h3>

          <p>

            MLB games or starting-pitcher

            data have not loaded yet.

          </p>

        </div>

      `;

      return [];

    }

    const eliteCount =

      predictions.filter(

        item =>

          item.prediction.key ===

          "elite"

      ).length;

    const strongCount =

      predictions.filter(

        item =>

          item.prediction.key ===

          "strong"

      ).length;

    const yrfiCount =

      predictions.filter(

        item =>

          item.prediction.key ===

          "yrfi"

      ).length;

    const averageConfidence =

      Math.round(

        predictions.reduce(

          (total, item) =>

            total +

            this.num(

              item.dataConfidence,

              0

            ),

          0

        ) /

        predictions.length

      );

    this.box.innerHTML = `

      <div class="nrfi-hero">

        <div

          class="

            nrfi-light

            nrfi-light-left

          "

        ></div>

        <div

          class="

            nrfi-light

            nrfi-light-right

          "

        ></div>

        <h1>

          POPS NRFI

          <span>

            PREDICTIONS

          </span>

        </h1>

      </div>

      <div class="nrfi-summary">

        <div>

          <span>

            Games Analyzed

          </span>

          <strong>

            ${predictions.length}

          </strong>

        </div>

        <div>

          <span>

            Elite NRFI

          </span>

          <strong>

            ${eliteCount}

          </strong>

        </div>

        <div>

          <span>

            Strong NRFI

          </span>

          <strong>

            ${strongCount}

          </strong>

        </div>

        <div>

          <span>

            YRFI Alerts

          </span>

          <strong>

            ${yrfiCount}

          </strong>

        </div>

      </div>

      <div class="nrfi-model-note">

        <strong>

          POPS NRFI Model 2.0

        </strong>

        <p>

          Games are ranked using first-inning

          pitcher performance when available,

          season pitching, team early-scoring

          tendencies, top-four lineup danger,

          recent hitter form and lineup

          confirmation.

        </p>

        <p>

          Average data confidence:

          <strong>

            ${averageConfidence}%

          </strong>

        </p>

        <p>

          Weather is displayed separately and

          is not included in NRFI scores.

        </p>

      </div>

      <div class="nrfi-game-list">

        ${predictions

          .map(

            (

              result,

              index

            ) =>

              this.renderGameCard(

                result,

                index

              )

          )

          .join("")}

      </div>

    `;

    return predictions;

  }

};

/*

=========================================================

GLOBAL ACCESS

=========================================================

*/

window.NRFI = NRFI;
