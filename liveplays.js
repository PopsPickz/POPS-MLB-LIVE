/*
=========================================================
POPS PICKZ LIVE PLAYS
File: liveplays.js
Version: 3.0
=========================================================

TRACKS ONLY:

- Home runs by players displayed in the Top 20 HR Pickz
- Hits by players displayed in the Top 20 Hit Pickz

IMPORTANT:

- Each player appears only once per column.
- Multiple hits increase that player's hit total.
- Multiple home runs increase that player's HR total.
- Home runs and hits are displayed in separate columns.
- A home run is displayed in the HR column only.
- Players outside the displayed Top 20 lists are ignored.

The MLB live feed is checked every 45 seconds.

REQUIRED SCRIPT ORDER:

<script src="app.js"></script>
<script src="liveplays.js?v=3"></script>

REQUIRED HTML:

<section
  class="card tab-section live-plays-section"
  id="liveplays"
>
  <div class="live-plays-section-header">
    <h2>🔴 POPS Live Plays</h2>

    <p>
      Automatically tracks hits and home runs by
      players listed in today's POPS Pickz.
    </p>
  </div>

  <div id="livePlaysBox">
    <p>Waiting for today's MLB games to begin...</p>
  </div>
</section>
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
  liveEvents: [],

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

  getTeamName(team = "", fallback = "Team N/A") {
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
        fallback
      );
    }

    return fallback;
  },

  getGameMatchup(game = {}) {
    const awayTeam =
      this.getTeamName(
        game.awayTeam,
        "Away Team"
      );

    const homeTeam =
      this.getTeamName(
        game.homeTeam,
        "Home Team"
      );

    return `${awayTeam} vs ${homeTeam}`;
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

  /*
  Only return the same Top 20 HR players that are
  displayed on the HR Pickz page.
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
  Only return the same Top 20 Hit players that are
  displayed on the Hit Pickz page.
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
    const normalizedPlayerName =
      this.normalizeName(playerName);

    if (!normalizedPlayerName) {
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
          normalizedPlayerName
        );
      }) ||
      null
    );
  },

  findHitPick(playerName = "") {
    const normalizedPlayerName =
      this.normalizeName(playerName);

    if (!normalizedPlayerName) {
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
          normalizedPlayerName
        );
      }) ||
      null
    );
  },

  /*
  Finds a player's existing card so the name is not
  displayed more than once in the same column.
  */

  findExistingEvent(
    type,
    playerName = ""
  ) {
    const normalizedPlayerName =
      this.normalizeName(playerName);

    return (
      this.liveEvents.find(event => {
        return (
          event.type === type &&
          this.normalizeName(
            event.player
          ) === normalizedPlayerName
        );
      }) ||
      null
    );
  },

  getGameStatus(game = {}) {
    const status =
      game.status ||
      game.statusObject ||
      {};

    return String(
      status.abstractGameState ||
      status.abstractGameCode ||
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
      status === "f" ||
      status === "o"
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
          `POPS Live Plays API fallback for game ${gamePk}:`,
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
      play?.matchup?.batter?.id ?? "",
      play?.result?.description ?? ""
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
      "triple"
    ].includes(eventType);
  },

  getHitType(play = {}) {
    const eventType =
      this.getEventType(play);

    if (eventType === "double") {
      return "Double";
    }

    if (eventType === "triple") {
      return "Triple";
    }

    if (eventType === "single") {
      return "Single";
    }

    return "Hit";
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

    const hrPicks =
      this.getHRPicks();

    const rank =
      hrPicks.findIndex(item => {
        return (
          this.normalizeName(
            item?.player ||
            item?.name ||
            ""
          ) ===
          this.normalizeName(
            this.getPlayerName(play)
          )
        );
      }) + 1;

    return {
      type: "homeRun",

      icon: "💣",

      title:
        "POPS HR PICK HIT",

      player:
        this.getPlayerName(play),

      team:
        pick?.team ||
        "Team N/A",

      game:
        this.getGameMatchup(game),

      gamePk:
        Number(
          game.gamePk ||
          game.id ||
          0
        ),

      scheduledTime:
        game.date ||
        game.gameDate ||
        "",

      inning:
        this.getInningText(play),

      description:
        this.getPlayDescription(play),

      score:
        this.number(
          pick?.score,
          0
        ),

      rank,

      totalResults: 1,

      resultLabel:
        "Home Run",

      exitVelocity:
        hitData.exitVelocity,

      launchAngle:
        hitData.launchAngle,

      distance:
        hitData.distance,

      firstDetected:
        Date.now(),

      timestamp:
        Date.now()
    };
  },

  createHitEvent(
    play,
    game,
    pick
  ) {
    const hitPicks =
      this.getHitPicks();

    const rank =
      hitPicks.findIndex(item => {
        return (
          this.normalizeName(
            item?.player ||
            item?.name ||
            ""
          ) ===
          this.normalizeName(
            this.getPlayerName(play)
          )
        );
      }) + 1;

    return {
      type: "hit",

      icon: "🔥",

      title:
        "POPS HIT PICK HIT",

      player:
        this.getPlayerName(play),

      team:
        pick?.team ||
        "Team N/A",

      game:
        this.getGameMatchup(game),

      gamePk:
        Number(
          game.gamePk ||
          game.id ||
          0
        ),

      scheduledTime:
        game.date ||
        game.gameDate ||
        "",

      inning:
        this.getInningText(play),

      description:
        this.getPlayDescription(play),

      score:
        this.number(
          pick?.score,
          0
        ),

      rank,

      totalResults: 1,

      resultLabel:
        this.getHitType(play),

      hitTypes: [
        this.getHitType(play)
      ],

      firstDetected:
        Date.now(),

      timestamp:
        Date.now()
    };
  },

  /*
  =======================================================
  UPDATE EXISTING EVENTS
  =======================================================
  */

  updateHomeRunEvent(
    existingEvent,
    newEvent
  ) {
    existingEvent.totalResults =
      this.number(
        existingEvent.totalResults,
        1
      ) + 1;

    existingEvent.inning =
      newEvent.inning;

    existingEvent.description =
      newEvent.description;

    existingEvent.resultLabel =
      "Home Run";

    existingEvent.timestamp =
      Date.now();

    /*
    Keep the player's longest home run.
    */

    existingEvent.distance =
      Math.max(
        this.number(
          existingEvent.distance,
          0
        ),
        this.number(
          newEvent.distance,
          0
        )
      );

    /*
    Keep the player's highest exit velocity.
    */

    existingEvent.exitVelocity =
      Math.max(
        this.number(
          existingEvent.exitVelocity,
          0
        ),
        this.number(
          newEvent.exitVelocity,
          0
        )
      );

    /*
    Show the latest launch angle.
    */

    if (
      this.number(
        newEvent.launchAngle,
        0
      ) !== 0
    ) {
      existingEvent.launchAngle =
        newEvent.launchAngle;
    }
  },

  updateHitEvent(
    existingEvent,
    newEvent
  ) {
    existingEvent.totalResults =
      this.number(
        existingEvent.totalResults,
        1
      ) + 1;

    existingEvent.inning =
      newEvent.inning;

    existingEvent.description =
      newEvent.description;

    existingEvent.resultLabel =
      newEvent.resultLabel;

    existingEvent.timestamp =
      Date.now();

    if (
      !Array.isArray(
        existingEvent.hitTypes
      )
    ) {
      existingEvent.hitTypes = [];
    }

    existingEvent.hitTypes.push(
      newEvent.resultLabel
    );
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

      /*
      HOME RUN CHECK

      A home run is accepted only when the player is
      currently inside the displayed Top 20 HR Pickz.
      */

      if (this.isHomeRun(play)) {
        const hrPick =
          this.findHRPick(
            playerName
          );

        if (!hrPick) {
          /*
          The player was not in the displayed Top 20.
          Mark the play as checked, but do not show it.
          */

          this.detectedPlayIds.add(
            playId
          );

          continue;
        }

        const newHomeRunEvent =
          this.createHomeRunEvent(
            play,
            game,
            hrPick
          );

        const existingHomeRun =
          this.findExistingEvent(
            "homeRun",
            playerName
          );

        if (existingHomeRun) {
          this.updateHomeRunEvent(
            existingHomeRun,
            newHomeRunEvent
          );
        } else {
          this.liveEvents.unshift(
            newHomeRunEvent
          );
        }

        this.detectedPlayIds.add(
          playId
        );

        /*
        Do not also place the home run inside the Hit
        Pickz column.
        */

        continue;
      }

      /*
      HIT CHECK

      Singles, doubles and triples are accepted only when
      the player is inside the displayed Top 20 Hit Pickz.
      */

      if (this.isHit(play)) {
        const hitPick =
          this.findHitPick(
            playerName
          );

        if (!hitPick) {
          this.detectedPlayIds.add(
            playId
          );

          continue;
        }

        const newHitEvent =
          this.createHitEvent(
            play,
            game,
            hitPick
          );

        const existingHit =
          this.findExistingEvent(
            "hit",
            playerName
          );

        if (existingHit) {
          this.updateHitEvent(
            existingHit,
            newHitEvent
          );
        } else {
          this.liveEvents.unshift(
            newHitEvent
          );
        }

        this.detectedPlayIds.add(
          playId
        );
      }
    }
  },

  /*
  =======================================================
  EVENT FILTERS
  =======================================================
  */

  getHomeRunEvents() {
    return this.liveEvents
      .filter(event =>
        event.type === "homeRun"
      )
      .sort(
        (a, b) =>
          b.timestamp -
          a.timestamp
      );
  },

  getHitEvents() {
    return this.liveEvents
      .filter(event =>
        event.type === "hit"
      )
      .sort(
        (a, b) =>
          b.timestamp -
          a.timestamp
      );
  },

  getTotalHomeRuns() {
    return this.getHomeRunEvents()
      .reduce(
        (total, event) =>
          total +
          this.number(
            event.totalResults,
            1
          ),
        0
      );
  },

  getTotalHits() {
    return this.getHitEvents()
      .reduce(
        (total, event) =>
          total +
          this.number(
            event.totalResults,
            1
          ),
        0
      );
  },

  /*
  =======================================================
  CARD RENDERING
  =======================================================
  */

  renderHomeRunStats(event = {}) {
    const stats = [];

    if (
      this.number(
        event.exitVelocity,
        0
      ) > 0
    ) {
      stats.push(`
        <div class="live-play-stat">
          <span>Max Exit Velocity</span>

          <strong>
            ${this.number(
              event.exitVelocity,
              0
            ).toFixed(1)} MPH
          </strong>
        </div>
      `);
    }

    if (
      this.number(
        event.distance,
        0
      ) > 0
    ) {
      stats.push(`
        <div class="live-play-stat">
          <span>Longest Distance</span>

          <strong>
            ${Math.round(
              this.number(
                event.distance,
                0
              )
            )} FT
          </strong>
        </div>
      `);
    }

    if (
      this.number(
        event.launchAngle,
        0
      ) !== 0
    ) {
      stats.push(`
        <div class="live-play-stat">
          <span>Latest Launch Angle</span>

          <strong>
            ${this.number(
              event.launchAngle,
              0
            ).toFixed(0)}°
          </strong>
        </div>
      `);
    }

    if (!stats.length) {
      return "";
    }

    return `
      <div class="live-play-stat-grid">
        ${stats.join("")}
      </div>
    `;
  },

  renderHitTypes(event = {}) {
    const hitTypes =
      Array.isArray(event.hitTypes)
        ? event.hitTypes
        : [];

    if (!hitTypes.length) {
      return "";
    }

    const totals = {
      Single: 0,
      Double: 0,
      Triple: 0
    };

    for (const hitType of hitTypes) {
      if (
        Object.prototype.hasOwnProperty.call(
          totals,
          hitType
        )
      ) {
        totals[hitType] += 1;
      }
    }

    const labels = [];

    if (totals.Single > 0) {
      labels.push(
        `${totals.Single} ${
          totals.Single === 1
            ? "single"
            : "singles"
        }`
      );
    }

    if (totals.Double > 0) {
      labels.push(
        `${totals.Double} ${
          totals.Double === 1
            ? "double"
            : "doubles"
        }`
      );
    }

    if (totals.Triple > 0) {
      labels.push(
        `${totals.Triple} ${
          totals.Triple === 1
            ? "triple"
            : "triples"
        }`
      );
    }

    if (!labels.length) {
      return "";
    }

    return `
      <p class="live-play-hit-types">
        <strong>Hit Breakdown:</strong>
        ${this.escapeHTML(
          labels.join(" • ")
        )}
      </p>
    `;
  },

  renderEvent(event = {}) {
    const resultCount =
      this.number(
        event.totalResults,
        1
      );

    const countLabel =
      event.type === "homeRun"
        ? (
            resultCount === 1
              ? "Home Run"
              : "Home Runs"
          )
        : (
            resultCount === 1
              ? "Hit"
              : "Hits"
          );

    const extraDetails =
      event.type === "homeRun"
        ? this.renderHomeRunStats(
            event
          )
        : this.renderHitTypes(
            event
          );

    return `
      <article
        class="
          live-play-card
          live-play-${event.type}
        "
      >

        <div class="live-play-card-glow"></div>

        <div class="live-play-header">

          <span class="live-play-icon">
            ${event.icon}
          </span>

          <div class="live-play-player-copy">

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

        <div class="live-play-result-total">

          <span>
            ${countLabel}
          </span>

          <strong>
            ${resultCount}
          </strong>

        </div>

        <div class="live-play-card-details">

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

          ${
            event.scheduledTime
              ? `
                <p>
                  <strong>Scheduled:</strong>

                  ${this.escapeHTML(
                    this.formatGameTime(
                      event.scheduledTime
                    )
                  )}
                </p>
              `
              : ""
          }

          <p>
            <strong>Latest Inning:</strong>

            ${this.escapeHTML(
              event.inning
            )}
          </p>

        </div>

        <p class="live-play-description">
          ${this.escapeHTML(
            event.description
          )}
        </p>

        ${
          event.score > 0
            ? `
              <p class="live-play-pops-score">
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

        ${extraDetails}

      </article>
    `;
  },

  renderEmptyColumn({
    type = "hit",
    title = "",
    message = ""
  }) {
    const icon =
      type === "homeRun"
        ? "💣"
        : "🔥";

    return `
      <div
        class="
          live-plays-column-empty
          live-plays-empty-${type}
        "
      >

        <span class="live-empty-icon">
          ${icon}
        </span>

        <h4>
          ${this.escapeHTML(title)}
        </h4>

        <p>
          ${this.escapeHTML(message)}
        </p>

      </div>
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

    const homeRunEvents =
      this.getHomeRunEvents();

    const hitEvents =
      this.getHitEvents();

    const games =
      this.getGames();

    const anyLiveGames =
      games.some(game =>
        this.isGameLiveOrFinal(game)
      );

    const totalHomeRuns =
      this.getTotalHomeRuns();

    const totalHits =
      this.getTotalHits();

    this.box.innerHTML = `
      <div class="live-plays-dashboard">

        <div class="live-plays-status-bar">

          <div class="live-plays-monitor-status">

            <span class="live-pulse-dot"></span>

            <div>
              <strong>
                ${
                  anyLiveGames
                    ? "Live monitor active"
                    : "Waiting for games"
                }
              </strong>

              <small>
                MLB feeds refresh every 45 seconds
              </small>
            </div>

          </div>

          <div class="live-plays-total-results">

            <span>
              ${totalHomeRuns + totalHits}
            </span>

            <small>
              Total Results
            </small>

          </div>

        </div>

        <div class="live-plays-pick-status">

          <span>
            💣 Watching
            ${this.getHRPicks().length}
            Top HR Pickz
          </span>

          <span>
            🔥 Watching
            ${this.getHitPicks().length}
            Top Hit Pickz
          </span>

        </div>

        <div class="live-plays-columns">

          <section
            class="
              live-plays-column
              live-plays-hr-column
            "
          >

            <div class="live-plays-column-header">

              <div>
                <span class="live-column-icon">
                  💣
                </span>

                <div>
                  <small>
                    HOME RUN RESULTS
                  </small>

                  <h3>
                    HR Pickz Hits
                  </h3>
                </div>
              </div>

              <span class="live-column-count">
                ${totalHomeRuns}
              </span>

            </div>

            <p class="live-column-description">
              Home runs by players displayed in the
              Top 20 POPS HR Pickz.
            </p>

            <div class="live-plays-column-list">

              ${
                homeRunEvents.length
                  ? homeRunEvents
                      .map(event =>
                        this.renderEvent(
                          event
                        )
                      )
                      .join("")
                  : this.renderEmptyColumn({
                      type: "homeRun",

                      title:
                        anyLiveGames
                          ? "Watching for HR Pickz"
                          : "Waiting for Games",

                      message:
                        "A Top 20 POPS HR Pick will appear here after hitting a home run."
                    })
              }

            </div>

          </section>

          <section
            class="
              live-plays-column
              live-plays-hit-column
            "
          >

            <div class="live-plays-column-header">

              <div>
                <span class="live-column-icon">
                  🔥
                </span>

                <div>
                  <small>
                    HIT RESULTS
                  </small>

                  <h3>
                    Hit Pickz Hits
                  </h3>
                </div>
              </div>

              <span class="live-column-count">
                ${totalHits}
              </span>

            </div>

            <p class="live-column-description">
              Singles, doubles and triples by players
              displayed in the Top 20 POPS Hit Pickz.
            </p>

            <div class="live-plays-column-list">

              ${
                hitEvents.length
                  ? hitEvents
                      .map(event =>
                        this.renderEvent(
                          event
                        )
                      )
                      .join("")
                  : this.renderEmptyColumn({
                      type: "hit",

                      title:
                        anyLiveGames
                          ? "Watching for Hit Pickz"
                          : "Waiting for Games",

                      message:
                        "A Top 20 POPS Hit Pick will appear here after recording a hit."
                    })
              }

            </div>

          </section>

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

      this.liveEvents.sort(
        (a, b) =>
          b.timestamp -
          a.timestamp
      );

      this.render();
    } catch (error) {
      console.error(
        "POPS Live Plays refresh error:",
        error
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

    this.render();

    this.refresh().catch(error => {
      console.warn(
        "POPS Live Plays initial refresh error:",
        error
      );
    });

    if (this.timer) {
      clearInterval(
        this.timer
      );
    }

    this.timer = setInterval(() => {
      this.refresh().catch(error => {
        console.warn(
          "POPS Live Plays interval error:",
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
      clearInterval(
        this.timer
      );

      this.timer = null;
    }
  },

  /*
  This can be used after the daily picks are rebuilt.
  */

  picksUpdated() {
    this.render();

    this.refresh().catch(error => {
      console.warn(
        "POPS Live Plays pick refresh error:",
        error
      );
    });
  }
};

/*
=========================================================
GLOBAL ACCESS
=========================================================
*/

window.LivePlays =
  LivePlays;

/*
Called by the Live Plays navigation button.
*/

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
Start after app.js has had time to create:

- window.games
- window.hrPicks
- window.hitPicks
*/

document.addEventListener(
  "DOMContentLoaded",
  () => {
    setTimeout(() => {
      LivePlays.start();
    }, 5000);
  }
);
