/*
=========================================================
POPS LADDER CHALLENGE V2
File: ladder.js
Version: 5.0
=========================================================

Official ladder data is loaded from:

data/ladder.json

The GitHub data builder controls:

- Shared daily players
- Current ladder day
- Wager amount
- Target amount
- Completed days
- Win/loss status
- Live hit results

Every phone, laptop and browser receives the same
official POPS Ladder Challenge.
=========================================================
*/

const Ladder = {
  box: null,

  settings: {
    picksPerDay: 2,
    maximumDays: 10,
    startingWager: 10,

    sharedFile:
      "data/ladder.json",

    cachePrefix:
      "pops-shared-ladder-v5"
  },

  /*
  =======================================================
  DATE HELPERS
  =======================================================
  */

  getDate() {
    if (
      typeof API !== "undefined" &&
      typeof API.today === "function"
    ) {
      return API.today();
    }

    const parts =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "America/New_York",

          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit"
        }
      ).formatToParts(
        new Date()
      );

    const values = {};

    for (
      const part of parts
    ) {
      values[part.type] =
        part.value;
    }

    return (
      `${values.year}-` +
      `${values.month}-` +
      `${values.day}`
    );
  },

  getCacheKey(
    date = this.getDate()
  ) {
    return (
      `${this.settings.cachePrefix}-${date}`
    );
  },

  /*
  =======================================================
  GENERAL HELPERS
  =======================================================
  */

  number(
    value,
    fallback = 0
  ) {
    const parsed =
      Number(value);

    return Number.isFinite(
      parsed
    )
      ? parsed
      : fallback;
  },

  clamp(
    value,
    minimum,
    maximum
  ) {
    return Math.max(
      minimum,
      Math.min(
        maximum,
        value
      )
    );
  },

  normalizeName(
    value = ""
  ) {
    return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-z0-9\s]/g,
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  },

  getPickKey(
    pick = {}
  ) {
    const playerId =
      this.number(
        pick.id ||
        pick.playerId
      );

    if (playerId > 0) {
      return `id-${playerId}`;
    }

    return [
      this.normalizeName(
        pick.player ||
        pick.name
      ),

      this.normalizeName(
        pick.team
      )
    ].join("-");
  },

  escapeHtml(
    value = ""
  ) {
    return String(value)
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  },

  getPlayerInitials(
    name = ""
  ) {
    const words =
      String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!words.length) {
      return "MLB";
    }

    if (
      words.length === 1
    ) {
      return words[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return (
      words[0].charAt(0) +
      words[
        words.length - 1
      ].charAt(0)
    ).toUpperCase();
  },

  findBox() {
    this.box =
      document.getElementById(
        "ladderBox"
      ) ||
      document.getElementById(
        "ladderChallengeBox"
      ) ||
      document.getElementById(
        "ladderPicksBox"
      );

    return this.box;
  },

  formatMoney(
    value
  ) {
    const amount =
      this.number(
        value
      );

    return (
      `$${amount.toLocaleString(
        "en-US"
      )}`
    );
  },

  formatGameTime(
    value
  ) {
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
      return String(value);
    }

    return date.toLocaleString(
      [],
      {
        weekday:
          "short",

        month:
          "short",

        day:
          "numeric",

        hour:
          "numeric",

        minute:
          "2-digit"
      }
    );
  },

  calculateWager(
    day = 1
  ) {
    const safeDay =
      this.clamp(
        this.number(
          day,
          1
        ),
        1,
        this.settings
          .maximumDays
      );

    return (
      this.settings
        .startingWager *
      Math.pow(
        2,
        safeDay - 1
      )
    );
  },

  /*
  =======================================================
  SHARED FILE CACHE
  =======================================================
  */

  saveSharedCache(
    challenge
  ) {
    try {
      localStorage.setItem(
        this.getCacheKey(
          challenge.date
        ),
        JSON.stringify(
          challenge
        )
      );
    } catch (error) {
      console.warn(
        "POPS could not cache shared Ladder:",
        error
      );
    }
  },

  loadSharedCache(
    date = this.getDate()
  ) {
    try {
      const saved =
        localStorage.getItem(
          this.getCacheKey(
            date
          )
        );

      if (!saved) {
        return null;
      }

      const parsed =
        JSON.parse(saved);

      if (
        !parsed ||
        parsed.date !== date ||
        !Array.isArray(
          parsed.picks
        ) ||
        parsed.picks.length !==
          this.settings.picksPerDay
      ) {
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn(
        "POPS could not load cached shared Ladder:",
        error
      );

      return null;
    }
  },

  /*
  =======================================================
  LOAD LADDER.JSON
  =======================================================
  */

  async fetchSharedChallenge() {
    const requestUrl =
      `${this.settings.sharedFile}` +
      `?_=${Date.now()}`;

    const response =
      await fetch(
        requestUrl,
        {
          cache:
            "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `ladder.json returned HTTP ${response.status}`
      );
    }

    const challenge =
      await response.json();

    if (
      !challenge ||
      typeof challenge !==
        "object"
    ) {
      throw new Error(
        "ladder.json did not contain valid Ladder data."
      );
    }

    if (
      !Array.isArray(
        challenge.picks
      )
    ) {
      throw new Error(
        "ladder.json did not contain a picks array."
      );
    }

    return challenge;
  },

  /*
  =======================================================
  VALIDATE CHALLENGE
  =======================================================
  */

  validateChallenge(
    challenge
  ) {
    if (
      !challenge ||
      typeof challenge !==
        "object"
    ) {
      return {
        valid:
          false,

        reason:
          "Shared Ladder data is unavailable."
      };
    }

    const currentDate =
      this.getDate();

    if (
      challenge.date !==
      currentDate
    ) {
      return {
        valid:
          false,

        reason:
          (
            `The shared Ladder is for ` +
            `${challenge.date || "another date"}, ` +
            `not ${currentDate}.`
          )
      };
    }

    if (
      challenge.status ===
        "unavailable"
    ) {
      return {
        valid:
          false,

        reason:
          (
            "The shared Ladder does not currently " +
            "have two eligible players."
          )
      };
    }

    if (
      !Array.isArray(
        challenge.picks
      ) ||
      challenge.picks.length <
        this.settings.picksPerDay
    ) {
      return {
        valid:
          false,

        reason:
          (
            "The shared Ladder does not currently " +
            "have two eligible players."
          )
      };
    }

    const validPlayers =
      challenge.picks.filter(
        pick =>
          pick &&
          (
            pick.player ||
            pick.name
          )
      );

    if (
      validPlayers.length <
      this.settings.picksPerDay
    ) {
      return {
        valid:
          false,

        reason:
          (
            "The shared Ladder player " +
            "information is incomplete."
          )
      };
    }

    return {
      valid:
        true,

      reason:
        ""
    };
  },

  /*
  =======================================================
  NORMALIZE PLAYER
  =======================================================
  */

  normalizeSharedPick(
    pick = {}
  ) {
    const bvpHits =
      this.number(
        pick.bvpHits ??
        pick.bvpStats?.hits
      );

    const bvpAtBats =
      this.number(
        pick.bvpAtBats ??
        pick.bvpStats?.atBats
      );

    const bvpPlateAppearances =
      this.number(
        pick.bvpPlateAppearances ??
        pick.bvpStats
          ?.plateAppearances
      );

    const hasPitcherHistory =
      pick.hasPitcherHistory !==
        undefined
        ? Boolean(
            pick.hasPitcherHistory
          )
        : (
            bvpAtBats > 0 ||
            bvpPlateAppearances > 0
          );

    return {
      id:
        this.number(
          pick.id ||
          pick.playerId
        ),

      player:
        pick.player ||
        pick.name ||
        "Unknown Player",

      team:
        pick.team ||
        "Team N/A",

      game:
        pick.game ||
        "Game unavailable",

      gamePk:
        this.number(
          pick.gamePk ||
          pick.gameId
        ),

      gameTime:
        pick.gameTime ||
        pick.date ||
        "",

      pitcher:
        pick.pitcher ||
        "Pitcher TBD",

      lineupSpot:
        this.number(
          pick.lineupSpot
        ),

      confirmed:
        Boolean(
          pick.confirmed
        ),

      hitStreak:
        this.number(
          pick.hitStreak
        ),

      bvpHits,

      bvpAtBats,

      bvpPlateAppearances,

      bvpAverage:
        pick.bvpAverage ||
        pick.bvpStats?.avg ||
        ".000",

      bvpHomeRuns:
        this.number(
          pick.bvpHomeRuns ??
          pick.bvpStats
            ?.homeRuns
        ),

      hasPitcherHistory,

      qualificationReason:
        pick.qualificationReason ||
        (
          hasPitcherHistory
            ? (
                "2+ game hit streak and at least " +
                "1 previous hit vs pitcher"
              )
            : (
                "4+ game hit streak with no " +
                "previous pitcher history"
              )
        ),

      score:
        this.number(
          pick.score
        ),

      result:
        String(
          pick.result ||
          "pending"
        ).toLowerCase(),

      hitsToday:
        this.number(
          pick.hitsToday
        )
    };
  },

  /*
  =======================================================
  NORMALIZE CHALLENGE
  =======================================================
  */

  normalizeChallenge(
    challenge
  ) {
    const day =
      this.clamp(
        this.number(
          challenge.day ??
          challenge.step,
          1
        ),
        1,
        this.settings.maximumDays
      );

    const wager =
      this.number(
        challenge.wager,
        this.calculateWager(
          day
        )
      );

    const target =
      this.number(
        challenge.target,
        wager * 2
      );

    const completedDays =
      Array.isArray(
        challenge.completedDays
      )
        ? challenge.completedDays
            .map(
              completedDay =>
                this.number(
                  completedDay
                )
            )
            .filter(
              completedDay =>
                completedDay >= 1 &&
                completedDay <=
                  this.settings
                    .maximumDays
            )
        : Array.from(
            {
              length:
                Math.max(
                  0,
                  day - 1
                )
            },
            (
              _,
              index
            ) => index + 1
          );

    return {
      ...challenge,

      date:
        challenge.date ||
        this.getDate(),

      day,

      step:
        day,

      wager,

      target,

      maximumDay:
        this.number(
          challenge.maximumDay,
          this.settings.maximumDays
        ),

      completedDays,

      previousDate:
        challenge.previousDate ||
        "",

      previousResult:
        challenge.previousResult ||
        "none",

      previousStatus:
        challenge.previousStatus ||
        "none",

      cycleCompleted:
        challenge.cycleCompleted ===
        true,

      status:
        String(
          challenge.status ||
          "pending"
        ).toLowerCase(),

      selectionType:
        challenge.selectionType ||
        "shared-daily-random",

      locked:
        true,

      picks:
        challenge.picks
          .slice(
            0,
            this.settings.picksPerDay
          )
          .map(
            pick =>
              this.normalizeSharedPick(
                pick
              )
          )
    };
  },

  /*
  =======================================================
  MERGE CURRENT DISPLAY DATA
  =======================================================
  */

  mergeCurrentData(
    sharedChallenge,
    currentHitPicks = []
  ) {
    const currentMap =
      new Map();

    for (
      const currentPick of
      currentHitPicks
    ) {
      currentMap.set(
        this.getPickKey(
          currentPick
        ),
        currentPick
      );
    }

    return {
      ...sharedChallenge,

      picks:
        sharedChallenge.picks.map(
          sharedPick => {
            const currentPick =
              currentMap.get(
                this.getPickKey(
                  sharedPick
                )
              );

            if (!currentPick) {
              return sharedPick;
            }

            const currentBvpHits =
              this.number(
                currentPick.bvpHits ??
                currentPick.bvpStats
                  ?.hits,
                sharedPick.bvpHits
              );

            const currentBvpAtBats =
              this.number(
                currentPick.bvpAtBats ??
                currentPick.bvpStats
                  ?.atBats,
                sharedPick.bvpAtBats
              );

            const currentBvpPlateAppearances =
              this.number(
                currentPick
                  .bvpPlateAppearances ??
                currentPick.bvpStats
                  ?.plateAppearances,
                sharedPick
                  .bvpPlateAppearances
              );

            return {
              ...sharedPick,

              id:
                sharedPick.id,

              player:
                sharedPick.player,

              team:
                currentPick.team ||
                sharedPick.team,

              game:
                currentPick.game ||
                sharedPick.game,

              gamePk:
                this.number(
                  currentPick.gamePk,
                  sharedPick.gamePk
                ),

              gameTime:
                currentPick.gameTime ||
                sharedPick.gameTime,

              pitcher:
                currentPick.pitcher ||
                sharedPick.pitcher,

              lineupSpot:
                this.number(
                  currentPick.lineupSpot,
                  sharedPick.lineupSpot
                ),

              confirmed:
                currentPick.confirmed !==
                  undefined
                  ? Boolean(
                      currentPick.confirmed
                    )
                  : sharedPick.confirmed,

              hitStreak:
                this.number(
                  currentPick.hitStreak,
                  sharedPick.hitStreak
                ),

              bvpHits:
                currentBvpHits,

              bvpAtBats:
                currentBvpAtBats,

              bvpPlateAppearances:
                currentBvpPlateAppearances,

              bvpAverage:
                currentPick.bvpAverage ||
                currentPick.bvpStats
                  ?.avg ||
                sharedPick.bvpAverage,

              score:
                this.number(
                  currentPick.score,
                  sharedPick.score
                ),

              result:
                sharedPick.result ||
                "pending",

              hitsToday:
                this.number(
                  sharedPick.hitsToday
                )
            };
          }
        )
    };
  },

  /*
  =======================================================
  STATUS HELPERS
  =======================================================
  */

  getStatusLabel(
    status = "pending"
  ) {
    if (status === "won") {
      return "✅ Today's Ladder Won";
    }

    if (status === "lost") {
      return "❌ Today's Ladder Lost";
    }

    if (status === "held") {
      return "⏸️ Ladder Day Held";
    }

    if (
      status === "unavailable"
    ) {
      return "⚠️ Picks Unavailable";
    }

    return "⏳ Waiting for Results";
  },

  getStatusDescription(
    status = "pending",
    day = 1
  ) {
    if (status === "won") {
      return (
        `Both players recorded a hit. ` +
        `Day ${day} is complete.`
      );
    }

    if (status === "lost") {
      return (
        "At least one player finished without a hit. " +
        "The Ladder will reset to Day 1."
      );
    }

    if (status === "held") {
      return (
        "A selected game was postponed, suspended " +
        "or cancelled. This Ladder day is being held."
      );
    }

    return (
      "Both shared players must record at least " +
      "one hit to advance to the next day."
    );
  },

  getPickResultLabel(
    result = "pending",
    hitsToday = 0
  ) {
    if (result === "hit") {
      return (
        `✅ Recorded a Hit` +
        (
          hitsToday > 1
            ? ` (${hitsToday} hits)`
            : ""
        )
      );
    }

    if (result === "miss") {
      return "❌ No Hit";
    }

    return "⏳ Game Pending";
  },

  getDayState(
    dayNumber,
    challenge
  ) {
    const currentDay =
      challenge.day;

    const completedDays =
      challenge.completedDays ||
      [];

    const status =
      challenge.status;

    if (
      completedDays.includes(
        dayNumber
      )
    ) {
      return "complete";
    }

    if (
      dayNumber <
      currentDay
    ) {
      return "complete";
    }

    if (
      dayNumber ===
      currentDay
    ) {
      if (status === "won") {
        return "complete";
      }

      if (status === "lost") {
        return "failed";
      }

      if (status === "held") {
        return "held";
      }

      return "active";
    }

    return "locked";
  },

  getDayIcon(
    dayState,
    dayNumber
  ) {
    if (
      dayState === "complete"
    ) {
      return "✓";
    }

    if (
      dayState === "failed"
    ) {
      return "✕";
    }

    if (
      dayState === "held"
    ) {
      return "Ⅱ";
    }

    return dayNumber;
  },

  renderDayTracker(
    challenge
  ) {
    const days = [];

    for (
      let dayNumber = 1;
      dayNumber <=
        this.settings.maximumDays;
      dayNumber++
    ) {
      const dayState =
        this.getDayState(
          dayNumber,
          challenge
        );

      const dayWager =
        this.calculateWager(
          dayNumber
        );

      days.push(`
        <div
          class="
            ladder-day-node
            ladder-day-${dayState}
          "
        >
          <div class="ladder-day-circle">
            ${this.getDayIcon(
              dayState,
              dayNumber
            )}
          </div>

          <strong>
            Day ${dayNumber}
          </strong>

          <small>
            ${this.formatMoney(
              dayWager
            )}
          </small>
        </div>
      `);
    }

    return days.join("");
  },

  /*
  =======================================================
  PLAYER CARD
  =======================================================
  */

  renderPick(
    pick,
    index
  ) {
    const player =
      this.escapeHtml(
        pick.player ||
        "Player unavailable"
      );

    const team =
      this.escapeHtml(
        pick.team ||
        "Team unavailable"
      );

    const game =
      this.escapeHtml(
        pick.game ||
        "Game unavailable"
      );

    const gameTime =
      this.escapeHtml(
        this.formatGameTime(
          pick.gameTime
        )
      );

    const pitcher =
      this.escapeHtml(
        pick.pitcher ||
        "Pitcher TBD"
      );

    const initials =
      this.escapeHtml(
        this.getPlayerInitials(
          pick.player
        )
      );

    const qualificationReason =
      this.escapeHtml(
        pick.qualificationReason ||
        ""
      );

    const result =
      String(
        pick.result ||
        "pending"
      ).toLowerCase();

    const resultClass =
      result === "hit"
        ? "ladder-result-hit"
        : result === "miss"
          ? "ladder-result-miss"
          : "ladder-result-pending";

    const lineupClass =
      pick.confirmed
        ? "ladder-confirmed"
        : "ladder-projected";

    const hasHistory =
      Boolean(
        pick.hasPitcherHistory
      );

    const historyDisplay =
      hasHistory
        ? (
            `${this.number(
              pick.bvpHits
            )}/${this.number(
              pick.bvpAtBats
            )}`
          )
        : "No history";

    return `
      <article class="ladder-player-card">

        <div class="ladder-player-topbar">

          <span class="ladder-pick-tag">
            SHARED PICK ${index + 1}
          </span>

          <span
            class="
              ladder-lineup-badge
              ${lineupClass}
            "
          >
            ${
              pick.confirmed
                ? "LINEUP CONFIRMED ✓"
                : "PROJECTED LINEUP"
            }
          </span>

        </div>

        <div class="ladder-player-profile">

          <div class="ladder-player-avatar">

            <span>
              ${initials}
            </span>

            <small>
              🔥
            </small>

          </div>

          <div class="ladder-player-copy">

            <h3>
              ${player}
            </h3>

            <div class="ladder-player-detail">
              <span>
                Team
              </span>

              <strong>
                ${team}
              </strong>
            </div>

            <div class="ladder-player-detail">
              <span>
                Game
              </span>

              <strong>
                ${game}
              </strong>
            </div>

            <div class="ladder-player-detail">
              <span>
                Date/Time
              </span>

              <strong>
                ${gameTime}
              </strong>
            </div>

            <div class="ladder-player-detail">
              <span>
                Vs Pitcher
              </span>

              <strong>
                ${pitcher}
              </strong>
            </div>

          </div>

        </div>

        <div class="ladder-stat-grid">

          <div class="ladder-stat-box">

            <span class="ladder-stat-icon">
              🔥
            </span>

            <small>
              Hit Streak
            </small>

            <strong>
              ${this.number(
                pick.hitStreak
              )}
            </strong>

            <em>
              Games
            </em>

          </div>

          <div class="ladder-stat-box">

            <span class="ladder-stat-icon">
              ⚔️
            </span>

            <small>
              BvP Hits
            </small>

            <strong>
              ${historyDisplay}
            </strong>

            <em>
              ${
                hasHistory
                  ? "Career"
                  : "Streak Rule"
              }
            </em>

          </div>

          <div class="ladder-stat-box">

            <span class="ladder-stat-icon">
              🎯
            </span>

            <small>
              Hit Score
            </small>

            <strong>
              ${this.number(
                pick.score
              )}

              <span>
                /100
              </span>
            </strong>

            <em>
              POPS Score
            </em>

          </div>

        </div>

        <div class="ladder-qualification-note">

          <span>
            ✅ Qualified:
          </span>

          ${qualificationReason}

        </div>

        <div
          class="
            ladder-player-result
            ${resultClass}
          "
        >
          ${this.getPickResultLabel(
            result,
            this.number(
              pick.hitsToday
            )
          )}
        </div>

      </article>
    `;
  },

  /*
  =======================================================
  MAIN LADDER DISPLAY
  =======================================================
  */

  render(
    challenge
  ) {
    if (!this.findBox()) {
      console.warn(
        "POPS Ladder could not find ladderBox."
      );

      return;
    }

    const validation =
      this.validateChallenge(
        challenge
      );

    if (!validation.valid) {
      this.renderUnavailable(
        validation.reason
      );

      return;
    }

    const day =
      this.clamp(
        this.number(
          challenge.day ??
          challenge.step,
          1
        ),
        1,
        this.settings.maximumDays
      );

    const wager =
      this.number(
        challenge.wager,
        this.calculateWager(
          day
        )
      );

    const target =
      this.number(
        challenge.target,
        wager * 2
      );

    const status =
      String(
        challenge.status ||
        "pending"
      ).toLowerCase();

    this.box.innerHTML = `
      <div class="ladder-v2">

        <header class="ladder-v2-header">

          <div class="ladder-v2-title">

            <span>
              🪜
            </span>

            <div>

              <small>
                SHARED DAILY CHALLENGE
              </small>

              <h3>
                POPS Ladder Challenge
              </h3>

            </div>

          </div>

          <p>
            One day, two players, same goal.
            Both shared players must record at least
            one hit to advance.
          </p>

        </header>

        <section class="ladder-progress-panel">

          <div class="ladder-progress-heading">

            <div>

              <span>
                DAY ${day} OF
                ${this.settings.maximumDays}
              </span>

              <h4>
                Two Shared Picks Must Hit
              </h4>

            </div>

            <div
              class="
                ladder-main-status
                ladder-status-${status}
              "
            >
              ${this.getStatusLabel(
                status
              )}
            </div>

          </div>

          <div class="ladder-money-panel">

            <div class="ladder-money-box">

              <small>
                TODAY'S WAGER
              </small>

              <strong>
                ${this.formatMoney(
                  wager
                )}
              </strong>

            </div>

            <div class="ladder-money-arrow">
              →
            </div>

            <div class="ladder-money-box">

              <small>
                TODAY'S GOAL
              </small>

              <strong>
                ${this.formatMoney(
                  target
                )}
              </strong>

            </div>

          </div>

          <div class="ladder-day-grid">

            ${this.renderDayTracker(
              challenge
            )}

          </div>

          <div
            class="
              ladder-waiting-panel
              ladder-waiting-${status}
            "
          >

            <strong>
              ${this.getStatusLabel(
                status
              )}
            </strong>

            <p>
              ${this.getStatusDescription(
                status,
                day
              )}
            </p>

          </div>

        </section>

        <div class="ladder-player-grid">

          ${challenge.picks
            .map(
              (pick, index) =>
                this.renderPick(
                  pick,
                  index
                )
            )
            .join("")}

        </div>

        <div class="ladder-rule-panel">

          <span class="ladder-rule-icon">
            🌐
          </span>

          <div>

            <strong>
              Global Daily Pick Lock
            </strong>

            <p>
              Everyone receives these exact same two
              players. A win advances the Ladder to the
              next day. A loss resets the Ladder to
              Day 1.
            </p>

          </div>

        </div>

      </div>
    `;
  },

  /*
  =======================================================
  LOADING AND ERROR DISPLAYS
  =======================================================
  */

  renderLoading() {
    if (!this.findBox()) {
      return;
    }

    this.box.innerHTML = `
      <div class="ladder-empty-v2">

        <div class="ladder-empty-icon">
          🌐
        </div>

        <h3>
          Loading Shared Ladder
        </h3>

        <p>
          Loading today's two shared
          POPS Ladder selections...
        </p>

      </div>
    `;
  },

  renderUnavailable(
    reason = ""
  ) {
    if (!this.findBox()) {
      return;
    }

    const safeReason =
      this.escapeHtml(
        reason ||
        (
          "The Ladder needs at least two " +
          "eligible POPS Hitz Pickz."
        )
      );

    this.box.innerHTML = `
      <div class="ladder-empty-v2">

        <div class="ladder-empty-icon">
          🪜
        </div>

        <h3>
          Ladder Picks Not Available
        </h3>

        <p>
          ${safeReason}
        </p>

        <div class="ladder-empty-rules">

          <p>
            ✅ With pitcher history:
            2+ game hit streak and at least
            one previous hit.
          </p>

          <p>
            ✅ Without pitcher history:
            4+ game hit streak.
          </p>

        </div>

      </div>
    `;
  },

  renderError(
    error
  ) {
    if (!this.findBox()) {
      return;
    }

    const message =
      this.escapeHtml(
        error?.message ||
        "An unknown Ladder error occurred."
      );

    this.box.innerHTML = `
      <div class="ladder-empty-v2">

        <div class="ladder-empty-icon">
          ⚠️
        </div>

        <h3>
          Shared Ladder Could Not Load
        </h3>

        <p>
          ${message}
        </p>

      </div>
    `;
  },

  /*
  =======================================================
  MAIN LOAD FUNCTION
  =======================================================
  */

  async load(
    currentHitPicks = [],
    games = []
  ) {
    this.renderLoading();

    try {
      let sharedChallenge;

      try {
        sharedChallenge =
          await this.fetchSharedChallenge();

        const validation =
          this.validateChallenge(
            sharedChallenge
          );

        if (!validation.valid) {
          this.renderUnavailable(
            validation.reason
          );

          return;
        }

        sharedChallenge =
          this.normalizeChallenge(
            sharedChallenge
          );

        this.saveSharedCache(
          sharedChallenge
        );

        console.log(
          "🌐 POPS loaded shared Ladder picks from ladder.json:",
          sharedChallenge.picks.map(
            pick => pick.player
          )
        );
      } catch (fetchError) {
        console.warn(
          "POPS could not download ladder.json. Checking shared cache:",
          fetchError
        );

        sharedChallenge =
          this.loadSharedCache(
            this.getDate()
          );

        if (!sharedChallenge) {
          throw fetchError;
        }

        sharedChallenge =
          this.normalizeChallenge(
            sharedChallenge
          );

        console.log(
          "📦 POPS loaded today's cached shared Ladder."
        );
      }

      const finalChallenge =
        this.mergeCurrentData(
          sharedChallenge,
          Array.isArray(
            currentHitPicks
          )
            ? currentHitPicks
            : []
        );

      this.render(
        finalChallenge
      );

      window.sharedLadderChallenge =
        finalChallenge;

      console.log(
        "✅ POPS Ladder Challenge v2 loaded:",
        finalChallenge
      );
    } catch (error) {
      console.error(
        "POPS Shared Ladder error:",
        error
      );

      this.renderError(
        error
      );
    }
  }
};

window.Ladder =
  Ladder;