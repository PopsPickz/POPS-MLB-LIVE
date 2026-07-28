/*
=========================================================
POPS PICKZ MONEYLINE MODEL
Version: 2.0

NEW CATEGORIES

- Starting Pitcher
- Better Bullpen
- Offense
- Defense
- Runs Scored Per Game
- Runs Allowed Per Game

WEIGHTS

Starting Pitcher:       30%
Bullpen:                15%
Offense:                15%
Defense:                10%
Runs Scored Per Game:   15%
Runs Allowed Per Game:  15%

TOTAL:                 100%
=========================================================
*/

const Moneyline = {
  /*
  =========================================================
  GENERAL HELPERS
  =========================================================
  */

  num(value) {
    const n = Number(
      String(value ?? "").replace(/,/g, "")
    );

    return Number.isFinite(n) ? n : 0;
  },

  clamp(score) {
    return Math.max(
      0,
      Math.min(100, Math.round(score))
    );
  },

  decimal(value, places = 2) {
    const n = this.num(value);

    return n.toFixed(places);
  },

  /*
  =========================================================
  TEAM GAMES PLAYED
  =========================================================
  */

  gamesPlayed(stats = {}) {
    return (
      this.num(stats.gamesPlayed) ||
      this.num(stats.games) ||
      this.num(stats.gamesStarted) ||
      0
    );
  },

  /*
  =========================================================
  STARTING PITCHER SCORE
  =========================================================
  */

  pitcherScore(stats = {}) {
    const era = this.num(stats.era);
    const whip = this.num(stats.whip);
    const innings = this.num(
      stats.inningsPitched
    );

    const strikeouts = this.num(
      stats.strikeOuts
    );

    const walks = this.num(
      stats.baseOnBalls
    );

    const homeRuns = this.num(
      stats.homeRuns
    );

    let score = 72;

    if (era > 0) {
      score += (4.50 - era) * 7;
    }

    if (whip > 0) {
      score += (1.35 - whip) * 18;
    }

    if (innings > 0) {
      const k9 =
        (strikeouts * 9) / innings;

      const bb9 =
        (walks * 9) / innings;

      const hr9 =
        (homeRuns * 9) / innings;

      score += (k9 - 8.0) * 2;
      score -= (bb9 - 3.0) * 3;
      score -= hr9 * 5;
    }

    return this.clamp(score);
  },

  /*
  =========================================================
  OFFENSE SCORE

  Runs per game has been removed from this category because
  it now has its own separate moneyline category.
  =========================================================
  */

  offenseScore(stats = {}) {
    const hits = this.num(stats.hits);
    const homeRuns = this.num(
      stats.homeRuns
    );

    const avg = this.num(stats.avg);
    const ops = this.num(stats.ops);

    const games =
      this.gamesPlayed(stats);

    let score = 50;

    if (ops > 0) {
      score +=
        (ops - 0.700) * 120;
    }

    if (avg > 0) {
      score +=
        (avg - 0.240) * 90;
    }

    if (games > 0) {
      const hitsPerGame =
        hits / games;

      const hrPerGame =
        homeRuns / games;

      score +=
        (hitsPerGame - 8.0) * 2;

      score +=
        (hrPerGame - 1.0) * 8;
    }

    return this.clamp(score);
  },

  /*
  =========================================================
  BULLPEN / TEAM PITCHING SCORE
  =========================================================
  */

  bullpenScore(stats = {}) {
    const era = this.num(stats.era);
    const whip = this.num(stats.whip);
    const saves = this.num(stats.saves);

    const blownSaves = this.num(
      stats.blownSaves
    );

    let score = 70;

    if (era > 0) {
      score +=
        (4.10 - era) * 7;
    }

    if (whip > 0) {
      score +=
        (1.32 - whip) * 18;
    }

    score += saves * 0.15;
    score -= blownSaves * 1.25;

    return this.clamp(score);
  },

  /*
  =========================================================
  DEFENSE SCORE
  =========================================================
  */

  defenseScore(stats = {}) {
    const fielding = this.num(
      stats.fielding
    );

    const errors = this.num(
      stats.errors
    );

    const doublePlays = this.num(
      stats.doublePlays
    );

    let score = 65;

    if (fielding > 0) {
      score +=
        (fielding - 0.985) * 1200;
    }

    score -= errors * 0.35;
    score += doublePlays * 0.10;

    return this.clamp(score);
  },

  /*
  =========================================================
  RUNS SCORED PER GAME

  Higher is better.

  MLB baseline used by the model: 4.40 runs per game.
  =========================================================
  */

  runsScoredPerGame(stats = {}) {
    const runs = this.num(stats.runs);

    const games =
      this.gamesPlayed(stats);

    if (games <= 0) {
      return 0;
    }

    return runs / games;
  },

  runsScoredScore(stats = {}) {
    const runsPerGame =
      this.runsScoredPerGame(stats);

    if (runsPerGame <= 0) {
      return 50;
    }

    let score =
      50 +
      (runsPerGame - 4.40) * 18;

    return this.clamp(score);
  },

  /*
  =========================================================
  RUNS ALLOWED PER GAME

  Lower is better.

  MLB baseline used by the model: 4.40 runs allowed/game.
  =========================================================
  */

  runsAllowedPerGame(stats = {}) {
    const runsAllowed =
      this.num(stats.runs);

    const games =
      this.gamesPlayed(stats);

    if (games <= 0) {
      return 0;
    }

    return runsAllowed / games;
  },

  runsAllowedScore(stats = {}) {
    const runsAllowedPerGame =
      this.runsAllowedPerGame(stats);

    if (runsAllowedPerGame <= 0) {
      return 50;
    }

    let score =
      50 +
      (4.40 - runsAllowedPerGame) *
        18;

    return this.clamp(score);
  },

  /*
  =========================================================
  CATEGORY COMPARISON
  =========================================================
  */

  compareCategory(
    awayScore,
    homeScore
  ) {
    if (awayScore > homeScore) {
      return "away";
    }

    if (homeScore > awayScore) {
      return "home";
    }

    return "tie";
  },

  icon(category, side) {
    if (category === side) {
      return "✅";
    }

    if (category === "tie") {
      return "➖";
    }

    return "❌";
  },

  /*
  =========================================================
  CONFIDENCE
  =========================================================
  */

  confidenceScore(
    awayTotal,
    homeTotal,
    awayChecks,
    homeChecks
  ) {
    const scoreDifference =
      Math.abs(
        awayTotal - homeTotal
      );

    const checklistDifference =
      Math.abs(
        awayChecks - homeChecks
      );

    let confidence =
      55 +
      scoreDifference * 1.15 +
      checklistDifference * 2;

    return Math.min(
      90,
      Math.max(
        50,
        Math.round(confidence)
      )
    );
  },


/*
=========================================================
HEAD-TO-HEAD DISPLAY
=========================================================
*/

formatHeadToHeadDate(value) {
  if (!value) {
    return "Date TBD";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date TBD";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  ).format(date);
},

shortTeamName(name = "") {
  const words =
    String(name)
      .trim()
      .split(/\s+/);

  return (
    words[words.length - 1] ||
    name ||
    "Team"
  );
},

renderHeadToHead(
  headToHead = {},
  game = {}
) {
  const matchups =
    Array.isArray(headToHead.games)
      ? headToHead.games
      : [];

  if (!matchups.length) {
    return `
      <div
        style="
          margin: 16px 0;
          padding: 14px;
          border: 1px solid #ff7a00;
          border-radius: 12px;
          background: rgba(255, 122, 0, 0.04);
        "
      >
        <div
          style="
            color: #ff7a00;
            font-weight: 800;
            text-align: center;
            letter-spacing: 0.5px;
          "
        >
          LAST 3 MATCHUPS
        </div>

        <p
          class="small"
          style="
            margin: 10px 0 0;
            text-align: center;
            opacity: 0.75;
          "
        >
          No completed head-to-head games found.
        </p>
      </div>
    `;
  }

  const rows =
    matchups.map(matchup => {
      const awayWon =
        Number(
          matchup.awayScore
        ) >
        Number(
          matchup.homeScore
        );

      const homeWon =
        Number(
          matchup.homeScore
        ) >
        Number(
          matchup.awayScore
        );

      const awayName =
        this.shortTeamName(
          matchup.awayTeam
        );

      const homeName =
        this.shortTeamName(
          matchup.homeTeam
        );

      return `
        <div
          style="
            display: grid;
            grid-template-columns:
              minmax(76px, 0.8fr)
              minmax(90px, 1.5fr)
              auto
              18px
              auto
              minmax(90px, 1.5fr);
            align-items: center;
            gap: 7px;
            padding: 10px 8px;
            margin-top: 7px;
            border: 1px solid rgba(255, 122, 0, 0.22);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.025);
            font-size: 13px;
          "
        >
          <span
            style="
              color: #bdbdbd;
              font-size: 11px;
              line-height: 1.15;
            "
          >
            ${this.formatHeadToHeadDate(
              matchup.date
            )}
          </span>

          <strong
            style="
              color:
                ${
                  awayWon
                    ? "#ff4d4d"
                    : "#f2f2f2"
                };
              text-align: right;
            "
          >
            ${awayName}
          </strong>

          <strong
            style="
              color:
                ${
                  awayWon
                    ? "#ff4d4d"
                    : "#ffffff"
                };
              font-size: 21px;
            "
          >
            ${matchup.awayScore}
          </strong>

          <strong
            style="
              text-align: center;
              color: #bdbdbd;
            "
          >
            -
          </strong>

          <strong
            style="
              color:
                ${
                  homeWon
                    ? "#ff4d4d"
                    : "#ffffff"
                };
              font-size: 21px;
            "
          >
            ${matchup.homeScore}
          </strong>

          <strong
            style="
              color:
                ${
                  homeWon
                    ? "#ff4d4d"
                    : "#f2f2f2"
                };
            "
          >
            ${homeName}
          </strong>
        </div>
      `;
    }).join("");

  const awayWins =
    Number(
      headToHead.awayWins || 0
    );

  const homeWins =
    Number(
      headToHead.homeWins || 0
    );

  let summary = "";

  if (awayWins > homeWins) {
    summary = `
      🏆
      <strong style="color: #ff4d4d;">
        ${this.shortTeamName(
          game.awayTeam
        )}
      </strong>
      lead the last
      ${matchups.length}
      matchups:
      <strong style="color: #ff4d4d;">
        ${awayWins} - ${homeWins}
      </strong>
    `;
  } else if (homeWins > awayWins) {
    summary = `
      🏆
      <strong style="color: #ff4d4d;">
        ${this.shortTeamName(
          game.homeTeam
        )}
      </strong>
      lead the last
      ${matchups.length}
      matchups:
      <strong style="color: #ff4d4d;">
        ${homeWins} - ${awayWins}
      </strong>
    `;
  } else {
    summary = `
      ⚖️ The last
      ${matchups.length}
      matchups are tied:
      <strong>
        ${awayWins} - ${homeWins}
      </strong>
    `;
  }

  return `
    <div
      style="
        margin: 16px 0;
        padding: 12px;
        border: 1px solid #ff7a00;
        border-radius: 12px;
        background: rgba(255, 122, 0, 0.04);
        overflow: hidden;
      "
    >
      <div
        style="
          color: #ff7a00;
          font-weight: 800;
          text-align: center;
          letter-spacing: 0.6px;
        "
      >
        LAST 3 MATCHUPS
      </div>

      ${rows}

      <div
        style="
          margin-top: 11px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 122, 0, 0.35);
          text-align: center;
          font-size: 14px;
        "
      >
        ${summary}
      </div>
    </div>
  `;
},
  
  /*
  =========================================================
  BUILD MONEYLINE CARD
  =========================================================
  */

  async buildCard(game) {
    const awayStats = await safe(
      () =>
        API.getTeamStats(
          game.awayTeamId
        ),
      {
        hitting: {},
        pitching: {},
        fielding: {}
      }
    );

    const homeStats = await safe(
      () =>
        API.getTeamStats(
          game.homeTeamId
        ),
      {
        hitting: {},
        pitching: {},
        fielding: {}
      }
    );

    const awayPitcherStats =
      await safe(
        () =>
          API.getPlayerStats(
            game.awayPitcherId
          ),
        {}
      );

    const homePitcherStats =
      await safe(
        () =>
          API.getPlayerStats(
            game.homePitcherId
          ),
        {}
      );

    const headToHead =
      await safe(
       () =>
         API.getHeadToHead(
           game.awayTeamId,
           game.homeTeamId,
           game.date
        ),
      {
         games: [],
         awayWins: 0,
         homeWins: 0,
         ties: 0,
         leaderTeamId: null
        }
     );

    
    /*
    =======================================================
    ACTUAL RUN VALUES
    =======================================================
    */

    const awayRunsScoredPerGame =
      this.runsScoredPerGame(
        awayStats.hitting
      );

    const homeRunsScoredPerGame =
      this.runsScoredPerGame(
        homeStats.hitting
      );

    const awayRunsAllowedPerGame =
      this.runsAllowedPerGame(
        awayStats.pitching
      );

    const homeRunsAllowedPerGame =
      this.runsAllowedPerGame(
        homeStats.pitching
      );

    /*
    =======================================================
    CATEGORY SCORES
    =======================================================
    */

    const awayScores = {
      pitcher:
        game.awayPitcherId
          ? this.pitcherScore(
              awayPitcherStats
            )
          : 0,

      bullpen:
        this.bullpenScore(
          awayStats.pitching
        ),

      offense:
        this.offenseScore(
          awayStats.hitting
        ),

      defense:
        this.defenseScore(
          awayStats.fielding
        ),

      runsScored:
        this.runsScoredScore(
          awayStats.hitting
        ),

      runsAllowed:
        this.runsAllowedScore(
          awayStats.pitching
        )
    };

    const homeScores = {
      pitcher:
        game.homePitcherId
          ? this.pitcherScore(
              homePitcherStats
            )
          : 0,

      bullpen:
        this.bullpenScore(
          homeStats.pitching
        ),

      offense:
        this.offenseScore(
          homeStats.hitting
        ),

      defense:
        this.defenseScore(
          homeStats.fielding
        ),

      runsScored:
        this.runsScoredScore(
          homeStats.hitting
        ),

      runsAllowed:
        this.runsAllowedScore(
          homeStats.pitching
        )
    };

    /*
    =======================================================
    CHECKLIST WINNERS
    =======================================================
    */

    const categories = {
      pitcher:
        this.compareCategory(
          awayScores.pitcher,
          homeScores.pitcher
        ),

      bullpen:
        this.compareCategory(
          awayScores.bullpen,
          homeScores.bullpen
        ),

      offense:
        this.compareCategory(
          awayScores.offense,
          homeScores.offense
        ),

      defense:
        this.compareCategory(
          awayScores.defense,
          homeScores.defense
        ),

      runsScored:
        this.compareCategory(
          awayScores.runsScored,
          homeScores.runsScored
        ),

      runsAllowed:
        this.compareCategory(
          awayScores.runsAllowed,
          homeScores.runsAllowed
        )
    };

    const awayChecks =
      Object.values(categories)
        .filter(
          value => value === "away"
        )
        .length;

    const homeChecks =
      Object.values(categories)
        .filter(
          value => value === "home"
        )
        .length;

    /*
    =======================================================
    WEIGHTED TOTALS
    =======================================================
    */

    const awayTotal =
      awayScores.pitcher * 0.30 +
      awayScores.bullpen * 0.15 +
      awayScores.offense * 0.15 +
      awayScores.defense * 0.10 +
      awayScores.runsScored * 0.15 +
      awayScores.runsAllowed * 0.15;

    /*
    Home team receives a small 2-point home-field bonus.
    */

    const homeTotal =
      homeScores.pitcher * 0.30 +
      homeScores.bullpen * 0.15 +
      homeScores.offense * 0.15 +
      homeScores.defense * 0.10 +
      homeScores.runsScored * 0.15 +
      homeScores.runsAllowed * 0.15 +
      2;

   /*
=======================================================
/*
=======================================================
POPS PICK DECISION

More green checks wins.

If both teams have the same number of green checks,
the result is No Clear Advantage.

Weighted totals no longer decide the POPS Pick.
=======================================================
*/

let pick = "No Clear Advantage";

if (awayChecks > homeChecks) {
  pick = game.awayTeam;
} else if (homeChecks > awayChecks) {
  pick = game.homeTeam;
}

const confidence =
  awayChecks === homeChecks
    ? 50
    : this.confidenceScore(
        awayTotal,
        homeTotal,
        awayChecks,
        homeChecks
      );

    /*
    =======================================================
    CARD HTML
    =======================================================
    */

    return `
      <div class="pick-card">
        <h3>
          ${game.awayTeam} vs
          ${game.homeTeam}
        </h3>

        <p>
          ⏰ ${formatTime(game.date)}
        </p>

        <p>
          💰 POPS Pick:
          <span class="score">
            ${pick}
          </span>
        </p>

        <p class="small">
          Checklist:
          ${awayChecks} - ${homeChecks}
        </p>

        <p class="small">
          Confidence:
          ${confidence}%
        </p>

        <hr>

        <p>
          <strong>
            ${game.awayTeam}
          </strong>
        </p>

        <p>
          Starting Pitcher
          ${this.icon(
            categories.pitcher,
            "away"
          )}
          <span class="small">
            Score:
            ${awayScores.pitcher}
          </span>
        </p>

        <p>
          Better Bullpen
          ${this.icon(
            categories.bullpen,
            "away"
          )}
          <span class="small">
            Score:
            ${awayScores.bullpen}
          </span>
        </p>

        <p>
          Offense
          ${this.icon(
            categories.offense,
            "away"
          )}
          <span class="small">
            Score:
            ${awayScores.offense}
          </span>
        </p>

        <p>
          Defense
          ${this.icon(
            categories.defense,
            "away"
          )}
          <span class="small">
            Score:
            ${awayScores.defense}
          </span>
        </p>

        <p>
          Runs Scored/Game
          ${this.icon(
            categories.runsScored,
            "away"
          )}
          <span class="small">
            ${this.decimal(
              awayRunsScoredPerGame
            )}
            |
            Score:
            ${awayScores.runsScored}
          </span>
        </p>

        <p>
          Runs Allowed/Game
          ${this.icon(
            categories.runsAllowed,
            "away"
          )}
          <span class="small">
            ${this.decimal(
              awayRunsAllowedPerGame
            )}
            |
            Score:
            ${awayScores.runsAllowed}
          </span>
        </p>

        <p class="small">
          Starter:
          ${game.awayPitcher}
          |
          Overall:
          ${Math.round(awayTotal)}
        </p>

        <hr>

        <p>
          <strong>
            ${game.homeTeam}
          </strong>
        </p>

        <p>
          Starting Pitcher
          ${this.icon(
            categories.pitcher,
            "home"
          )}
          <span class="small">
            Score:
            ${homeScores.pitcher}
          </span>
        </p>

        <p>
          Better Bullpen
          ${this.icon(
            categories.bullpen,
            "home"
          )}
          <span class="small">
            Score:
            ${homeScores.bullpen}
          </span>
        </p>

        <p>
          Offense
          ${this.icon(
            categories.offense,
            "home"
          )}
          <span class="small">
            Score:
            ${homeScores.offense}
          </span>
        </p>

        <p>
          Defense
          ${this.icon(
            categories.defense,
            "home"
          )}
          <span class="small">
            Score:
            ${homeScores.defense}
          </span>
        </p>

        <p>
          Runs Scored/Game
          ${this.icon(
            categories.runsScored,
            "home"
          )}
          <span class="small">
            ${this.decimal(
              homeRunsScoredPerGame
            )}
            |
            Score:
            ${homeScores.runsScored}
          </span>
        </p>

        <p>
          Runs Allowed/Game
          ${this.icon(
            categories.runsAllowed,
            "home"
          )}
          <span class="small">
            ${this.decimal(
              homeRunsAllowedPerGame
            )}
            |
            Score:
            ${homeScores.runsAllowed}
          </span>
        </p>

        <p class="small">
          Starter:
          ${game.homePitcher}
          |
          Overall:
          ${Math.round(homeTotal)}
        </p>
      </div>
    `;
  },

  /*
  =========================================================
  LOAD ALL MONEYLINE CARDS
  =========================================================
  */

  async load(games) {
    moneylineBox.innerHTML =
      "<p>Loading Moneyline Pickz...</p>";

    const cards = [];

    for (const game of games) {
      const card =
        await this.buildCard(game);

      cards.push(card);
    }

    moneylineBox.innerHTML =
      cards.join("");
  }
};

async function loadMoneyline() {
  return await Moneyline.load(games);
}
