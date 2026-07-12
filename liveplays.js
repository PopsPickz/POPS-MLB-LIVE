/*
=========================================================
POPS PICKZ LIVE PLAYS
File: liveplays.js
Version: 1.0
=========================================================

TRACKS:

- Home runs by players listed in POPS HR Pickz
- Hits by players listed in POPS Hit Pickz

The MLB live feed is checked every 45 seconds.

IMPORTANT:

This module only works after app.js has loaded:

- window.games
- window.hrPicks
- window.hitPicks
=========================================================
*/

const LivePlays = {
  box: null,

  settings: {
    refreshInterval: 45 * 1000
  },

  timer: null,
  loading: false,

  detectedPlayIds: new Set(),
  liveEvents: [],

  /*
  =======================================================
  HELPERS
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
    return Array.isArray(window.hrPicks)
      ? window.hrPicks
      : [];
  },

  getHitPicks() {
    return Array.isArray(window.hitPicks)
      ? window.hitPicks
      : [];
  },

  findHRPick(playerName = "") {
    const normalized =
      this.normalizeName(playerName);

    return this.getHRPicks().find(pick => {
      return (
        this.normalizeName(
          pick.player ||
          pick.name
        ) === normalized
      );
    });
  },

  findHitPick(playerName = "") {
    const normalized =
      this.normalizeName(playerName);

    return this.getHitPicks().find(pick => {
      return (
        this.normalizeName(
          pick.player ||
          pick.name
        ) === normalized
      );
    });
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
    ).toLowerCase();
  },

  isHomeRun(play = {}) {
    const eventType =
      this.getEventType(play);

    return (
      eventType === "home_run" ||
      eventType === "home run" ||
      eventType.includes("home_run")
    );
  },

  isHit(play = {}) {
    const eventType =
      this.getEventType(play);

    return [
      "single",
      "double",
      "triple",
      "home_run"
    ].includes(eventType);
  },

  getInningText(play = {}) {
    const inning =
      Number(play?.about?.inning || 0);

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

  getHitData(play = {}) {
    const hitData =
      play?.playEvents
        ?.map(event => event?.hitData)
        .find(Boolean) ||
      {};

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
    pick
  ) {
    const hitData =
      this.getHitData(play);

    return {
      type: "homeRun",
      icon: "💣",
      title: "POPS HR PICK HIT",
      player:
        this.getPlayerName(play),

      team:
        pick?.team ||
        "Team N/A",

      game:
        `${game.awayTeam} vs ${game.homeTeam}`,

      inning:
        this.getInningText(play),

      description:
        this.getPlayDescription(play),

      score:
        Number(
          pick?.score || 0
        ),

      rank:
        this.getHRPicks()
          .findIndex(item => item === pick) + 1,

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
    pick
  ) {
    return {
      type: "hit",
      icon: "🔥",
      title: "POPS HIT PICK HIT",
      player:
        this.getPlayerName(play),

      team:
        pick?.team ||
        "Team N/A",

      game:
        `${game.awayTeam} vs ${game.homeTeam}`,

      inning:
        this.getInningText(play),

      description:
        this.getPlayDescription(play),

      score:
        Number(
          pick?.score || 0
        ),

      rank:
        this.getHitPicks()
          .findIndex(item => item === pick) + 1,

      timestamp:
        Date.now()
    };
  },

  /*
  =======================================================
  PROCESS GAME
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

      if (this.isHomeRun(play)) {
        const hrPick =
          this.findHRPick(
            playerName
          );

        if (hrPick) {
          this.liveEvents.unshift(
            this.createHomeRunEvent(
              play,
              game,
              hrPick
            )
          );

          this.detectedPlayIds.add(
            playId
          );

          continue;
        }
      }

      if (this.isHit(play)) {
        const hitPick =
          this.findHitPick(
            playerName
          );

        if (hitPick) {
          this.liveEvents.unshift(
            this.createHitEvent(
              play,
              game,
              hitPick
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
  RENDER
  =======================================================
  */

  renderEvent(event = {}) {
    const extraStats =
      event.type === "homeRun"
        ? `
          <div class="live-play-stat-grid">

            ${
              event.exitVelocity > 0
                ? `
                  <div>
                    <span>Exit Velocity</span>
                    <strong>
                      ${event.exitVelocity.toFixed(1)} MPH
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
                      ${Math.round(event.distance)} FT
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
          live-play-card
          live-play-${event.type}
        "
      >

        <div class="live-play-header">

          <span class="live-play-icon">
            ${event.icon}
          </span>

          <div>
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
                <strong>POPS Score:</strong>
                <span class="score">
                  ${event.score}/100
                </span>
              </p>
            `
            : ""
        }

        ${extraStats}

      </article>
    `;
  },

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

    if (!this.liveEvents.length) {
      const games =
        this.getGames();

      const anyLiveGames =
        games.some(game =>
          this.isGameLiveOrFinal(game)
        );

      this.box.innerHTML = `
        <div class="live-plays-empty">

          <div class="live-pulse-dot"></div>

          <h3>
            ${
              anyLiveGames
                ? "Watching Live Games"
                : "Waiting for Games to Begin"
            }
          </h3>

          <p>
            POPS is checking today's MLB games for
            home runs and hits by listed players.
          </p>

        </div>
      `;

      return;
    }

    this.box.innerHTML = `
      <div class="live-plays-summary">

        <span class="live-pulse-dot"></span>

        <strong>
          ${this.liveEvents.length}
          POPS live result${
            this.liveEvents.length === 1
              ? ""
              : "s"
          }
        </strong>

      </div>

      <div class="live-plays-list">

        ${this.liveEvents
          .map(event =>
            this.renderEvent(event)
          )
          .join("")}

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
                `Live Plays game error:`,
                error
              );
            })
        )
      );

      this.liveEvents.sort(
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
    this.box =
      document.getElementById(
        "livePlaysBox"
      );

    this.render();

    this.refresh();

    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      this.refresh();
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
  }
};

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

document.addEventListener(
  "DOMContentLoaded",
  () => {
    setTimeout(() => {
      LivePlays.start();
    }, 4000);
  }
);
