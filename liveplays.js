/*
=========================================================
POPS PICKZ LIVE PLAYS
File: liveplays.js
Version: 2.0
=========================================================

TRACKS:

1. Home runs by players displayed in the Top 20
   POPS HR Pickz list.

2. Singles, doubles and triples by players displayed
   in the Top 20 POPS Hit Pickz list.

IMPORTANT:

- Players ranked below #20 are ignored.
- Home runs appear only in the HR Pickz column.
- Normal hits appear only in the Hit Pickz column.
- The MLB live feed is checked every 45 seconds.

This module must load after app.js because it uses:

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

  formatGameTime(value) {
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

  getGameTeamName(game = {}, side = "away") {
    const team =
      side === "away"
        ? game.awayTeam
        : game.homeTeam;

    if (
      typeof team === "string" &&
      team.trim()
    ) {
      return team.trim();
    }

    if (
      team &&
      typeof team === "object"
    ) {
      return (
        team.name ||
        team.teamName ||
        `${side} team`
      );
    }

    return side === "away"
      ? "Away Team"
      : "Home Team";
  },

  getGameMatchup(game = {}) {
    const awayTeam =
      this.getGameTeamName(
        game,
        "away"
      );

    const homeTeam =
      this.getGameTeamName(
        game,
        "home"
      );

    return `${awayTeam} vs ${homeTeam}`;
  },

  getGames() {
    if (
      Array.isArray(window.games) &&
      window.games.length
    ) {
      return window.games;
    }

    if (
      Array.isArray(
        window.todayData?.games
      ) &&
      window.todayData.games.length
    ) {
      return window.todayData.games;
    }

    return [];
  },

  /*
  =======================================================
  TOP 20 PICK LISTS

  These functions intentionally use slice(0, 20).

  A player ranked #21 or lower cannot be matched.
  =======================================================
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

    const topHRPicks =
      this.getHRPicks();

    const pickIndex =
      topHRPicks.findIndex(pick => {
        const pickName =
          pick?.player ||
          pick?.name ||
          "";

        return (
          this.normalizeName(
            pickName
          ) === normalizedPlayer
        );
      });

    if (pickIndex < 0) {
      return null;
    }

    return {
      pick: topHRPicks[pickIndex],
      rank: pickIndex + 1
    };
  },

  findHitPick(playerName = "") {
    const normalizedPlayer =
      this.normalizeName(playerName);

    const topHitPicks =
      this.getHitPicks();

    const pickIndex =
      topHitPicks.findIndex(pick => {
        const pickName =
          pick?.player ||
          pick?.name ||
          "";

        return (
          this.normalizeName(
            pickName
          ) === normalizedPlayer
        );
      });

    if (pickIndex < 0) {
      return null;
    }

    return {
      pick: topHitPicks[pickIndex],
      rank: pickIndex + 1
    };
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
      typeof API.getLiveGame ===
        "function"
    ) {
      try {
        return await API.getLiveGame(
          gamePk,
          true
        );
      } catch (error) {
        console.warn(
          `Live Plays API fallback for game ${gamePk}:`,
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
  PLAY EXTRACTION
  =======================================================
  */

  getAllPlays(feed = {}) {
    const plays =
      feed?.liveData?.plays?.allPlays;

    return Array.isArray(plays)
      ? plays
      : [];
  },

  getPlayId(
    play = {},
    gamePk = 0
  ) {
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
      play?.matchup?.batter
        ?.fullName ||
      play?.matchup?.batter
        ?.name ||
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

  getEventLabel(play = {}) {
    const eventType =
      this.getEventType(play);

    if (eventType === "single") {
      return "Single";
    }

    if (eventType === "double") {
      return "Double";
    }

    if (eventType === "triple") {
      return "Triple";
    }

    if (eventType === "home_run") {
      return "Home Run";
    }

    return (
      play?.result?.event ||
      "Hit"
    );
  },

  isHomeRun(play = {}) {
    const eventType =
      this.getEventType(play);

    return eventType === "home_run";
  },

  /*
  Only singles, doubles and triples are placed
  inside the Hit Pickz column.

  Home runs remain exclusive to the HR column.
  */

  isRegularHit(play = {}) {
    const eventType =
      this.getEventType(play);

    return [
      "single",
      "double",
      "triple"
    ].includes(eventType);
  },

  getInningText(play = {}) {
    const inning =
      Number(
        play?.about?.inning || 0
      );

    const half =
      String(
        play?.about?.halfInning || ""
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
      "Live play detected"
    );
  },

  getPlayTimestamp(
    play = {}
  ) {
    const endTime =
      play?.about?.endTime;

    const startTime =
      play?.about?.startTime;

    const parsedTime =
      new Date(
        endTime ||
        startTime ||
        ""
      ).getTime();

    return Number.isFinite(parsedTime)
      ? parsedTime
      : Date.now();
  },

  getHitData(play = {}) {
    const playEvents =
      Array.isArray(play?.playEvents)
        ? play.playEvents
        : [];

    const hitData =
      playEvents
        .map(event =>
          event?.hitData
        )
        .find(Boolean) || {};

    return {
      exitVelocity:
        Number(
          hitData.launchSpeed || 0
        ),

      launchAngle:
        Number(
          hitData.launchAngle || 0
        ),

      distance:
        Number(
          hitData.totalDistance || 0
        )
    };
  },

  /*
  =======================================================
  EVENT CREATION
  =======================================================
  */

  createHomeRunEvent(
    play,
    game,
    pickResult
  ) {
    const pick =
      pickResult?.pick || {};

    const hitData =
      this.getHitData(play);

    return {
      id:
        this.getPlayId(
          play,
          game.gamePk ||
          game.id
        ),

      type: "homeRun",

      icon: "💣",

      title:
        "POPS HR PICK HIT",

      player:
        this.getPlayerName(play),

      team:
        pick.team ||
        "Team N/A",

      game:
        this.getGameMatchup(game),

      gameTime:
        game.date ||
        game.gameDate ||
        "",

      inning:
        this.getInningText(play),

      eventLabel:
        "Home Run",

      description:
        this.getPlayDescription(play),

      score:
        Number(
          pick.score || 0
        ),

      rank:
        Number(
          pickResult?.rank || 0
        ),

      exitVelocity:
        hitData.exitVelocity,

      launchAngle:
        hitData.launchAngle,

      distance:
        hitData.distance,

      timestamp:
        this.getPlayTimestamp(play)
    };
  },

  createHitEvent(
    play,
    game,
    pickResult
  ) {
    const pick =
      pickResult?.pick || {};

    const hitData =
      this.getHitData(play);

    return {
      id:
        this.getPlayId(
          play,
          game.gamePk ||
          game.id
        ),

      type: "hit",

      icon: "🔥",

      title:
        "POPS HIT PICK HIT",

      player:
        this.getPlayerName(play),

      team:
        pick.team ||
        "Team N/A",

      game:
        this.getGameMatchup(game),

      gameTime:
        game.date ||
        game.gameDate ||
        "",

      inning:
        this.getInningText(play),

      eventLabel:
        this.getEventLabel(play),

      description:
        this.getPlayDescription(play),

      score:
        Number(
          pick.score || 0
        ),

      rank:
        Number(
          pickResult?.rank || 0
        ),

      exitVelocity:
        hitData.exitVelocity,

      launchAngle:
        hitData.launchAngle,

      distance:
        hitData.distance,

      timestamp:
        this.getPlayTimestamp(play)
    };
  },

  /*
  =======================================================
  EVENT STORAGE
  =======================================================
  */

  addHomeRunEvent(event) {
    if (!event?.id) {
      return;
    }

    const alreadyExists =
      this.hrEvents.some(
        item => item.id === event.id
      );

    if (!alreadyExists) {
      this.hrEvents.unshift(event);
    }
  },

  addHitEvent(event) {
    if (!event?.id) {
      return;
    }

    const alreadyExists =
      this.hitEvents.some(
        item => item.id === event.id
      );

    if (!alreadyExists) {
      this.hitEvents.unshift(event);
    }
  },

  /*
  =======================================================
  PROCESS ONE GAME
  =======================================================
  */

  async processGame(game = {}) {
    const gamePk =
      Number(
        game.gamePk ||
        game.id ||
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

      let matchedPick = false;

      /*
      Home runs are checked only against the
      displayed Top 20 HR Pickz list.
      */

      if (this.isHomeRun(play)) {
        const hrPickResult =
          this.findHRPick(
            playerName
          );

        if (hrPickResult) {
          const hrEvent =
            this.createHomeRunEvent(
              play,
              game,
              hrPickResult
            );

          this.addHomeRunEvent(
            hrEvent
          );

          matchedPick = true;
        }
      }

      /*
      Singles, doubles and triples are checked
      only against the displayed Top 20 Hit Pickz.

      Home runs are intentionally excluded here.
      */

      if (this.isRegularHit(play)) {
        const hitPickResult =
          this.findHitPick(
            playerName
          );

        if (hitPickResult) {
          const hitEvent =
            this.createHitEvent(
              play,
              game,
              hitPickResult
            );

          this.addHitEvent(
            hitEvent
          );

          matchedPick = true;
        }
      }

      /*
      Only mark the play as detected when it matched
      one of the site's displayed Top 20 lists.
      */

      if (matchedPick) {
        this.detectedPlayIds.add(
          playId
        );
      }
    }
  },

  /*
  =======================================================
  EVENT CARD
  =======================================================
  */

  renderEvent(event = {}) {
    const hitDataAvailable =
      event.exitVelocity > 0 ||
      event.distance > 0 ||
      event.launchAngle !== 0;

    const hitDataHTML =
      hitDataAvailable
        ? `
          <div class="live-play-stat-grid">

            ${
              event.exitVelocity > 0
                ? `
                  <div>
                    <span>
                      Exit Velocity
                    </span>

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
                    <span>
                      Distance
                    </span>

                    <strong>
                      ${Math.round(
                        event.distance
                      )} FT
                    </strong>
                  </div>
                `
                : ""
            }

            ${
              event.launchAngle !== 0
                ? `
                  <div>
                    <span>
                      Launch Angle
                    </span>

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
          live-play-card
          live-play-${event.type}
        "
      >

        <div class="live-play-header">

          <span class="live-play-icon">
            ${event.icon}
          </span>

          <div class="live-play-player-info">

            <span class="live-play-label">
              ${this.escapeHTML(
                event.title
              )}
            </span>

            <h3>
              ${this.escapeHTML(
                event.player
              )}
            </h3>

          </div>

          ${
            event.rank > 0
              ? `
                <span class="live-play-rank">
                  #${event.rank}
                </span>
              `
              : ""
          }

        </div>

        <div class="live-play-result-badge">
          ${this.escapeHTML(
            event.eventLabel
          )}
        </div>

        <p>
          <strong>Team:</strong>
          ${this.escapeHTML(
            event.team
          )}
        </p>

        <p>
          <strong>Game:</strong>
          ${this.escapeHTML(
            event.game
          )}
        </p>

        <p>
          <strong>Scheduled:</strong>
          ${this.escapeHTML(
            this.formatGameTime(
              event.gameTime
            )
          )}
        </p>

        <p>
          <strong>Inning:</strong>
          ${this.escapeHTML(
            event.inning
          )}
        </p>

        <p class="live-play-description">
          ${this.escapeHTML(
            event.description
          )}
        </p>

        ${
          event.score > 0
            ? `
              <p>
                <strong>
                  POPS Score:
                </strong>

                <span class="score">
                  ${event.score}/100
                </span>
              </p>
            `
            : ""
        }

        ${hitDataHTML}

      </article>
    `;
  },

  /*
  =======================================================
  COLUMN RENDERING
  =======================================================
  */

  renderColumn({
    type,
    icon,
    title,
    description,
    events
  }) {
    const safeEvents =
      Array.isArray(events)
        ? events
        : [];

    return `
      <section
        class="
          live-plays-column
          live-plays-column-${type}
        "
      >

        <div class="live-column-header">

          <span class="live-column-icon">
            ${icon}
          </span>

          <div>
            <h3>
              ${this.escapeHTML(title)}
            </h3>

            <p>
              ${this.escapeHTML(
                description
              )}
            </p>
          </div>

          <span class="live-column-count">
            ${safeEvents.length}
          </span>

        </div>

        <div class="live-column-results">

          ${
            safeEvents.length
              ? safeEvents
                  .map(event =>
                    this.renderEvent(event)
                  )
                  .join("")
              : `
                <div class="live-column-empty">

                  <span>
                    ${
                      type === "hr"
                        ? "⚾"
                        : "🔥"
                    }
                  </span>

                  <strong>
                    No ${
                      type === "hr"
                        ? "HR Pickz"
                        : "Hit Pickz"
                    } results yet
                  </strong>

                  <p>
                    Monitoring today's displayed
                    Top 20 list.
                  </p>

                </div>
              `
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

    const totalResults =
      this.hrEvents.length +
      this.hitEvents.length;

    const topHRPickCount =
      this.getHRPicks().length;

    const topHitPickCount =
      this.getHitPicks().length;

    this.box.innerHTML = `
      <div class="live-plays-dashboard">

        <div class="live-plays-summary">

          <div class="live-status-group">

            <span class="live-pulse-dot"></span>

            <div>
              <strong>
                ${
                  anyLiveGames
                    ? "Live monitoring active"
                    : "Waiting for games"
                }
              </strong>

              <small>
                MLB feeds refresh every
                ${Math.round(
                  this.settings
                    .refreshInterval /
                  1000
                )}
                seconds
              </small>
            </div>

          </div>

          <div class="live-result-total">
            <strong>
              ${totalResults}
            </strong>

            <span>
              Total Results
            </span>
          </div>

        </div>

        <div class="live-pick-limits">

          <span>
            💣 Watching
            <strong>
              ${topHRPickCount}
            </strong>
            Top HR Pickz
          </span>

          <span>
            🔥 Watching
            <strong>
              ${topHitPickCount}
            </strong>
            Top Hit Pickz
          </span>

        </div>

        <div class="live-plays-columns">

          ${this.renderColumn({
            type: "hr",
            icon: "💣",
            title: "HR Pickz Hits",
            description:
              "Home runs by players in the displayed Top 20 HR Pickz.",
            events: this.hrEvents
          })}

          ${this.renderColumn({
            type: "hit",
            icon: "🔥",
            title: "Hit Pickz Hits",
            description:
              "Singles, doubles and triples by players in the displayed Top 20 Hit Pickz.",
            events: this.hitEvents
          })}

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
                "Live Plays game error:",
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
        "Initial Live Plays refresh error:",
        error
      );
    });

    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.refresh().catch(error => {
        console.warn(
          "Live Plays refresh error:",
          error
        );
      });
    }, this.settings.refreshInterval);

    console.log(
      "🔴 POPS Live Plays 2.0 monitor active."
    );
  },

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  /*
  Clears stored results and scans the feeds again.
  */

  reset() {
    this.detectedPlayIds.clear();

    this.hrEvents = [];
    this.hitEvents = [];

    this.render();

    return this.refresh();
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
=========================================================
START AFTER APP.JS
=========================================================
*/

document.addEventListener(
  "DOMContentLoaded",
  () => {
    setTimeout(() => {
      LivePlays.start();
    }, 5000);
  }
);