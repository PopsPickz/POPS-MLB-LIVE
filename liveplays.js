/*
=========================================================
POPS PICKZ LIVE PLAYS
File: liveplays.js
Version: 3.0
=========================================================

TRACKS ONLY:

- Top 20 players displayed in POPS HR Pickz
- Top 20 players displayed in POPS Hit Pickz

LAYOUT:

- Hit results in the LEFT column
- Home run results in the RIGHT column

DUPLICATE CONTROL:

Each player appears only once per column.

If a player records multiple hits or home runs,
their total is increased inside the same card.

REFRESH RATE:

MLB live feeds refresh every 45 seconds.

IMPORTANT:

This file must load after app.js because it uses:

- window.games
- window.hrPicks
- window.hitPicks
=========================================================
*/

const LivePlays = {
  box: null,

  settings: {
    refreshInterval: 45 * 1000,
    maximumHRPicks: 20,
    maximumHitPicks: 20
  },

  timer: null,
  loading: false,
  lastUpdated: null,

  /*
  One entry per player.

  Example:

  hrResults:
  {
    "aaron judge": {
      player: "Aaron Judge",
      homeRuns: 2
    }
  }
  */

  hrResults: {},
  hitResults: {},

  /*
  Prevents the same MLB play from being counted twice.
  */

  processedPlayIds: new Set(),

  /*
  =======================================================
  BASIC HELPERS
  =======================================================
  */

  normalizeName(name = "") {
    return String(name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\./g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  },

  escapeHTML(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  number(value, fallback = 0) {
    const result = Number(value);

    return Number.isFinite(result)
      ? result
      : fallback;
  },

  formatTime(value) {
    if (!value) {
      return "Time TBD";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Time TBD";
    }

    return date.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  },

  formatUpdatedTime() {
    if (!this.lastUpdated) {
      return "Waiting for refresh";
    }

    return this.lastUpdated.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });
  },

  getInitials(name = "") {
    const words = String(name)
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
      words[words.length - 1].charAt(0)
    ).toUpperCase();
  },

  /*
  =======================================================
  SITE DATA
  =======================================================
  */

  getGames() {
    if (
      Array.isArray(window.games) &&
      window.games.length
    ) {
      return window.games;
    }

    if (
      Array.isArray(window.todayData?.games) &&
      window.todayData.games.length
    ) {
      return window.todayData.games;
    }

    return [];
  },

  getHRPicks() {
    if (!Array.isArray(window.hrPicks)) {
      return [];
    }

    return window.hrPicks.slice(
      0,
      this.settings.maximumHRPicks
    );
  },

  getHitPicks() {
    if (!Array.isArray(window.hitPicks)) {
      return [];
    }

    return window.hitPicks.slice(
      0,
      this.settings.maximumHitPicks
    );
  },

  findHRPick(playerName = "") {
    const normalizedPlayer =
      this.normalizeName(playerName);

    return this.getHRPicks().find(pick => {
      const pickName =
        pick?.player ||
        pick?.name ||
        "";

      return (
        this.normalizeName(pickName) ===
        normalizedPlayer
      );
    });
  },

  findHitPick(playerName = "") {
    const normalizedPlayer =
      this.normalizeName(playerName);

    return this.getHitPicks().find(pick => {
      const pickName =
        pick?.player ||
        pick?.name ||
        "";

      return (
        this.normalizeName(pickName) ===
        normalizedPlayer
      );
    });
  },

  getPickRank(pick, type) {
    const picks =
      type === "homeRun"
        ? this.getHRPicks()
        : this.getHitPicks();

    const index = picks.findIndex(item => {
      const itemName =
        item?.player ||
        item?.name ||
        "";

      const pickName =
        pick?.player ||
        pick?.name ||
        "";

      return (
        this.normalizeName(itemName) ===
        this.normalizeName(pickName)
      );
    });

    return index >= 0
      ? index + 1
      : 0;
  },

  /*
  =======================================================
  GAME HELPERS
  =======================================================
  */

  getGamePk(game = {}) {
    return this.number(
      game.gamePk ||
      game.id ||
      0
    );
  },

  getAwayTeam(game = {}) {
    if (
      typeof game.awayTeam === "string"
    ) {
      return game.awayTeam;
    }

    return (
      game.awayTeam?.name ||
      game.teams?.away?.team?.name ||
      "Away Team"
    );
  },

  getHomeTeam(game = {}) {
    if (
      typeof game.homeTeam === "string"
    ) {
      return game.homeTeam;
    }

    return (
      game.homeTeam?.name ||
      game.teams?.home?.team?.name ||
      "Home Team"
    );
  },

  getMatchup(game = {}) {
    return (
      `${this.getAwayTeam(game)} vs ` +
      `${this.getHomeTeam(game)}`
    );
  },

  getGameStatus(game = {}) {
    const status =
      game.status ||
      game.statusObject ||
      {};

    return String(
      status.abstractGameState ||
      status.detailedState ||
      status.statusCode ||
      ""
    ).toLowerCase();
  },

  isGameLiveOrFinal(game = {}) {
    const status =
      this.getGameStatus(game);

    return (
      status.includes("live") ||
      status.includes("progress") ||
      status.includes("final") ||
      status.includes("completed") ||
      status.includes("game over")
    );
  },

  /*
  =======================================================
  MLB LIVE FEED
  =======================================================
  */

  async getLiveFeed(gamePk) {
    if (!gamePk) {
      return null;
    }

    if (
      typeof API !== "undefined" &&
      typeof API.getLiveGame === "function"
    ) {
      try {
        return await API.getLiveGame(
          gamePk,
          true
        );
      } catch (error) {
        console.warn(
          `POPS Live Plays API fallback for ${gamePk}:`,
          error
        );
      }
    }

    const response = await fetch(
      `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live?_=${Date.now()}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Live feed returned HTTP ${response.status}`
      );
    }

    return response.json();
  },

  /*
  =======================================================
  PLAY HELPERS
  =======================================================
  */

  getAllPlays(feed = {}) {
    const plays =
      feed?.liveData?.plays?.allPlays;

    return Array.isArray(plays)
      ? plays
      : [];
  },

  getPlayId(play = {}, gamePk = 0) {
    return [
      gamePk,
      play?.atBatIndex ?? "",
      play?.about?.inning ?? "",
      play?.about?.halfInning ?? "",
      play?.result?.eventType ?? "",
      play?.matchup?.batter?.id ?? ""
    ].join("-");
  },

  getPlayerName(play = {}) {
    return (
      play?.matchup?.batter?.fullName ||
      play?.matchup?.batter?.name ||
      ""
    );
  },

  getEventType(play = {}) {
    return String(
      play?.result?.eventType ||
      play?.result?.event ||
      ""
    )
      .toLowerCase()
      .trim();
  },

  isHomeRun(play = {}) {
    const type =
      this.getEventType(play);

    return (
      type === "home_run" ||
      type === "home run" ||
      type.includes("home_run")
    );
  },

  isHit(play = {}) {
    const type =
      this.getEventType(play);

    return [
      "single",
      "double",
      "triple",
      "home_run"
    ].includes(type);
  },

  getHitType(play = {}) {
    const type =
      this.getEventType(play);

    if (type === "double") {
      return "double";
    }

    if (type === "triple") {
      return "triple";
    }

    if (type === "home_run") {
      return "homeRun";
    }

    return "single";
  },

  getInningText(play = {}) {
    const inning =
      this.number(
        play?.about?.inning,
        0
      );

    const half =
      String(
        play?.about?.halfInning ||
        ""
      ).toLowerCase();

    if (!inning) {
      return "Inning unavailable";
    }

    const halfText =
      half === "top"
        ? "Top"
        : half === "bottom"
          ? "Bottom"
          : "";

    return `${halfText} ${inning}`.trim();
  },

  getDescription(play = {}) {
    return (
      play?.result?.description ||
      play?.result?.event ||
      "Live result detected"
    );
  },

  getHitData(play = {}) {
    const hitData =
      play?.playEvents
        ?.map(event => event?.hitData)
        .find(Boolean) ||
      {};

    return {
      exitVelocity:
        this.number(
          hitData.launchSpeed,
          0
        ),

      distance:
        this.number(
          hitData.totalDistance,
          0
        ),

      launchAngle:
        this.number(
          hitData.launchAngle,
          0
        )
    };
  },

  /*
  =======================================================
  UNIQUE PLAYER RESULTS
  =======================================================
  */

  addHomeRunResult(
    play,
    game,
    pick
  ) {
    const player =
      this.getPlayerName(play);

    const key =
      this.normalizeName(player);

    if (!key) {
      return;
    }

    const hitData =
      this.getHitData(play);

    if (!this.hrResults[key]) {
      this.hrResults[key] = {
        type: "homeRun",

        player,
        initials:
          this.getInitials(player),

        team:
          pick?.team ||
          "Team N/A",

        game:
          this.getMatchup(game),

        gameTime:
          game.date ||
          game.gameDate ||
          "",

        rank:
          this.getPickRank(
            pick,
            "homeRun"
          ),

        score:
          this.number(
            pick?.score,
            0
          ),

        homeRuns: 0,

        maxExitVelocity: 0,
        longestDistance: 0,
        latestLaunchAngle: 0,

        latestInning: "",
        latestDescription: "",
        updatedAt: Date.now()
      };
    }

    const result =
      this.hrResults[key];

    result.homeRuns += 1;

    result.maxExitVelocity =
      Math.max(
        result.maxExitVelocity,
        hitData.exitVelocity
      );

    result.longestDistance =
      Math.max(
        result.longestDistance,
        hitData.distance
      );

    if (hitData.launchAngle !== 0) {
      result.latestLaunchAngle =
        hitData.launchAngle;
    }

    result.latestInning =
      this.getInningText(play);

    result.latestDescription =
      this.getDescription(play);

    result.updatedAt =
      Date.now();
  },

  addHitResult(
    play,
    game,
    pick
  ) {
    const player =
      this.getPlayerName(play);

    const key =
      this.normalizeName(player);

    if (!key) {
      return;
    }

    if (!this.hitResults[key]) {
      this.hitResults[key] = {
        type: "hit",

        player,
        initials:
          this.getInitials(player),

        team:
          pick?.team ||
          "Team N/A",

        game:
          this.getMatchup(game),

        gameTime:
          game.date ||
          game.gameDate ||
          "",

        rank:
          this.getPickRank(
            pick,
            "hit"
          ),

        score:
          this.number(
            pick?.score,
            0
          ),

        hits: 0,
        singles: 0,
        doubles: 0,
        triples: 0,
        homeRuns: 0,

        latestInning: "",
        latestDescription: "",
        updatedAt: Date.now()
      };
    }

    const result =
      this.hitResults[key];

    const hitType =
      this.getHitType(play);

    result.hits += 1;

    if (hitType === "double") {
      result.doubles += 1;
    } else if (
      hitType === "triple"
    ) {
      result.triples += 1;
    } else if (
      hitType === "homeRun"
    ) {
      result.homeRuns += 1;
    } else {
      result.singles += 1;
    }

    result.latestInning =
      this.getInningText(play);

    result.latestDescription =
      this.getDescription(play);

    result.updatedAt =
      Date.now();
  },

  /*
  =======================================================
  PROCESS GAME
  =======================================================
  */

  async processGame(game = {}) {
    const gamePk =
      this.getGamePk(game);

    if (!gamePk) {
      return;
    }

    const feed =
      await this.getLiveFeed(gamePk);

    if (!feed) {
      return;
    }

    const plays =
      this.getAllPlays(feed);

    for (const play of plays) {
      const playId =
        this.getPlayId(
          play,
          gamePk
        );

      if (
        this.processedPlayIds.has(
          playId
        )
      ) {
        continue;
      }

      const playerName =
        this.getPlayerName(play);

      if (!playerName) {
        continue;
      }

      let matched = false;

      /*
      HR column:

      Only count the home run when the player
      is currently inside the displayed Top 20 HR Pickz.
      */

      if (this.isHomeRun(play)) {
        const hrPick =
          this.findHRPick(
            playerName
          );

        if (hrPick) {
          this.addHomeRunResult(
            play,
            game,
            hrPick
          );

          matched = true;
        }
      }

      /*
      Hit column:

      Singles, doubles, triples and home runs count as hits,
      but only when the player is inside the displayed
      Top 20 Hit Pickz.
      */

      if (this.isHit(play)) {
        const hitPick =
          this.findHitPick(
            playerName
          );

        if (hitPick) {
          this.addHitResult(
            play,
            game,
            hitPick
          );

          matched = true;
        }
      }

      /*
      Only mark matched plays as processed.

      A player can appear in both lists, so the same play
      may correctly update both columns.
      */

      if (matched) {
        this.processedPlayIds.add(
          playId
        );
      }
    }
  },

  /*
  =======================================================
  SUMMARY COUNTS
  =======================================================
  */

  getHRResultsArray() {
    return Object
      .values(this.hrResults)
      .sort(
        (a, b) =>
          b.homeRuns - a.homeRuns ||
          a.rank - b.rank
      );
  },

  getHitResultsArray() {
    return Object
      .values(this.hitResults)
      .sort(
        (a, b) =>
          b.hits - a.hits ||
          a.rank - b.rank
      );
  },

  getTotalHomeRuns() {
    return this
      .getHRResultsArray()
      .reduce(
        (total, result) =>
          total + result.homeRuns,
        0
      );
  },

  getTotalHits() {
    return this
      .getHitResultsArray()
      .reduce(
        (total, result) =>
          total + result.hits,
        0
      );
  },

  /*
  =======================================================
  PLAYER CARDS
  =======================================================
  */

  renderHitCard(
    result = {},
    index = 0
  ) {
    return `
      <article class="live-result-card live-hit-card">

        <div class="live-result-card-top">

          <span class="live-result-rank live-hit-rank">
            #${result.rank || index + 1}
          </span>

          <div class="live-player-avatar live-hit-avatar">
            ${this.escapeHTML(
              result.initials
            )}
          </div>

          <div class="live-player-main">
            <h4>
              ${this.escapeHTML(
                result.player
              )}
            </h4>

            <p>
              ${this.escapeHTML(
                result.team
              )}
            </p>
          </div>

          <div class="live-result-total live-hit-total">
            <strong>
              ${result.hits}
            </strong>

            <span>
              ${
                result.hits === 1
                  ? "HIT"
                  : "HITS"
              }
            </span>
          </div>

        </div>

        <div class="live-hit-breakdown">

          <div>
            <strong>
              ${result.singles}
            </strong>
            <span>Singles</span>
          </div>

          <div>
            <strong>
              ${result.doubles}
            </strong>
            <span>Doubles</span>
          </div>

          <div>
            <strong>
              ${result.triples}
            </strong>
            <span>Triples</span>
          </div>

          <div>
            <strong>
              ${result.homeRuns}
            </strong>
            <span>HR</span>
          </div>

        </div>

        <p class="live-result-description">
          ${this.escapeHTML(
            result.latestDescription
          )}
        </p>

        <div class="live-result-footer">

          <div>
            <span>Latest</span>

            <strong>
              ${this.escapeHTML(
                result.latestInning
              )}
            </strong>
          </div>

          <div>
            <span>Game</span>

            <strong>
              ${this.escapeHTML(
                result.game
              )}
            </strong>
          </div>

          <div>
            <span>POPS Score</span>

            <strong class="live-score-green">
              ${Math.round(
                result.score
              )}/100
            </strong>
          </div>

        </div>

      </article>
    `;
  },

  renderHRCard(
    result = {},
    index = 0
  ) {
    return `
      <article class="live-result-card live-hr-card">

        <div class="live-result-card-top">

          <span class="live-result-rank live-hr-rank">
            #${result.rank || index + 1}
          </span>

          <div class="live-player-avatar live-hr-avatar">
            ${this.escapeHTML(
              result.initials
            )}
          </div>

          <div class="live-player-main">
            <h4>
              ${this.escapeHTML(
                result.player
              )}
            </h4>

            <p>
              ${this.escapeHTML(
                result.team
              )}
            </p>
          </div>

          <div class="live-result-total live-hr-total">
            <strong>
              ${result.homeRuns}
            </strong>

            <span>
              ${
                result.homeRuns === 1
                  ? "HR"
                  : "HRS"
              }
            </span>
          </div>

        </div>

        <div class="live-hr-breakdown">

          <div>
            <strong>
              ${
                result.maxExitVelocity > 0
                  ? result.maxExitVelocity.toFixed(1)
                  : "N/A"
              }
            </strong>
            <span>Exit Velo</span>
          </div>

          <div>
            <strong>
              ${
                result.longestDistance > 0
                  ? `${Math.round(
                      result.longestDistance
                    )}`
                  : "N/A"
              }
            </strong>
            <span>Distance</span>
          </div>

          <div>
            <strong>
              ${
                result.latestLaunchAngle !== 0
                  ? `${Math.round(
                      result.latestLaunchAngle
                    )}°`
                  : "N/A"
              }
            </strong>
            <span>Launch Angle</span>
          </div>

        </div>

        <p class="live-result-description">
          ${this.escapeHTML(
            result.latestDescription
          )}
        </p>

        <div class="live-result-footer">

          <div>
            <span>Latest</span>

            <strong>
              ${this.escapeHTML(
                result.latestInning
              )}
            </strong>
          </div>

          <div>
            <span>Game</span>

            <strong>
              ${this.escapeHTML(
                result.game
              )}
            </strong>
          </div>

          <div>
            <span>POPS Score</span>

            <strong class="live-score-green">
              ${Math.round(
                result.score
              )}/100
            </strong>
          </div>

        </div>

      </article>
    `;
  },

  renderEmptyColumn(
    type = "hit"
  ) {
    const isHR =
      type === "homeRun";

    return `
      <div class="live-column-empty">

        <div class="live-column-empty-icon">
          ${isHR ? "💣" : "🔥"}
        </div>

        <h4>
          No ${
            isHR
              ? "HR Pickz"
              : "Hit Pickz"
          } results yet
        </h4>

        <p>
          POPS is monitoring today's displayed Top 20
          ${
            isHR
              ? "Home Run Pickz"
              : "Hit Pickz"
          }.
        </p>

      </div>
    `;
  },

  /*
  =======================================================
  RENDER DASHBOARD
  =======================================================
  */

  render() {
    if (!this.box) {
      this.box =
        document.getElementById(
          "livePlaysBox"
        );
    }

    if (!this.box) {
      return;
    }

    const hitResults =
      this.getHitResultsArray();

    const hrResults =
      this.getHRResultsArray();

    const totalHits =
      this.getTotalHits();

    const totalHomeRuns =
      this.getTotalHomeRuns();

    const totalUniqueResults =
      hitResults.length +
      hrResults.length;

    const hrSuccess =
      Math.round(
        (
          hrResults.length /
          Math.max(
            1,
            this.getHRPicks().length
          )
        ) * 100
      );

    const hitSuccess =
      Math.round(
        (
          hitResults.length /
          Math.max(
            1,
            this.getHitPicks().length
          )
        ) * 100
      );

    this.box.innerHTML = `
      <div class="live-dashboard">

        <div class="live-dashboard-header">

          <div>
            <h2>
              <span class="live-red-dot"></span>
              POPS <span>Live Plays</span>
            </h2>

            <p>
              Automatically tracks hits and home runs by
              players listed in today's displayed POPS Pickz.
            </p>
          </div>

          <div class="live-monitor-status">

            <div class="live-monitor-title">
              <span class="live-green-dot"></span>

              <strong>
                Live monitor active
              </strong>
            </div>

            <small>
              MLB feeds refresh every 45 seconds
            </small>

            <span class="live-last-update">
              Last updated:
              ${this.escapeHTML(
                this.formatUpdatedTime()
              )}
            </span>

          </div>

        </div>

        <div class="live-summary-grid">

          <div class="live-summary-item">
            <span>Total Results</span>
            <strong>${totalUniqueResults}</strong>
            <small>Unique players</small>
          </div>

          <div class="live-summary-item">
            <span>HR Pickz Results</span>
            <strong class="live-red-number">
              ${totalHomeRuns}
            </strong>
            <small>Home runs</small>
          </div>

          <div class="live-summary-item">
            <span>Hit Pickz Results</span>
            <strong class="live-orange-number">
              ${totalHits}
            </strong>
            <small>All hits</small>
          </div>

          <div class="live-summary-item">
            <span>HR Success</span>
            <strong class="live-red-number">
              ${hrSuccess}%
            </strong>
            <small>
              ${hrResults.length} of
              ${this.getHRPicks().length}
            </small>
          </div>

          <div class="live-summary-item">
            <span>Hit Success</span>
            <strong class="live-orange-number">
              ${hitSuccess}%
            </strong>
            <small>
              ${hitResults.length} of
              ${this.getHitPicks().length}
            </small>
          </div>

        </div>

        <div class="live-watching-row">
          <span>
            💣 Watching
            ${this.getHRPicks().length}
            Top HR Pickz
          </span>

          <span class="live-watching-divider">
            •
          </span>

          <span>
            🔥 Watching
            ${this.getHitPicks().length}
            Top Hit Pickz
          </span>
        </div>

        <div class="live-result-columns">

          <!-- LEFT COLUMN: HIT RESULTS -->

          <section class="live-results-column live-hits-column">

            <div class="live-column-header">

              <div>
                <span class="live-column-kicker">
                  🔥 HIT RESULTS
                </span>

                <h3>
                  Hit Pickz Hits
                </h3>

                <p>
                  Singles, doubles, triples and home runs
                  by players in the Top 20 POPS Hit Pickz.
                </p>
              </div>

              <div class="live-column-count live-hit-count">
                <strong>${totalHits}</strong>
                <span>Total Hits</span>
              </div>

            </div>

            <div class="live-results-list">

              ${
                hitResults.length
                  ? hitResults
                      .map(
                        (result, index) =>
                          this.renderHitCard(
                            result,
                            index
                          )
                      )
                      .join("")
                  : this.renderEmptyColumn(
                      "hit"
                    )
              }

            </div>

          </section>

          <!-- RIGHT COLUMN: HOME RUN RESULTS -->

          <section class="live-results-column live-hrs-column">

            <div class="live-column-header">

              <div>
                <span class="live-column-kicker">
                  💣 HOME RUN RESULTS
                </span>

                <h3>
                  HR Pickz Hits
                </h3>

                <p>
                  Home runs by players in the Top 20
                  POPS Home Run Pickz.
                </p>
              </div>

              <div class="live-column-count live-hr-count">
                <strong>${totalHomeRuns}</strong>
                <span>Total HRs</span>
              </div>

            </div>

            <div class="live-results-list">

              ${
                hrResults.length
                  ? hrResults
                      .map(
                        (result, index) =>
                          this.renderHRCard(
                            result,
                            index
                          )
                      )
                      .join("")
                  : this.renderEmptyColumn(
                      "homeRun"
                    )
              }

            </div>

          </section>

        </div>

        <p class="live-dashboard-note">
          ⓘ Only results from players in today's displayed
          Top 20 HR Pickz and Top 20 Hit Pickz are shown.
          Each player appears once per column.
        </p>

      </div>
    `;
  },

  /*
  =======================================================
  REFRESH
  =======================================================
  */

  async refresh() {
    if (this.loading) {
      return;
    }

    this.loading = true;

    try {
      const games =
        this.getGames();

      if (!games.length) {
        this.render();
        return;
      }

      await Promise.all(
        games.map(game =>
          this.processGame(game)
            .catch(error => {
              console.warn(
                "POPS Live Plays game error:",
                error
              );
            })
        )
      );

      this.lastUpdated =
        new Date();

      this.render();
    } finally {
      this.loading = false;
    }
  },

  /*
  =======================================================
  START AND STOP
  =======================================================
  */

  start() {
    this.box =
      document.getElementById(
        "livePlaysBox"
      );

    if (!this.box) {
      console.warn(
        "POPS Live Plays: #livePlaysBox was not found."
      );

      return;
    }

    this.render();

    this.refresh().catch(error => {
      console.warn(
        "Initial POPS Live Plays refresh failed:",
        error
      );
    });

    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer =
      setInterval(() => {
        this.refresh().catch(error => {
          console.warn(
            "POPS Live Plays refresh failed:",
            error
          );
        });
      }, this.settings.refreshInterval);

    console.log(
      "🔴 POPS Live Plays 3.0 active."
    );
  },

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
};

/*
=========================================================
GLOBAL ACCESS
=========================================================
*/

window.LivePlays = LivePlays;

window.openLivePlaysTab =
  async function(button) {
    if (
      typeof showTab === "function"
    ) {
      showTab(
        "liveplays",
        button
      );
    }

    LivePlays.render();

    await LivePlays.refresh();
  };

/*
app.js may still be loading after DOMContentLoaded.

Wait four seconds before starting the live monitor.
*/

document.addEventListener(
  "DOMContentLoaded",
  () => {
    setTimeout(() => {
      LivePlays.start();
    }, 4000);
  }
);