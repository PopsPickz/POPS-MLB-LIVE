/*
=========================================================
POPS SHARED LADDER CHALLENGE
File: ladder.js
Version: 4.0
=========================================================

The two Ladder players are selected by the GitHub data
builder and saved inside:

data/ladder.json

Every phone, laptop, browser and website visitor loads
the same two players.

The browser does not randomly select players.

The shared selections remain unchanged until GitHub
creates a new ladder.json for the next Eastern date.
=========================================================
*/

const Ladder = {
  box: null,

  settings: {
    picksPerStep: 2,
    maximumSteps: 3,

    sharedFile:
      "data/ladder.json",

    cachePrefix:
      "pops-shared-ladder-v4"
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

    const now =
      new Date();

    const year =
      now.getFullYear();

    const month =
      String(
        now.getMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        now.getDate()
      ).padStart(
        2,
        "0"
      );

    return (
      `${year}-${month}-${day}`
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

    return Number.isFinite(parsed)
      ? parsed
      : fallback;
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
        pick.playerId ||
        0
      );

    if (playerId > 0) {
      return (
        `id-${playerId}`
      );
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

    if (words.length === 1) {
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
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }
    );
  },

  /*
  =======================================================
  SHARED FILE CACHE
  =======================================================

  This cache is only an emergency fallback when the
  website temporarily cannot download ladder.json.

  It does not select or replace players.
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
          this.settings.picksPerStep
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
  LOAD SHARED LADDER.JSON
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
          cache: "no-store"
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
        "ladder.json did not contain a valid challenge."
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
  VALIDATE SHARED CHALLENGE
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
        valid: false,
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
        valid: false,
        reason:
          `The shared Ladder is for ${challenge.date || "another date"}, not ${currentDate}.`
      };
    }

    if (
      !Array.isArray(
        challenge.picks
      ) ||
      challenge.picks.length <
        this.settings.picksPerStep
    ) {
      return {
        valid: false,
        reason:
          "The shared Ladder does not currently have two eligible players."
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
      this.settings.picksPerStep
    ) {
      return {
        valid: false,
        reason:
          "The shared Ladder player information is incomplete."
      };
    }

    return {
      valid: true,
      reason: ""
    };
  },

  /*
  =======================================================
  NORMALIZE SHARED PLAYER
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
          pick.bvpStats?.homeRuns
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
        pick.result ||
        "pending",

      hitsToday:
        this.number(
          pick.hitsToday
        )
    };
  },

  normalizeChallenge(
    challenge
  ) {
    return {
      ...challenge,

      date:
        challenge.date ||
        this.getDate(),

      step:
        Math.max(
          1,
          this.number(
            challenge.step,
            1
          )
        ),

      status:
        challenge.status ||
        "pending",

      selectionType:
        challenge.selectionType ||
        "shared-daily-random",

      locked:
        true,

      picks:
        challenge.picks
          .slice(
            0,
            this.settings.picksPerStep
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

  ladder.json remains the authority for player identity.

  The current browser Hit Pickz list may update:
  - score
  - lineup confirmation
  - pitcher
  - game information
  - current streak and BvP display

  It cannot replace either selected player.
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

            const hasPitcherHistory =
              currentPick
                .hasPitcherHistory !==
                undefined
                ? Boolean(
                    currentPick
                      .hasPitcherHistory
                  )
                : (
                    currentBvpAtBats > 0 ||
                    currentBvpPlateAppearances >
                      0
                  );

            return {
              ...sharedPick,

              /*
              These values remain locked to ladder.json.
              */

              id:
                sharedPick.id,

              player:
                sharedPick.player,

              /*
              These values can refresh for display.
              */

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

              hasPitcherHistory,

              qualificationReason:
                currentPick
                  .qualificationReason ||
                sharedPick
                  .qualificationReason,

              score:
                this.number(
                  currentPick.score,
                  sharedPick.score
                ),

              /*
              Preserve result fields supplied by the
              shared challenge.
              */

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
  STATUS LABELS
  =======================================================
  */

  getStatusLabel(
    status = "pending"
  ) {
    if (status === "won") {
      return "✅ Ladder Step Won";
    }

    if (status === "lost") {
      return "❌ Ladder Step Lost";
    }

    if (status === "unavailable") {
      return "⚠️ Picks Unavailable";
    }

    return "⏳ Waiting for Results";
  },

  getPickResultLabel(
    result = "pending"
  ) {
    if (result === "hit") {
      return "✅ Recorded a Hit";
    }

    if (result === "miss") {
      return "❌ No Hit";
    }

    return "⏳ Game Pending";
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
            result
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

    const step =
      Math.max(
        1,
        Math.min(
          this.settings.maximumSteps,
          this.number(
            challenge.step,
            1
          )
        )
      );

    const status =
      String(
        challenge.status ||
        "pending"
      ).toLowerCase();

    const stepClass =
      number => {
        if (
          status === "won" &&
          step ===
            this.settings.maximumSteps
        ) {
          return number <= step
            ? "complete"
            : "";
        }

        if (number < step) {
          return "complete";
        }

        if (number === step) {
          return "active";
        }

        return "locked";
      };

    const winClass =
      status === "won" &&
      step ===
        this.settings.maximumSteps
        ? "active"
        : "locked";

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
            These two random players are shared
            across every phone, laptop and browser.
            They remain locked for the entire day.
          </p>

        </header>

        <section class="ladder-progress-panel">

          <div class="ladder-progress-heading">

            <div>

              <span>
                LADDER STEP ${step}
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

          <div class="ladder-progress-track">

            <div
              class="ladder-progress-line"
            ></div>

            <div
              class="
                ladder-progress-node
                ${stepClass(1)}
              "
            >
              <strong>
                1
              </strong>

              <span>
                Step 1
              </span>
            </div>

            <div
              class="
                ladder-progress-node
                ${stepClass(2)}
              "
            >
              <strong>
                2
              </strong>

              <span>
                Step 2
              </span>
            </div>

            <div
              class="
                ladder-progress-node
                ${stepClass(3)}
              "
            >
              <strong>
                3
              </strong>

              <span>
                Step 3
              </span>
            </div>

            <div
              class="
                ladder-progress-node
                ladder-win-node
                ${winClass}
              "
            >
              <strong>
                ♛
              </strong>

              <span>
                Win
              </span>
            </div>

          </div>

          <div class="ladder-waiting-panel">

            <strong>
              ${this.getStatusLabel(
                status
              )}
            </strong>

            <p>
              Both shared players must record at least
              one hit for this Ladder step to win.
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
              players. GitHub creates two new shared
              random selections when the Eastern date
              changes.
            </p>

          </div>

        </div>

      </div>
    `;
  },

  /*
  =======================================================
  LOADING, EMPTY AND ERROR DISPLAYS
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
        /*
        ladder.json is the official source of truth.
        */

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

        /*
        Only use a previously downloaded copy for the
        same date when the network file is unavailable.
        */

        sharedChallenge =
          this.loadSharedCache(
            this.getDate()
          );

        if (!sharedChallenge) {
          throw fetchError;
        }

        console.log(
          "📦 POPS loaded today's previously downloaded shared Ladder."
        );
      }

      /*
      Refresh display information without replacing either
      shared player.
      */

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
        "✅ POPS Shared Ladder Challenge loaded:",
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

/*
Makes the shared Ladder module available to app.js.
*/

window.Ladder =
  Ladder;