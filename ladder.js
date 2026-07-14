/*
=========================================================
POPS LADDER CHALLENGE
File: ladder.js
Version: 2.0
=========================================================

Uses the final locked POPS Hitz Pickz list from app.js.

Each Ladder step contains two players.

Both players must record at least one hit for the
current Ladder step to win.

PLAYER ELIGIBILITY

With previous pitcher history:
- Hit streak of 2 or more games
- At least 1 previous hit against today's pitcher

Without previous pitcher history:
- Hit streak of 4 or more games
=========================================================
*/

const Ladder = {
  box: null,

  settings: {
    picksPerStep: 2,
    maximumSteps: 3,

    /*
    The v2 storage name forces the redesigned Ladder
    to create a fresh challenge.
    */

    storagePrefix:
      "pops-ladder-v2"
  },

  /*
  =======================================================
  DATE AND STORAGE
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

  getStorageKey() {
    return (
      `${this.settings.storagePrefix}-` +
      this.getDate()
    );
  },

  loadSavedChallenge() {
    try {
      const saved =
        localStorage.getItem(
          this.getStorageKey()
        );

      if (!saved) {
        return null;
      }

      const parsed =
        JSON.parse(saved);

      if (
        !parsed ||
        !Array.isArray(
          parsed.picks
        )
      ) {
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn(
        "POPS Ladder could not load saved challenge:",
        error
      );

      return null;
    }
  },

  saveChallenge(
    challenge
  ) {
    try {
      localStorage.setItem(
        this.getStorageKey(),
        JSON.stringify(
          challenge
        )
      );
    } catch (error) {
      console.warn(
        "POPS Ladder could not save challenge:",
        error
      );
    }
  },

  clearSavedChallenge() {
    try {
      localStorage.removeItem(
        this.getStorageKey()
      );
    } catch (error) {
      console.warn(
        "POPS Ladder could not clear saved challenge:",
        error
      );
    }
  },

  /*
  =======================================================
  GENERAL HELPERS
  =======================================================
  */

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
      Number(
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

  removeDuplicates(
    picks = []
  ) {
    const unique = [];
    const usedKeys =
      new Set();

    for (const pick of picks) {
      if (!pick) {
        continue;
      }

      const key =
        this.getPickKey(
          pick
        );

      if (
        !key ||
        usedKeys.has(key)
      ) {
        continue;
      }

      usedKeys.add(key);
      unique.push(pick);
    }

    return unique;
  },

  /*
  =======================================================
  BVP AND ELIGIBILITY HELPERS
  =======================================================
  */

  getBvpHits(
    pick = {}
  ) {
    return Number(
      pick.bvpStats?.hits ??
      pick.bvpHits ??
      0
    );
  },

  getBvpAtBats(
    pick = {}
  ) {
    return Number(
      pick.bvpStats?.atBats ??
      pick.bvpAtBats ??
      0
    );
  },

  getBvpPlateAppearances(
    pick = {}
  ) {
    return Number(
      pick.bvpStats
        ?.plateAppearances ??
      pick.bvpPlateAppearances ??
      0
    );
  },

  hasPitcherHistory(
    pick = {}
  ) {
    const atBats =
      this.getBvpAtBats(
        pick
      );

    const plateAppearances =
      this.getBvpPlateAppearances(
        pick
      );

    return (
      atBats > 0 ||
      plateAppearances > 0
    );
  },

  qualifiesForLadder(
    pick = {}
  ) {
    if (
      !pick ||
      !pick.player
    ) {
      return false;
    }

    const hitStreak =
      Number(
        pick.hitStreak || 0
      );

    const bvpHits =
      this.getBvpHits(
        pick
      );

    const hasHistory =
      this.hasPitcherHistory(
        pick
      );

    const qualifiesWithHistory =
      hasHistory &&
      hitStreak >= 2 &&
      bvpHits >= 1;

    const qualifiesWithoutHistory =
      !hasHistory &&
      hitStreak >= 4;

    return (
      qualifiesWithHistory ||
      qualifiesWithoutHistory
    );
  },

  getQualificationReason(
    pick = {}
  ) {
    const hasHistory =
      this.hasPitcherHistory(
        pick
      );

    if (hasHistory) {
      return (
        "2+ game streak with at least " +
        "1 previous hit vs pitcher"
      );
    }

    return (
      "4+ game streak with no previous " +
      "pitcher history"
    );
  },

  /*
  =======================================================
  BUILD TODAY'S CHALLENGE
  =======================================================
  */

  buildChallenge(
    hitPicks = []
  ) {
    const eligiblePicks =
      this.removeDuplicates(
        hitPicks
      ).filter(
        pick =>
          this.qualifiesForLadder(
            pick
          )
      );

    if (
      eligiblePicks.length <
      this.settings.picksPerStep
    ) {
      return null;
    }

    /*
    The Hitz list is already ranked by app.js.

    The first two eligible players become the
    automatic Ladder selections.
    */

    const selectedPicks =
      eligiblePicks
        .slice(
          0,
          this.settings.picksPerStep
        )
        .map(pick => {
          const bvpHits =
            this.getBvpHits(
              pick
            );

          const bvpAtBats =
            this.getBvpAtBats(
              pick
            );

          const bvpPlateAppearances =
            this.getBvpPlateAppearances(
              pick
            );

          const hasHistory =
            this.hasPitcherHistory(
              pick
            );

          return {
            id:
              Number(
                pick.id ||
                pick.playerId ||
                0
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
              Number(
                pick.gamePk ||
                pick.gameId ||
                0
              ),

            gameTime:
              pick.gameTime ||
              "Time TBD",

            pitcher:
              pick.pitcher ||
              "Pitcher TBD",

            lineupSpot:
              Number(
                pick.lineupSpot ||
                0
              ),

            confirmed:
              Boolean(
                pick.confirmed
              ),

            hitStreak:
              Number(
                pick.hitStreak ||
                0
              ),

            bvpHits,

            bvpAtBats,

            bvpPlateAppearances,

            bvpAverage:
              pick.bvpStats?.avg ||
              pick.bvpAverage ||
              ".000",

            hasPitcherHistory:
              hasHistory,

            qualificationReason:
              this.getQualificationReason(
                pick
              ),

            score:
              Number(
                pick.score || 0
              ),

            result:
              "pending",

            hitsToday:
              0
          };
        });

    return {
      date:
        this.getDate(),

      step:
        1,

      status:
        "pending",

      createdAt:
        new Date()
          .toISOString(),

      picks:
        selectedPicks
    };
  },

  /*
  =======================================================
  UPDATE SAVED PLAYERS WITH CURRENT DATA
  =======================================================
  */

  mergeCurrentData(
    savedChallenge,
    currentHitPicks = []
  ) {
    const currentMap =
      new Map();

    for (
      const pick of
      currentHitPicks
    ) {
      currentMap.set(
        this.getPickKey(
          pick
        ),
        pick
      );
    }

    return {
      ...savedChallenge,

      picks:
        savedChallenge.picks.map(
          savedPick => {
            const currentPick =
              currentMap.get(
                this.getPickKey(
                  savedPick
                )
              );

            if (!currentPick) {
              return savedPick;
            }

            const bvpHits =
              this.getBvpHits(
                currentPick
              );

            const bvpAtBats =
              this.getBvpAtBats(
                currentPick
              );

            const bvpPlateAppearances =
              this.getBvpPlateAppearances(
                currentPick
              );

            const hasHistory =
              this.hasPitcherHistory(
                currentPick
              );

            return {
              ...savedPick,

              player:
                currentPick.player ||
                currentPick.name ||
                savedPick.player,

              team:
                currentPick.team ||
                savedPick.team,

              game:
                currentPick.game ||
                savedPick.game,

              gamePk:
                Number(
                  currentPick.gamePk ||
                  savedPick.gamePk ||
                  0
                ),

              gameTime:
                currentPick.gameTime ||
                savedPick.gameTime,

              pitcher:
                currentPick.pitcher ||
                savedPick.pitcher,

              lineupSpot:
                Number(
                  currentPick.lineupSpot ||
                  savedPick.lineupSpot ||
                  0
                ),

              confirmed:
                Boolean(
                  currentPick.confirmed
                ),

              hitStreak:
                Number(
                  currentPick.hitStreak ??
                  savedPick.hitStreak ??
                  0
                ),

              bvpHits,

              bvpAtBats,

              bvpPlateAppearances,

              bvpAverage:
                currentPick.bvpStats
                  ?.avg ||
                currentPick.bvpAverage ||
                savedPick.bvpAverage ||
                ".000",

              hasPitcherHistory:
                hasHistory,

              qualificationReason:
                this.getQualificationReason(
                  currentPick
                ),

              score:
                Number(
                  currentPick.score ??
                  savedPick.score ??
                  0
                ),

              /*
              Keep the live result information already
              stored in the saved challenge.
              */

              result:
                savedPick.result ||
                "pending",

              hitsToday:
                Number(
                  savedPick.hitsToday ||
                  0
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
      return (
        "✅ Ladder Step Won"
      );
    }

    if (status === "lost") {
      return (
        "❌ Ladder Step Lost"
      );
    }

    return (
      "⏳ Waiting for Results"
    );
  },

  getPickResultLabel(
    result = "pending"
  ) {
    if (result === "hit") {
      return (
        "✅ Recorded a Hit"
      );
    }

    if (result === "miss") {
      return (
        "❌ No Hit"
      );
    }

    return (
      "⏳ Game Pending"
    );
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
        pick.gameTime ||
        "Time TBD"
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
      pick.hasPitcherHistory !==
      false;

    const historyDisplay =
      hasHistory
        ? `${Number(
            pick.bvpHits || 0
          )}/${Number(
            pick.bvpAtBats || 0
          )}`
        : "No history";

    const qualificationReason =
      this.escapeHtml(
        pick.qualificationReason ||
        this.getQualificationReason(
          pick
        )
      );

    return `
      <article class="ladder-player-card">

        <div class="ladder-player-topbar">

          <span class="ladder-pick-tag">
            PICK ${index + 1}
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
              ${Number(
                pick.hitStreak || 0
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
              ${Number(
                pick.score || 0
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

    if (
      !challenge ||
      !Array.isArray(
        challenge.picks
      ) ||
      challenge.picks.length <
        this.settings.picksPerStep
    ) {
      this.renderUnavailable();
      return;
    }

    const step =
      Math.max(
        1,
        Math.min(
          this.settings.maximumSteps,
          Number(
            challenge.step || 1
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
          return (
            number <= step
              ? "complete"
              : ""
          );
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
                POPS DAILY CHALLENGE
              </small>

              <h3>
                POPS Ladder Challenge
              </h3>

            </div>

          </div>

          <p>
            Two automatic POPS Hitz Pickz must
            each record at least one hit to advance.
          </p>

        </header>

        <section class="ladder-progress-panel">

          <div class="ladder-progress-heading">

            <div>

              <span>
                LADDER STEP ${step}
              </span>

              <h4>
                Two Picks Must Hit
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
              Both players must record at least
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
            🪜
          </span>

          <div>

            <strong>
              Advancement Rule
            </strong>

            <p>
              Both players must record a hit.
              One miss ends the current Ladder step.
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
          🪜
        </div>

        <h3>
          Loading Ladder Challenge
        </h3>

        <p>
          Selecting today's automatic
          POPS Hitz Pickz...
        </p>

      </div>
    `;
  },

  renderUnavailable() {
    if (!this.findBox()) {
      return;
    }

    this.box.innerHTML = `
      <div class="ladder-empty-v2">

        <div class="ladder-empty-icon">
          🪜
        </div>

        <h3>
          Ladder Picks Not Available
        </h3>

        <p>
          The Ladder needs at least two
          eligible POPS Hitz Pickz.
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
          Ladder Could Not Load
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
      const picks =
        Array.isArray(
          currentHitPicks
        )
          ? currentHitPicks
          : [];

      let challenge =
        this.loadSavedChallenge();

      if (!challenge) {
        challenge =
          this.buildChallenge(
            picks
          );

        if (!challenge) {
          this.renderUnavailable();
          return;
        }

        this.saveChallenge(
          challenge
        );
      } else {
        challenge =
          this.mergeCurrentData(
            challenge,
            picks
          );

        this.saveChallenge(
          challenge
        );
      }

      this.render(
        challenge
      );

      console.log(
        "✅ POPS Ladder Challenge loaded:",
        challenge
      );
    } catch (error) {
      console.error(
        "POPS Ladder error:",
        error
      );

      this.renderError(
        error
      );
    }
  }
};

/*
Makes the Ladder module available to app.js.
*/

window.Ladder =
  Ladder;