/*
=========================================================
POPS PICKZ HITZ MODEL
Version: 2.0

PLAYER MUST HAVE BOTH:

1. Hit streak of at least 2 games
2. At least 1 career hit vs today’s opposing pitcher

SORTING:

1. Hit streak
2. BvP hits
3. BvP batting average
4. POPS Hit Score
=========================================================
*/

const Hits = {
  /*
  =========================================================
  GENERAL HELPERS
  =========================================================
  */

  num(value) {
    const number = Number(
      String(value ?? "").replace(/,/g, "")
    );

    return Number.isFinite(number)
      ? number
      : 0;
  },

  clamp(score) {
    return Math.max(
      0,
      Math.min(100, Math.round(score))
    );
  },

  formatAverage(value) {
    const number = this.num(value);

    if (number <= 0) {
      return ".000";
    }

    return number
      .toFixed(3)
      .replace(/^0/, "");
  },

  /*
  =========================================================
  HIT STREAK

  Uses API.getHitStreak() from your current api.js.
  =========================================================
  */

  async getHitStreak(playerId) {
    if (!playerId) {
      return 0;
    }

    try {
      return this.num(
        await API.getHitStreak(playerId)
      );
    } catch (error) {
      console.warn(
        "POPS Hit streak error:",
        error
      );

      return 0;
    }
  },

  /*
  =========================================================
  CAREER BATTER VS PITCHER STATS

  Your api.js returns the normalized BvP object directly.
  =========================================================
  */

  async getBvpStats(
    batterId,
    pitcherId
  ) {
    const empty = {
      atBats: 0,
      plateAppearances: 0,
      hits: 0,
      doubles: 0,
      triples: 0,
      homeRuns: 0,
      avg: 0,
      obp: 0,
      slg: 0,
      ops: 0
    };

    if (
      !batterId ||
      !pitcherId
    ) {
      return empty;
    }

    try {
      const stats =
        await API.getBatterVsPitcher(
          batterId,
          pitcherId
        );

      return {
        atBats:
          this.num(stats?.atBats),

        plateAppearances:
          this.num(
            stats?.plateAppearances
          ),

        hits:
          this.num(stats?.hits),

        doubles:
          this.num(stats?.doubles),

        triples:
          this.num(stats?.triples),

        homeRuns:
          this.num(stats?.homeRuns),

        avg:
          this.num(stats?.avg),

        obp:
          this.num(stats?.obp),

        slg:
          this.num(stats?.slg),

        ops:
          this.num(stats?.ops)
      };
    } catch (error) {
      console.warn(
        "POPS BvP hit error:",
        error
      );

      return empty;
    }
  },

  /*
  =========================================================
  POPS HIT SCORE
  =========================================================
  */

  calculateHitScore({
    hitStreak,
    bvpHits,
    bvpAtBats,
    bvpAvg,
    lineupSpot
  }) {
    let score = 50;

    /*
    Hit-streak strength.
    */

    score +=
      Math.min(hitStreak, 10) * 3;

    /*
    Career hits against the opposing pitcher.
    */

    score +=
      Math.min(bvpHits, 8) * 4;

    /*
    BvP batting-average bonus.
    Only apply it when the player has at least 3 at-bats.
    */

    if (bvpAtBats >= 3) {
      if (bvpAvg >= 0.400) {
        score += 12;
      } else if (bvpAvg >= 0.300) {
        score += 9;
      } else if (bvpAvg >= 0.250) {
        score += 6;
      } else if (bvpAvg >= 0.200) {
        score += 3;
      }
    }

    /*
    Top-of-order lineup bonus.
    */

    if (
      lineupSpot >= 1 &&
      lineupSpot <= 3
    ) {
      score += 8;
    } else if (
      lineupSpot >= 4 &&
      lineupSpot <= 6
    ) {
      score += 5;
    } else {
      score += 2;
    }

    return this.clamp(score);
  },

  /*
  =========================================================
  PLAYER REASONS
  =========================================================
  */

  buildReasons({
    hitStreak,
    bvpHits,
    bvpAtBats,
    bvpAvg,
    lineupSpot
  }) {
    const reasons = [];

    reasons.push(
      `${hitStreak}-game hit streak`
    );

    reasons.push(
      `${bvpHits} career hit${
        bvpHits === 1 ? "" : "s"
      } vs pitcher`
    );

    if (bvpAtBats > 0) {
      reasons.push(
        `${this.formatAverage(
          bvpAvg
        )} BvP AVG`
      );
    }

    if (
      lineupSpot >= 1 &&
      lineupSpot <= 4
    ) {
      reasons.push(
        `Batting #${lineupSpot}`
      );
    }

    return reasons.join(" • ");
  },

  /*
  =========================================================
  ADD QUALIFIED LINEUP PLAYERS

  IMPORTANT:

  The player must satisfy BOTH conditions.
  =========================================================
  */

  async addLineupHitTargets({
    order,
    players,
    team,
    game,
    opposingPitcher,
    opposingPitcherId,
    targets
  }) {
    if (
      !Array.isArray(order) ||
      !order.length ||
      !opposingPitcherId
    ) {
      return;
    }

    for (
      let index = 0;
      index < order.length;
      index++
    ) {
      const playerId =
        Number(order[index] || 0);

      if (!playerId) {
        continue;
      }

      const player =
        players?.[`ID${playerId}`];

      if (!player) {
        continue;
      }

      const playerName =
        player?.person?.fullName ||
        player?.fullName ||
        "Unknown Player";

      const lineupSpot =
        index + 1;

      const [
        hitStreak,
        bvp
      ] = await Promise.all([
        this.getHitStreak(
          playerId
        ),

        this.getBvpStats(
          playerId,
          opposingPitcherId
        )
      ]);

      const bvpHits =
        this.num(bvp.hits);

      /*
      =====================================================
      REQUIRED QUALIFICATION

      Must have:

      - Hit streak of 2 or more
      AND
      - At least 1 hit vs opposing pitcher
      =====================================================
      */

      if (
        hitStreak < 2 ||
        bvpHits < 1
      ) {
        continue;
      }

      const bvpAtBats =
        this.num(bvp.atBats);

      const bvpAvg =
        bvpAtBats > 0
          ? bvpHits / bvpAtBats
          : this.num(bvp.avg);

      const hitScore =
        this.calculateHitScore({
          hitStreak,
          bvpHits,
          bvpAtBats,
          bvpAvg,
          lineupSpot
        });

      const reasons =
        this.buildReasons({
          hitStreak,
          bvpHits,
          bvpAtBats,
          bvpAvg,
          lineupSpot
        });

      targets.push({
        playerId,
        name: playerName,
        team,
        game,

        pitcher:
          opposingPitcher ||
          "TBD",

        pitcherId:
          opposingPitcherId,

        lineupSpot,

        hitStreak,

        bvpHits,
        bvpAtBats,
        bvpAvg,

        bvpHomeRuns:
          this.num(
            bvp.homeRuns
          ),

        hitScore,
        reasons,

        type:
          "Confirmed lineup"
      });
    }
  },

  /*
  =========================================================
  LOAD ALL HIT PICKZ
  =========================================================
  */

  async load(games) {
    let targets = [];

    hitPicksBox.innerHTML =
      "<p>Loading POPS Hitz Pickz...</p>";

    for (const game of games) {
      try {
        const live =
          await API.getLiveGame(
            game.gamePk,
            true
          );

        if (!live) {
          continue;
        }

        const away =
          live?.gameData?.teams
            ?.away?.name ||
          game.awayTeam ||
          "Away Team";

        const home =
          live?.gameData?.teams
            ?.home?.name ||
          game.homeTeam ||
          "Home Team";

        const gameName =
          `${away} vs ${home}`;

        const players =
          live?.gameData?.players ||
          {};

        const awayOrder =
          live?.liveData?.boxscore
            ?.teams?.away
            ?.battingOrder ||
          [];

        const homeOrder =
          live?.liveData?.boxscore
            ?.teams?.home
            ?.battingOrder ||
          [];

        const awayPitcherObject =
          live?.gameData
            ?.probablePitchers
            ?.away ||
          null;

        const homePitcherObject =
          live?.gameData
            ?.probablePitchers
            ?.home ||
          null;

        const awayPitcher =
          awayPitcherObject
            ?.fullName ||
          game.awayPitcher ||
          "TBD";

        const homePitcher =
          homePitcherObject
            ?.fullName ||
          game.homePitcher ||
          "TBD";

        const awayPitcherId =
          Number(
            awayPitcherObject?.id ||
            game.awayPitcherId ||
            0
          );

        const homePitcherId =
          Number(
            homePitcherObject?.id ||
            game.homePitcherId ||
            0
          );

        /*
        Away hitters face the home pitcher.
        */

        await this.addLineupHitTargets({
          order: awayOrder,
          players,
          team: away,
          game: gameName,

          opposingPitcher:
            homePitcher,

          opposingPitcherId:
            homePitcherId,

          targets
        });

        /*
        Home hitters face the away pitcher.
        */

        await this.addLineupHitTargets({
          order: homeOrder,
          players,
          team: home,
          game: gameName,

          opposingPitcher:
            awayPitcher,

          opposingPitcherId:
            awayPitcherId,

          targets
        });
      } catch (error) {
        console.warn(
          "POPS Hit Pickz game error:",
          error
        );
      }
    }

    /*
    Remove duplicate players.
    */

    const uniqueTargets =
      new Map();

    for (const target of targets) {
      const key =
        `${target.playerId}-${target.pitcherId}`;

      const existing =
        uniqueTargets.get(key);

      if (
        !existing ||
        target.hitScore >
          existing.hitScore
      ) {
        uniqueTargets.set(
          key,
          target
        );
      }
    }

    targets = Array.from(
      uniqueTargets.values()
    );

    /*
    Sorting order:

    1. Longest hit streak
    2. Most BvP hits
    3. Highest BvP batting average
    4. Highest POPS Hit Score
    */

    targets.sort((a, b) => {
      if (
        b.hitStreak !==
        a.hitStreak
      ) {
        return (
          b.hitStreak -
          a.hitStreak
        );
      }

      if (
        b.bvpHits !==
        a.bvpHits
      ) {
        return (
          b.bvpHits -
          a.bvpHits
        );
      }

      if (
        b.bvpAvg !==
        a.bvpAvg
      ) {
        return (
          b.bvpAvg -
          a.bvpAvg
        );
      }

      return (
        b.hitScore -
        a.hitScore
      );
    });

    targets =
      targets.slice(0, 20);

    /*
    Keep the global hitPicks array updated for other files.
    */

    if (
      typeof hitPicks !==
      "undefined"
    ) {
      hitPicks = targets;
    }

    /*
    =======================================================
    EMPTY STATE
    =======================================================
    */

    if (!targets.length) {
      updateBox(
        hitPicksBox,
        "hits",
        `
          <div class="pick-card">
            <h3>
              🔥 No Qualified Hitz Pickz Yet
            </h3>

            <p class="small">
              A player must be in a confirmed lineup,
              have a hit streak of at least 2 games,
              and have at least 1 career hit against
              today's opposing pitcher.
            </p>
          </div>
        `
      );

      return;
    }

    /*
    =======================================================
    CARD HTML
    =======================================================
    */

    const html = targets
      .map(
        (player, index) => `
          <div class="pick-card">
            <span class="rank-badge">
              #${index + 1}
            </span>

            <h3>
              🔥 ${player.name}
            </h3>

            <p>
              <strong>Team:</strong>
              ${player.team}
            </p>

            <p>
              <strong>Game:</strong>
              ${player.game}
            </p>

            <p>
              <strong>Vs Pitcher:</strong>
              ${player.pitcher}
            </p>

            <p>
              <strong>Lineup Spot:</strong>
              #${player.lineupSpot}
              ✅ Confirmed
            </p>

            <p>
              <strong>Hit Streak:</strong>
              ${player.hitStreak}
              games ✅
            </p>

            <p>
              <strong>Career BvP:</strong>
              ${player.bvpHits}-for-${player.bvpAtBats}
            </p>

            <p>
              <strong>BvP AVG:</strong>
              ${this.formatAverage(
                player.bvpAvg
              )}
            </p>

            <p>
              <strong>HR vs Pitcher:</strong>
              ${player.bvpHomeRuns}
            </p>

            <p>
              <strong>POPS Hit Score:</strong>

              <span class="hr-score">
                ${player.hitScore}/100
              </span>
            </p>

            <p class="small">
              Hit streak requirement ✅
              <br>
              Previous hit vs pitcher requirement ✅
              <br>
              ${player.reasons}
            </p>
          </div>
        `
      )
      .join("");

    updateBox(
      hitPicksBox,
      "hits",
      html
    );
  }
};

async function loadHitPicks(games) {
  return await Hits.load(games);
}