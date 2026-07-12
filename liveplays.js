/*
=========================================================
POPS PICKZ LIVE PLAYS
File: liveplays.js
Version: 2.0
Design: Modern Two-Column Card Layout
=========================================================

TRACKS ONLY:

- Home runs by players in the displayed Top 20 HR Pickz
- Singles, doubles and triples by players in the displayed
  Top 20 Hit Pickz

IMPORTANT:

- Players outside the displayed Top 20 are ignored.
- Home runs appear only in the HR Pickz column.
- Regular hits appear only in the Hit Pickz column.
- MLB live feeds refresh every 45 seconds.
- This file must load after app.js.
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
  started: false,

  detectedPlayIds: new Set(),

  hrEvents: [],
  hitEvents: [],

  /*
  =======================================================
  GENERAL HELPERS
  =======================================================
  */

  normalizeName(name = "") {
    return String(name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
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

  formatClockTime(timestamp) {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  },

  /*
  =======================================================
  POPS DATA
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

  /*
  Only use the displayed Top 20 HR players.
  */

  getHRPicks() {
    if (!Array.isArray(window.hrPicks)) {
      return [];
    }

    return window.hrPicks.slice(
      0,
      this.settings.maximumHRPicks
    );
  },

  /*
  Only use the displayed Top 20 Hit Pickz.
  */

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
    const targetName =
      this.normalizeName(playerName);

    if (!targetName) {
      return null;
    }

    return (
      this.getHRPicks().find(pick => {
        const pickName =
          pick?.player ||
          pick?.name ||
          "";

        return (
          this.normalizeName(pickName) ===
          targetName
        );
      }) || null
    );
  },

  findHitPick(playerName = "") {
    const targetName =
      this.normalizeName(playerName);

    if (!targetName) {
      return null;
    }

    return (
      this.getHitPicks().find(pick => {
        const pickName =
          pick?.player ||
          pick?.name ||
          "";

        return (
          this.normalizeName(pickName) ===
          targetName
        );
      }) || null
    );
  },

  getPickRank(pick, type = "hr") {
    const picks =
      type === "hr"
        ? this.getHRPicks()
        : this.getHitPicks();

    const index =
      picks.findIndex(item => item === pick);

    return index >= 0
      ? index + 1
      : 0;
  },

  /*
  =======================================================
  GAME STATUS
  =======================================================
  */

  getGameStatus(game = {}) {
    const status =
      game.status ||
      game.statusObject ||
      {};

    return String(
      status.abstractGameState ||
      status.detailedState ||
      status.statusCode ||
      status.codedGameState ||
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
      status.includes("game over") ||
      status === "i" ||
      status === "f"
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
      .replace(/\s+/g, "_");
  },

  isHomeRun(play = {}) {
    return (
      this.getEventType(play) ===
      "home_run"
    );
  },

  /*
  A home run is not added to the Hit Pickz column.

  Hit Pickz column contains:
  - Single
  - Double
  - Triple
  */

  isRegularHit(play = {}) {
    return [
      "single",
      "double",
      "triple"
    ].includes(
      this.getEventType(play)
    );
  },

  getHitLabel(play = {}) {
    const eventType =
      this.getEventType(play);

    const labels = {
      single: "Single",
      double: "Double",
      triple: "Triple",
      home_run: "Home Run"
    };

    return (
      labels[eventType] ||
      "Hit"
    );
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

    const halfLabel =
      half === "top"
        ? "Top"
        : half === "bottom"
          ? "Bottom"
          : "";

    return `${halfLabel} ${inning}`.trim();
  },

  getPlayDescription(play = {}) {
    return (
      play?.result?.description ||
      play?.result?.event ||
      "Live result detected."
    );
  },

  getHitData(play = {}) {
    const playEvents =
      Array.isArray(play?.playEvents)
        ? play.playEvents
        : [];

    const hitData =
      playEvents
        .map(event => event?.hitData)
        .find(Boolean) || {};

    return {
      exitVelocity:
        this.number(
          hitData.launchSpeed,
          0
        ),

      launchAngle:
        this.number(
          hitData.launchAngle,
          0
        ),

      distance:
        this.number(
          hitData.totalDistance,
          0
        )
    };
  },

  getGameMatchup(game = {}) {
    const awayTeam =
      typeof game.awayTeam === "object"
        ? game.awayTeam?.name
        : game.awayTeam;

    const homeTeam =
      typeof game.homeTeam === "object"
        ? game.homeTeam?.name
        : game.homeTeam;

    return `${
      awayTeam || "Away Team"
    } vs ${
      homeTeam || "Home Team"
    }`;
  },

  /*
  =======================================================
  EVENT CREATION
  =======================================================
  */

  createHomeRunEvent(
    play,
    game,
    pick,
    playId
  ) {
    const hitData =
      this.getHitData(play);

    return {
      id: playId,
      type: "homeRun",
      eventLabel: "Home Run",
      icon: "💣",

      player:
        this.getPlayerName(play),

      team:
        pick?.team ||
        "Team N/A",

      game:
        this.getGameMatchup(game),

      inning:
        this.getInningText(play),

      description:
        this.getPlayDescription(play),

      score:
        this.number(
          pick?.score,
          0
        ),

      rank:
        this.getPickRank(
          pick,
          "hr"
        ),

      exitVelocity:
        hitData.exitVelocity,

      launchAngle:
        hitData.launchAngle,

      distance:
        hitData.distance,

      timestamp:
        Date.now()
    };
  },

  createHitEvent(
    play,
    game,
    pick,
    playId
  ) {
    return {
      id: playId,
      type: "hit",
      eventLabel:
        this.getHitLabel(play),

      icon: "🔥",

      player:
        this.getPlayerName(play),

      team:
        pick?.team ||
        "Team N/A",

      game:
        this.getGameMatchup(game),

      inning:
        this.getInningText(play),

      description:
        this.getPlayDescription(play),

      score:
        this.number(
          pick?.score,
          0
        ),

      rank:
        this.getPickRank(
          pick,
          "hit"
        ),

      timestamp:
        Date.now()
    };
  },

  /*
  =======================================================
  PROCESS ONE GAME
  =======================================================
  */

  async processGame(game = {}) {
    const gamePk =
      this.number(
        game.gamePk ||
        game.id,
        0
      );

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
        this.detectedPlayIds.has(
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

      /*
      HOME RUN COLUMN

      Player must be in the displayed Top 20 HR list.
      */

      if (this.isHomeRun(play)) {
        const hrPick =
          this.findHRPick(
            playerName
          );

        if (hrPick) {
          this.hrEvents.unshift(
            this.createHomeRunEvent(
              play,
              game,
              hrPick,
              playId
            )
          );

          this.detectedPlayIds.add(
            playId
          );
        }

        /*
        Stop here so a home run does not also appear
        inside the Hit Pickz column.
        */

        continue;
      }

      /*
      HIT COLUMN

      Player must be in the displayed Top 20 Hit list.
      Only singles, doubles and triples count here.
      */

      if (this.isRegularHit(play)) {
        const hitPick =
          this.findHitPick(
            playerName
          );

        if (hitPick) {
          this.hitEvents.unshift(
            this.createHitEvent(
              play,
              game,
              hitPick,
              playId
            )
          );

          this.detectedPlayIds.add(
            playId
          );
        }
      }
    }
  },

  /*
  =======================================================
  CARD RENDERER
  =======================================================
  */

  renderEventCard(
    event = {},
    type = "hr"
  ) {
    const isHomeRun =
      type === "hr";

    const extraStats =
      isHomeRun
        ? `
          <div class="live-result-stat-grid">

            ${
              event.exitVelocity > 0
                ? `
                  <div>
                    <span>Exit Velocity</span>
                    <strong>
                      ${event.exitVelocity.toFixed(1)}
                      MPH
                    </strong>
                  </div>
                `
                : ""
            }

            ${
              event.distance > 0
                ? `
                  <div>
                    <span>Distance</span>
                    <strong>
                      ${Math.round(event.distance)}
                      FT
                    </strong>
                  </div>
                `
                : ""
            }

            ${
              event.launchAngle !== 0
                ? `
                  <div>
                    <span>Launch Angle</span>
                    <strong>
                      ${event.launchAngle.toFixed(0)}°
                    </strong>
                  </div>
                `
                : ""
            }

          </div>
        `
        : "";

    return `
      <article
        class="
          live-result-card
          ${
            isHomeRun
              ? "live-result-hr"
              : "live-result-hit"
          }
        "
      >

        <div class="live-result-card-top">

          <div class="live-result-player">

            <span class="live-result-icon">
              ${event.icon}
            </span>

            <div>
              <div class="live-result-name-row">

                ${
                  event.rank > 0
                    ? `
                      <span class="live-result-rank">
                        #${event.rank}
                      </span>
                    `
                    : ""
                }

                <h4>
                  ${this.escapeHTML(
                    event.player
                  )}
                </h4>

              </div>

              <span
                class="
                  live-result-event-badge
                  ${
                    isHomeRun
                      ? "home-run"
                      : "regular-hit"
                  }
                "
              >
                ${this.escapeHTML(
                  event.eventLabel
                )}
              </span>

            </div>

          </div>

          <time>
            ${this.escapeHTML(
              this.formatClockTime(
                event.timestamp
              )
            )}
          </time>

        </div>

        <div class="live-result-game">
          ${this.escapeHTML(
            event.game
          )}
          <span>•</span>
          ${this.escapeHTML(
            event.inning
          )}
        </div>

        <p class="live-result-description">
          ${this.escapeHTML(
            event.description
          )}
        </p>

        ${
          event.score > 0
            ? `
              <div class="live-result-score-row">

                <span>POPS Score</span>

                <strong>
                  ${event.score}/100
                </strong>

              </div>
            `
            : ""
        }

        ${extraStats}

      </article>
    `;
  },

  renderEmptyColumn(
    type = "hr"
  ) {
    const isHomeRun =
      type === "hr";

    return `
      <div class="live-column-empty">

        <span>
          ${isHomeRun ? "💣" : "🔥"}
        </span>

        <h4>
          ${
            isHomeRun
              ? "No HR Pickz Hits Yet"
              : "No Hit Pickz Results Yet"
          }
        </h4>

        <p>
          ${
            isHomeRun
              ? "Watching home runs from the displayed Top 20 HR Pickz."
              : "Watching singles, doubles and triples from the displayed Top 20 Hit Pickz."
          }
        </p>

      </div>
    `;
  },

  renderColumn(
    title,
    description,
    events,
    type
  ) {
    const isHomeRun =
      type === "hr";

    return `
      <section
        class="
          live-results-column
          ${
            isHomeRun
              ? "live-hr-column"
              : "live-hit-column"
          }
        "
      >

        <div class="live-column-header">

          <div>
            <h3>
              ${isHomeRun ? "💣" : "🔥"}
              ${this.escapeHTML(title)}
            </h3>

            <p>
              ${this.escapeHTML(
                description
              )}
            </p>
          </div>

          <span class="live-column-count">
            ${events.length}
          </span>

        </div>

        <div class="live-column-list">

          ${
            events.length
              ? events
                  .map(event =>
                    this.renderEventCard(
                      event,
                      type
                    )
                  )
                  .join("")
              : this.renderEmptyColumn(
                  type
                )
          }

        </div>

      </section>
    `;
  },

  /*
  =======================================================
  MAIN RENDER
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

    const games =
      this.getGames();

    const anyLiveGames =
      games.some(game =>
        this.isGameLiveOrFinal(game)
      );

    const hrCount =
      this.hrEvents.length;

    const hitCount =
      this.hitEvents.length;

    const totalCount =
      hrCount + hitCount;

    this.box.innerHTML = `
      <div class="live-plays-dashboard">

        <div class="live-plays-hero">

          <div class="live-plays-title">

            <span class="live-main-dot"></span>

            <div>
              <h2>
                POPS Live Plays
              </h2>

              <p>
                Automatically tracks hits and home runs
                by players listed in today's POPS Pickz.
              </p>
            </div>

          </div>

          <span class="live-now-badge">
            <span></span>
            LIVE
          </span>

        </div>

        <div class="live-plays-summary-grid">

          <div class="live-summary-card status">

            <span
              class="
                live-status-dot
                ${anyLiveGames ? "active" : ""}
              "
            ></span>

            <div>
              <strong>
                ${
                  anyLiveGames
                    ? "Live monitoring active"
                    : "Waiting for games"
                }
              </strong>

              <small>
                Feeds refresh every 45 seconds
              </small>
            </div>

          </div>

          <div class="live-summary-card total">

            <strong class="live-total-number">
              ${totalCount}
            </strong>

            <div>
              <span>Total Results</span>
              <small>Today</small>
            </div>

          </div>

        </div>

        <div class="live-results-grid">

          ${this.renderColumn(
            "HR Pickz Hits",
            "Home runs by players in the Top 20 HR Pickz",
            this.hrEvents,
            "hr"
          )}

          ${this.renderColumn(
            "Hit Pickz Hits",
            "Singles, doubles and triples by players in the Top 20 Hit Pickz",
            this.hitEvents,
            "hit"
          )}

        </div>

        <div class="live-monitor-footer">

          <span>
            🎯 Watching Top 20 HR Pickz
          </span>

          <span>
            🔥 Watching Top 20 Hit Pickz
          </span>

        </div>

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

      this.hrEvents.sort(
        (a, b) =>
          b.timestamp -
          a.timestamp
      );

      this.hitEvents.sort(
        (a, b) =>
          b.timestamp -
          a.timestamp
      );

      this.render();
    } finally {
      this.loading = false;
    }
  },

  start() {
    if (this.started) {
      return;
    }

    this.started = true;

    this.box =
      document.getElementById(
        "livePlaysBox"
      );

    this.render();

    this.refresh().catch(error => {
      console.warn(
        "POPS Live Plays initial refresh:",
        error
      );
    });

    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.refresh().catch(error => {
        console.warn(
          "POPS Live Plays refresh:",
          error
        );
      });
    }, this.settings.refreshInterval);

    console.log(
      "🔴 POPS Live Plays monitor active."
    );
  },

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.started = false;
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
app.js may still be loading the picks when DOMContentLoaded
fires, so wait before starting the monitor.
*/

document.addEventListener(
  "DOMContentLoaded",
  () => {
    setTimeout(() => {
      LivePlays.start();
    }, 6000);
  }
);