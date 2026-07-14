/*
=========================================================
POPS LADDER CHALLENGE
File: ladder.js
Version: 1.0
=========================================================

Uses the final locked POPS Hit Pickz list from app.js.

Each ladder contains two players. Both players must record
at least one hit for the ladder step to win.
=========================================================
*/

const Ladder = {
  box: null,

  settings: {
    picksPerStep: 2,
    maximumSteps: 5,
    storagePrefix: "pops-ladder"
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

      return parsed &&
        Array.isArray(parsed.picks)
        ? parsed
        : null;
    } catch (error) {
      console.warn(
        "POPS Ladder could not load saved challenge:",
        error
      );

      return null;
    }
  },

  saveChallenge(challenge) {
    try {
      localStorage.setItem(
        this.getStorageKey(),
        JSON.stringify(challenge)
      );
    } catch (error) {
      console.warn(
        "POPS Ladder could not save challenge:",
        error
      );
    }
  },

  /*
  =======================================================
  HELPERS
  =======================================================
  */

  normalizeName(value = "") {
    return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  },

  getPickKey(pick = {}) {
    const playerId =
      Number(
        pick.id ||
        pick.playerId ||
        0
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

  escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  findBox() {
    /*
    This checks several possible IDs so the module still
    works if your HTML uses a slightly different name.
    */

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

  removeDuplicates(picks = []) {
    const unique = [];
    const usedKeys = new Set();

    for (const pick of picks) {
      if (!pick) continue;

      const key =
        this.getPickKey(pick);

      if (!key || usedKeys.has(key)) {
        continue;
      }

      usedKeys.add(key);
      unique.push(pick);
    }

    return unique;
  },

  /*
  =======================================================
  CHOOSE TODAY'S TWO PICKS
  =======================================================
  */

  buildChallenge(hitPicks = []) {
    const eligiblePicks =
      this.removeDuplicates(
        hitPicks
      ).filter(pick => {
        return (
          pick &&
          pick.player &&
          Number(pick.hitStreak || 0) >= 2 &&
          Number(
            pick.bvpStats?.hits || 0
          ) >= 1
        );
      });

    if (
      eligiblePicks.length <
      this.settings.picksPerStep
    ) {
      return null;
    }

    /*
    hitPicks is already ranked inside app.js, so the first
    two eligible players become the automatic ladder picks.
    */

    const selectedPicks =
      eligiblePicks
        .slice(
          0,
          this.settings.picksPerStep
        )
        .map(pick => ({
          id:
            Number(
              pick.id ||
              pick.playerId ||
              0
            ),

          player:
            pick.player,

          team:
            pick.team,

          game:
            pick.game,

          gamePk:
            Number(
              pick.gamePk || 0
            ),

          gameTime:
            pick.gameTime,

          pitcher:
            pick.pitcher,

          lineupSpot:
            Number(
              pick.lineupSpot || 0
            ),

          confirmed:
            Boolean(
              pick.confirmed
            ),

          hitStreak:
            Number(
              pick.hitStreak || 0
            ),

          bvpHits:
            Number(
              pick.bvpStats?.hits || 0
            ),

          bvpAtBats:
            Number(
              pick.bvpStats?.atBats || 0
            ),

          bvpAverage:
            pick.bvpStats?.avg ||
            ".000",

          score:
            Number(
              pick.score || 0
            ),

          result: "pending",
          hitsToday: 0
        }));

    return {
      date:
        this.getDate(),

      step: 1,

      status: "pending",

      createdAt:
        new Date().toISOString(),

      picks:
        selectedPicks
    };
  },

  mergeCurrentData(
    savedChallenge,
    currentHitPicks = []
  ) {
    const currentMap =
      new Map();

    for (const pick of currentHitPicks) {
      currentMap.set(
        this.getPickKey(pick),
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

            return {
              ...savedPick,

              player:
                currentPick.player ||
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
                  currentPick.hitStreak ||
                  savedPick.hitStreak ||
                  0
                ),

              bvpHits:
                Number(
                  currentPick.bvpStats
                    ?.hits ||
                  savedPick.bvpHits ||
                  0
                ),

              bvpAtBats:
                Number(
                  currentPick.bvpStats
                    ?.atBats ||
                  savedPick.bvpAtBats ||
                  0
                ),

              bvpAverage:
                currentPick.bvpStats
                  ?.avg ||
                savedPick.bvpAverage ||
                ".000",

              score:
                Number(
                  currentPick.score ||
                  savedPick.score ||
                  0
                )
            };
          }
        )
    };
  },

  /*
  =======================================================
  DISPLAY
  =======================================================
  */

  getStatusLabel(status = "pending") {
    if (status === "won") {
      return "✅ Ladder Step Won";
    }

    if (status === "lost") {
      return "❌ Ladder Step Lost";
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

  renderPick(pick, index) {
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

    return `
      <article class="ladder-pick-card">

        <div class="ladder-pick-number">
          PICK ${index + 1}
        </div>

        <h3>
          🔥 ${player}
        </h3>

        <p>
          <strong>Team:</strong>
          ${team}
        </p>

        <p>
          <strong>Game:</strong>
          ${game}
        </p>

        <p>
          <strong>Date/Time:</strong>
          ${gameTime}
        </p>

        <p>
          <strong>Vs Pitcher:</strong>
          ${pitcher}
        </p>

        <div class="ladder-pick-stats">

          <div>
            <span>Hit Streak</span>
            <strong>
              ${Number(
                pick.hitStreak || 0
              )} games
            </strong>
          </div>

          <div>
            <span>BvP Hits</span>
            <strong>
              ${Number(
                pick.bvpHits || 0
              )}/${
                Number(
                  pick.bvpAtBats || 0
                )
              }
            </strong>
          </div>

          <div>
            <span>Hit Score</span>
            <strong>
              ${Number(
                pick.score || 0
              )}/100
            </strong>
          </div>

        </div>

        <p class="ladder-lineup-status">
          ${
            pick.confirmed
              ? "✅ Confirmed lineup"
              : "🟡 Projected lineup"
          }
        </p>

        <div class="ladder-result-status">
          ${this.getPickResultLabel(
            pick.result
          )}
        </div>

      </article>
    `;
  },

  render(challenge) {
    if (!this.findBox()) {
      console.warn(
        "POPS Ladder could not find ladderBox."
      );

      return;
    }

    if (
      !challenge ||
      !Array.isArray(challenge.picks) ||
      challenge.picks.length <
        this.settings.picksPerStep
    ) {
      this.renderUnavailable();
      return;
    }

    const step =
      Number(challenge.step || 1);

    this.box.innerHTML = `
      <div class="ladder-header-row">

        <div>
          <span class="ladder-step-label">
            LADDER STEP ${step}
          </span>

          <h3>
            Two Picks Must Hit
          </h3>
        </div>

        <div class="ladder-status-badge">
          ${this.getStatusLabel(
            challenge.status
          )}
        </div>

      </div>

      <p class="ladder-instructions">
        Both automatic POPS Hit Pickz must record
        at least one hit for this ladder step to win.
      </p>

      <div class="ladder-picks-grid">
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

      <div class="ladder-rule-box">
        <strong>🪜 Advancement Rule</strong>

        <p>
          2 out of 2 players must record a hit.
          One miss ends the current ladder step.
        </p>
      </div>
    `;
  },

  renderLoading() {
    if (!this.findBox()) return;

    this.box.innerHTML = `
      <p>
        Loading today's Ladder Challenge...
      </p>
    `;
  },

  renderUnavailable() {
    if (!this.findBox()) return;

    this.box.innerHTML = `
      <div class="pick-card ladder-empty-card">
        <h3>
          🪜 Ladder Picks Not Available
        </h3>

        <p>
          The Ladder needs at least two eligible
          POPS Hit Pickz.
        </p>

        <p>
          Each player must currently have:
        </p>

        <p>
          ✅ A hit streak of at least two games
          <br />
          ✅ At least one previous hit against
          today's pitcher
        </p>
      </div>
    `;
  },

  renderError(error) {
    if (!this.findBox()) return;

    this.box.innerHTML = `
      <div class="pick-card ladder-error-card">
        <h3>
          ⚠️ Ladder Could Not Load
        </h3>

        <p>
          ${
            this.escapeHtml(
              error?.message ||
              "An unknown Ladder error occurred."
            )
          }
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
        Array.isArray(currentHitPicks)
          ? currentHitPicks
          : [];

      let challenge =
        this.loadSavedChallenge();

      if (!challenge) {
        challenge =
          this.buildChallenge(picks);

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

      this.render(challenge);

      console.log(
        "✅ POPS Ladder Challenge loaded:",
        challenge
      );
    } catch (error) {
      console.error(
        "POPS Ladder error:",
        error
      );

      this.renderError(error);
    }
  }
};

window.Ladder = Ladder;
