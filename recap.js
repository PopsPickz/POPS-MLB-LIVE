/*
=========================================================
POPS PICKZ — LAST 5 DAYS RECAP
File: recap.js
Version: 1.0
=========================================================
PURPOSE
Displays results from the previous five days for:
- Top 20 Home Run Pickz
- Hit Pickz
- Moneyline Pickz
REQUIRED HTML
<section
  class="card tab-section"
  id="recap"
>
  <h2>📊 POPS Last 5 Days</h2>
  <div id="recapBox">
    <p>Loading recent POPS results...</p>
  </div>
</section>
REQUIRED SCRIPT ORDER
<script src="recap.js"></script>
<script src="app.js"></script>
REQUIRED HISTORY FILES
data/history/YYYY-MM-DD.json
Example:
data/history/2026-07-10.json
data/history/2026-07-09.json
IMPORTANT
The daily history file must save the picks that were shown
on the site before the games started.
Expected arrays:
hrPicks
hitPicks
moneylinePicks
The code also supports several alternate property names.
=========================================================
*/
const Recap = {
  box: null,
  settings: {
    numberOfDays: 5,
    maximumHRPicks: 20,
    maximumHitPicks: 20,
    historyFolder: "data/history",
    mlbScheduleURL:
      "https://statsapi.mlb.com/api/v1/schedule",
    mlbLiveFeedURL:
      "https://statsapi.mlb.com/api/v1.1/game"
  },
  cache: {
    history: {},
    schedules: {},
    liveFeeds: {}
  },
  /*
  =========================================================
  START RECAP
  =========================================================
  */
  async init() {
    this.box = document.getElementById("recapBox");
    if (!this.box) {
      console.warn(
        "POPS Recap: #recapBox was not found."
      );
      return;
    }
    this.renderLoading();
    try {
      const dates = this.getPreviousDates(
        this.settings.numberOfDays
      );
      const dailyRecaps = [];
      for (const date of dates) {
        const recap = await this.buildDailyRecap(date);
        if (recap) {
          dailyRecaps.push(recap);
        }
      }
      this.render(dailyRecaps);
    } catch (error) {
      console.error(
        "POPS Recap loading error:",
        error
      );
      this.renderError(
        "The recent results could not be loaded."
      );
    }
  },
  /*
  =========================================================
  DATE HELPERS
  =========================================================
  */
  getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      date.getDate()
    ).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },
  getPreviousDates(numberOfDays = 5) {
    const dates = [];
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    for (
      let offset = 1;
      offset <= numberOfDays;
      offset++
    ) {
      const date = new Date(now);
      date.setDate(
        now.getDate() - offset
      );
      dates.push(
        this.getLocalDateString(date)
      );
    }
    return dates;
  },
  formatDisplayDate(dateString) {
    const date = new Date(
      `${dateString}T12:00:00`
    );
    if (
      Number.isNaN(date.getTime())
    ) {
      return dateString;
    }
    return date.toLocaleDateString(
      undefined,
      {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      }
    );
  },
  /*
  =========================================================
  GENERAL HELPERS
  =========================================================
  */
  normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  },
  number(value, fallback = 0) {
    const converted = Number(value);
    return Number.isFinite(converted)
      ? converted
      : fallback;
  },
  escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },
  firstArray(...values) {
    for (const value of values) {
      if (Array.isArray(value)) {
        return value;
      }
    }
    return [];
  },
  firstValue(...values) {
    for (const value of values) {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        return value;
      }
    }
    return "";
  },
  uniqueBy(items, keyGetter) {
    const seen = new Set();
    return items.filter(item => {
      const key = keyGetter(item);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  },
  /*
  =========================================================
  FETCH HELPERS
  =========================================================
  */
  async fetchJSON(url) {
    const response = await fetch(
      `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`,
      {
        cache: "no-store"
      }
    );
    if (!response.ok) {
      throw new Error(
        `Request failed: ${response.status} ${url}`
      );
    }
    return response.json();
  },
  async loadHistoryFile(date) {
    if (this.cache.history[date]) {
      return this.cache.history[date];
    }
    const url =
      `${this.settings.historyFolder}/${date}.json`;
    try {
      const data = await this.fetchJSON(url);
      this.cache.history[date] = data;
      return data;
    } catch (error) {
      console.warn(
        `POPS Recap: No history file for ${date}.`,
        error
      );
      return null;
    }
  },
  async loadSchedule(date) {
    if (this.cache.schedules[date]) {
      return this.cache.schedules[date];
    }
    const url =
      `${this.settings.mlbScheduleURL}` +
      `?sportId=1` +
      `&date=${encodeURIComponent(date)}` +
      `&hydrate=team,linescore,probablePitcher`;
    try {
      const schedule =
        await this.fetchJSON(url);
      const games =
        schedule?.dates?.[0]?.games || [];
      this.cache.schedules[date] = games;
      return games;
    } catch (error) {
      console.warn(
        `POPS Recap: Schedule failed for ${date}.`,
        error
      );
      return [];
    }
  },
  async loadLiveFeed(gamePk) {
    if (!gamePk) {
      return null;
    }
    if (this.cache.liveFeeds[gamePk]) {
      return this.cache.liveFeeds[gamePk];
    }
    const url =
      `${this.settings.mlbLiveFeedURL}` +
      `/${gamePk}/feed/live`;
    try {
      const feed = await this.fetchJSON(url);
      this.cache.liveFeeds[gamePk] = feed;
      return feed;
    } catch (error) {
      console.warn(
        `POPS Recap: Live feed failed for game ${gamePk}.`,
        error
      );
      return null;
    }
  },
  /*
  =========================================================
  HISTORY DATA HELPERS
  =========================================================
  */
  getHistoryHRPicks(history) {
    return this.firstArray(
      history?.hrPicks,
      history?.homeRunPicks,
      history?.homerunPicks,
      history?.picks?.hr,
      history?.picks?.homeRuns,
      history?.data?.hrPicks
    ).slice(
      0,
      this.settings.maximumHRPicks
    );
  },
  getHistoryHitPicks(history) {
    return this.firstArray(
      history?.hitPicks,
      history?.hitsPicks,
      history?.picks?.hits,
      history?.picks?.hitPicks,
      history?.data?.hitPicks
    ).slice(
      0,
      this.settings.maximumHitPicks
    );
  },
  getHistoryMoneylinePicks(history) {
    const savedMoneyline =
      this.firstArray(
        history?.moneylinePicks,
        history?.moneyLinePicks,
        history?.moneylines,
        history?.picks?.moneyline,
        history?.picks?.moneylines,
        history?.data?.moneylinePicks
      );
    if (savedMoneyline.length) {
      return savedMoneyline;
    }
    const games = this.firstArray(
      history?.games,
      history?.data?.games
    );
    return games
      .map(game => {
        const selectedTeam =
          this.firstValue(
            game?.moneylinePick,
            game?.moneyLinePick,
            game?.predictedWinner,
            game?.pick,
            game?.winnerPick,
            game?.moneyline?.pick,
            game?.moneyline?.team
          );
        if (!selectedTeam) {
          return null;
        }
        return {
          gamePk:
            this.firstValue(
              game?.gamePk,
              game?.gameId,
              game?.id
            ),
          team: selectedTeam,
          awayTeam:
            this.firstValue(
              game?.awayTeam?.name,
              game?.awayTeam,
              game?.away?.name,
              game?.teams?.away?.team?.name
            ),
          homeTeam:
            this.firstValue(
              game?.homeTeam?.name,
              game?.homeTeam,
              game?.home?.name,
              game?.teams?.home?.team?.name
            )
        };
      })
      .filter(Boolean);
  },
  getPlayerName(pick) {
    return this.firstValue(
      pick?.playerName,
      pick?.name,
      pick?.fullName,
      pick?.player?.fullName,
      pick?.player?.name,
      pick?.batter?.fullName,
      pick?.batter?.name
    );
  },
  getPlayerId(pick) {
    return this.number(
      this.firstValue(
        pick?.playerId,
        pick?.personId,
        pick?.id,
        pick?.player?.id,
        pick?.batter?.id
      ),
      0
    );
  },
  getPickGamePk(pick) {
    return this.number(
      this.firstValue(
        pick?.gamePk,
        pick?.gameId,
        pick?.game?.gamePk,
        pick?.game?.id
      ),
      0
    );
  },
  getPickTeamName(pick) {
    return this.firstValue(
      pick?.teamName,
      pick?.team,
      pick?.team?.name,
      pick?.playerTeam,
      pick?.club
    );
  },
  getMoneylineTeamName(pick) {
    return this.firstValue(
      pick?.teamName,
      pick?.team,
      pick?.pick,
      pick?.selectedTeam,
      pick?.predictedWinner,
      pick?.winner,
      pick?.moneylinePick
    );
  },
  /*
  =========================================================
  GAME MATCHING
  =========================================================
  */
  findScheduleGameForPick(
    pick,
    scheduleGames
  ) {
    const gamePk =
      this.getPickGamePk(pick);
    if (gamePk) {
      const gameById =
        scheduleGames.find(game =>
          Number(game?.gamePk) ===
          Number(gamePk)
        );
      if (gameById) {
        return gameById;
      }
    }
    const teamName =
      this.normalizeText(
        this.getPickTeamName(pick)
      );
    if (!teamName) {
      return null;
    }
    return (
      scheduleGames.find(game => {
        const awayTeam =
          this.normalizeText(
            game?.teams?.away?.team?.name
          );
        const homeTeam =
          this.normalizeText(
            game?.teams?.home?.team?.name
          );
        return (
          awayTeam === teamName ||
          homeTeam === teamName ||
          awayTeam.includes(teamName) ||
          homeTeam.includes(teamName) ||
          teamName.includes(awayTeam) ||
          teamName.includes(homeTeam)
        );
      }) || null
    );
  },
  findScheduleGameForMoneyline(
    pick,
    scheduleGames
  ) {
    const directGame =
      this.findScheduleGameForPick(
        pick,
        scheduleGames
      );
    if (directGame) {
      return directGame;
    }
    const selectedTeam =
      this.normalizeText(
        this.getMoneylineTeamName(pick)
      );
    const awayTeam =
      this.normalizeText(
        this.firstValue(
          pick?.awayTeam?.name,
          pick?.awayTeam,
          pick?.away?.name
        )
      );
    const homeTeam =
      this.normalizeText(
        this.firstValue(
          pick?.homeTeam?.name,
          pick?.homeTeam,
          pick?.home?.name
        )
      );
    return (
      scheduleGames.find(game => {
        const gameAway =
          this.normalizeText(
            game?.teams?.away?.team?.name
          );
        const gameHome =
          this.normalizeText(
            game?.teams?.home?.team?.name
          );
        if (
          awayTeam &&
          homeTeam &&
          gameAway === awayTeam &&
          gameHome === homeTeam
        ) {
          return true;
        }
        return (
          selectedTeam &&
          (
            gameAway === selectedTeam ||
            gameHome === selectedTeam ||
            gameAway.includes(selectedTeam) ||
            gameHome.includes(selectedTeam) ||
            selectedTeam.includes(gameAway) ||
            selectedTeam.includes(gameHome)
          )
        );
      }) || null
    );
  },
  /*
  =========================================================
  GAME STATUS
  =========================================================
  */
  getGameStatus(game) {
    return this.firstValue(
      game?.status?.detailedState,
      game?.status?.abstractGameState,
      game?.status?.codedGameState
    );
  },
  isFinalGame(game) {
    const status =
      this.normalizeText(
        this.getGameStatus(game)
      );
    return (
      status.includes("final") ||
      status.includes("gameover") ||
      status === "f"
    );
  },
  isCancelledGame(game) {
    const status =
      this.normalizeText(
        this.getGameStatus(game)
      );
    return (
      status.includes("postponed") ||
      status.includes("cancelled") ||
      status.includes("canceled") ||
      status.includes("suspended")
    );
  },
  /*
  =========================================================
  PLAYER RESULT HELPERS
  =========================================================
  */
  getAllBoxscorePlayers(feed) {
    const awayPlayers =
      feed?.liveData?.boxscore
        ?.teams?.away?.players || {};
    const homePlayers =
      feed?.liveData?.boxscore
        ?.teams?.home?.players || {};
    return {
      ...awayPlayers,
      ...homePlayers
    };
  },
  findPlayerInFeed(feed, pick) {
    const players =
      this.getAllBoxscorePlayers(feed);
    const playerId =
      this.getPlayerId(pick);
    if (
      playerId &&
      players[`ID${playerId}`]
    ) {
      return players[`ID${playerId}`];
    }
    const pickName =
      this.normalizeText(
        this.getPlayerName(pick)
      );
    if (!pickName) {
      return null;
    }
    return (
      Object.values(players).find(player => {
        const feedName =
          this.normalizeText(
            this.firstValue(
              player?.person?.fullName,
              player?.person?.name
            )
          );
        return (
          feedName === pickName ||
          feedName.includes(pickName) ||
          pickName.includes(feedName)
        );
      }) || null
    );
  },
  getPlayerBattingStats(player) {
    return (
      player?.stats?.batting ||
      player?.seasonStats?.batting ||
      {}
    );
  },
  async gradePlayerPick(
    pick,
    scheduleGames,
    resultType
  ) {
    const playerName =
      this.getPlayerName(pick) ||
      "Unknown Player";
    const game =
      this.findScheduleGameForPick(
        pick,
        scheduleGames
      );
    if (!game) {
      return {
        name: playerName,
        status: "pending",
        symbol: "➖",
        detail: "Game not found"
      };
    }
    if (this.isCancelledGame(game)) {
      return {
        name: playerName,
        status: "void",
        symbol: "➖",
        detail: this.getGameStatus(game)
      };
    }
    if (!this.isFinalGame(game)) {
      return {
        name: playerName,
        status: "pending",
        symbol: "⏳",
        detail: this.getGameStatus(game)
      };
    }
    const feed =
      await this.loadLiveFeed(
        game.gamePk
      );
    if (!feed) {
      return {
        name: playerName,
        status: "pending",
        symbol: "➖",
        detail: "Results unavailable"
      };
    }
    const player =
      this.findPlayerInFeed(feed, pick);
    if (!player) {
      return {
        name: playerName,
        status: "void",
        symbol: "➖",
        detail: "Did not appear"
      };
    }
    const batting =
      this.getPlayerBattingStats(player);
    const atBats =
      this.number(batting?.atBats);
    const plateAppearances =
      this.number(
        this.firstValue(
          batting?.plateAppearances,
          batting?.atBats
        )
      );
    if (
      atBats === 0 &&
      plateAppearances === 0
    ) {
      return {
        name: playerName,
        status: "void",
        symbol: "➖",
        detail: "No plate appearance"
      };
    }
    if (resultType === "homeRun") {
      const homeRuns =
        this.number(batting?.homeRuns);
      const hit = homeRuns > 0;
      return {
        name: playerName,
        status: hit ? "win" : "loss",
        symbol: hit ? "✅" : "❌",
        detail: hit
          ? `${homeRuns} HR`
          : "No HR",
        value: homeRuns
      };
    }
    const hits =
      this.number(batting?.hits);
    const hit = hits > 0;
    return {
      name: playerName,
      status: hit ? "win" : "loss",
      symbol: hit ? "✅" : "❌",
      detail: hit
        ? `${hits} hit${hits === 1 ? "" : "s"}`
        : "No hit",
      value: hits
    };
  },
  /*
  =========================================================
  MONEYLINE RESULTS
  =========================================================
  */
  getTeamScore(game, side) {
    return this.number(
      game?.teams?.[side]?.score
    );
  },
  getWinningTeam(game) {
    if (!this.isFinalGame(game)) {
      return "";
    }
    const awayScore =
      this.getTeamScore(game, "away");
    const homeScore =
      this.getTeamScore(game, "home");
    if (awayScore === homeScore) {
      return "";
    }
    return awayScore > homeScore
      ? game?.teams?.away?.team?.name
      : game?.teams?.home?.team?.name;
  },
  async gradeMoneylinePick(
    pick,
    scheduleGames
  ) {
    const selectedTeam =
      this.getMoneylineTeamName(pick);
    const game =
      this.findScheduleGameForMoneyline(
        pick,
        scheduleGames
      );
    if (!selectedTeam) {
      return {
        name: "Unknown Moneyline Pick",
        status: "void",
        symbol: "➖",
        detail: "Pick missing"
      };
    }
    if (!game) {
      return {
        name: selectedTeam,
        status: "pending",
        symbol: "➖",
        detail: "Game not found"
      };
    }
    if (this.isCancelledGame(game)) {
      return {
        name: selectedTeam,
        status: "void",
        symbol: "➖",
        detail: this.getGameStatus(game)
      };
    }
    if (!this.isFinalGame(game)) {
      return {
        name: selectedTeam,
        status: "pending",
        symbol: "⏳",
        detail: this.getGameStatus(game)
      };
    }
    const winningTeam =
      this.getWinningTeam(game);
    const selectedNormalized =
      this.normalizeText(selectedTeam);
    const winnerNormalized =
      this.normalizeText(winningTeam);
    const won =
      selectedNormalized ===
        winnerNormalized ||
      winnerNormalized.includes(
        selectedNormalized
      ) ||
      selectedNormalized.includes(
        winnerNormalized
      );
    const awayName =
      game?.teams?.away?.team?.name || "Away";
    const homeName =
      game?.teams?.home?.team?.name || "Home";
    const awayScore =
      this.getTeamScore(game, "away");
    const homeScore =
      this.getTeamScore(game, "home");
    return {
      name: selectedTeam,
      status: won ? "win" : "loss",
      symbol: won ? "✅" : "❌",
      detail:
        `${awayName} ${awayScore} — ` +
        `${homeName} ${homeScore}`,
      winner: winningTeam
    };
  },
  /*
  =========================================================
  BUILD DAILY RECAP
  =========================================================
  */
  async buildDailyRecap(date) {
    const history =
      await this.loadHistoryFile(date);
    if (!history) {
      return {
        date,
        missing: true,
        hrResults: [],
        hitResults: [],
        moneylineResults: []
      };
    }
    const scheduleGames =
      await this.loadSchedule(date);
    const hrPicks =
      this.uniqueBy(
        this.getHistoryHRPicks(history),
        pick =>
          this.getPlayerId(pick) ||
          this.normalizeText(
            this.getPlayerName(pick)
          )
      );
    const hitPicks =
      this.uniqueBy(
        this.getHistoryHitPicks(history),
        pick =>
          this.getPlayerId(pick) ||
          this.normalizeText(
            this.getPlayerName(pick)
          )
      );
    const moneylinePicks =
      this.getHistoryMoneylinePicks(
        history
      );
    const hrResults = [];
    for (const pick of hrPicks) {
      hrResults.push(
        await this.gradePlayerPick(
          pick,
          scheduleGames,
          "homeRun"
        )
      );
    }
    const hitResults = [];
    for (const pick of hitPicks) {
      hitResults.push(
        await this.gradePlayerPick(
          pick,
          scheduleGames,
          "hit"
        )
      );
    }
    const moneylineResults = [];
    for (const pick of moneylinePicks) {
      moneylineResults.push(
        await this.gradeMoneylinePick(
          pick,
          scheduleGames
        )
      );
    }
    return {
      date,
      missing: false,
      hrResults,
      hitResults,
      moneylineResults
    };
  },
  /*
  =========================================================
  RECORD CALCULATIONS
  =========================================================
  */
  calculateRecord(results = []) {
    const wins =
      results.filter(
        result =>
          result.status === "win"
      ).length;
    const losses =
      results.filter(
        result =>
          result.status === "loss"
      ).length;
    const voids =
      results.filter(
        result =>
          result.status === "void"
      ).length;
    const pending =
      results.filter(
        result =>
          result.status === "pending"
      ).length;
    const graded = wins + losses;
    const percentage =
      graded > 0
        ? Math.round(
            (wins / graded) * 100
          )
        : 0;
    return {
      wins,
      losses,
      voids,
      pending,
      graded,
      total: results.length,
      percentage
    };
  },
  combineResults(
    dailyRecaps,
    property
  ) {
    return dailyRecaps.flatMap(
      recap =>
        Array.isArray(recap?.[property])
          ? recap[property]
          : []
    );
  },
  getPerformanceClass(percentage) {
    if (percentage >= 70) {
      return "recap-record-good";
    }
    if (percentage >= 55) {
      return "recap-record-average";
    }
    return "recap-record-low";
  },
  /*
  =========================================================
  RENDER HELPERS
  =========================================================
  */
  renderLoading() {
    this.box.innerHTML = `
      <div class="recap-loading">
        <p>📊 Loading the last 5 days...</p>
      </div>
    `;
  },
  renderError(message) {
    this.box.innerHTML = `
      <div class="recap-error">
        <p>⚠️ ${this.escapeHTML(message)}</p>
      </div>
    `;
  },
  renderSummaryCard(
    icon,
    title,
    record
  ) {
    const performanceClass =
      this.getPerformanceClass(
        record.percentage
      );
    return `
      <div class="recap-summary-card">
        <div class="recap-summary-icon">
          ${icon}
        </div>
        <div class="recap-summary-title">
          ${this.escapeHTML(title)}
        </div>
        <div class="recap-summary-record">
          ${record.wins}/${record.graded}
        </div>
        <div
          class="
            recap-summary-percentage
            ${performanceClass}
          "
        >
          ${record.percentage}%
        </div>
      </div>
    `;
  },
  renderResultList(
    title,
    icon,
    results
  ) {
    const record =
      this.calculateRecord(results);
    if (!results.length) {
      return `
        <div class="recap-category">
          <div class="recap-category-header">
            <h4>${icon} ${this.escapeHTML(title)}</h4>
            <span class="recap-category-record">
              No saved picks
            </span>
          </div>
        </div>
      `;
    }
    const rows = results
      .map(result => `
        <div
          class="
            recap-result-row
            recap-result-${this.escapeHTML(
              result.status
            )}
          "
        >
          <div class="recap-result-player">
            <span class="recap-result-symbol">
              ${result.symbol}
            </span>
            <span>
              ${this.escapeHTML(result.name)}
            </span>
          </div>
          <div class="recap-result-detail">
            ${this.escapeHTML(result.detail)}
          </div>
        </div>
      `)
      .join("");
    const extraText = [];
    if (record.voids > 0) {
      extraText.push(
        `${record.voids} void`
      );
    }
    if (record.pending > 0) {
      extraText.push(
        `${record.pending} pending`
      );
    }
    return `
      <div class="recap-category">
        <div class="recap-category-header">
          <h4>
            ${icon} ${this.escapeHTML(title)}
          </h4>
          <span class="recap-category-record">
            ${record.wins}/${record.graded}
            (${record.percentage}%)
          </span>
        </div>
        <div class="recap-result-list">
          ${rows}
        </div>
        ${
          extraText.length
            ? `
              <div class="recap-category-note">
                ${this.escapeHTML(
                  extraText.join(" • ")
                )}
              </div>
            `
            : ""
        }
      </div>
    `;
  },
  renderDailyCard(recap, index) {
    const displayDate =
      this.formatDisplayDate(recap.date);
    if (recap.missing) {
      return `
        <article class="recap-day-card">
          <button
            type="button"
            class="recap-day-button"
            aria-expanded="false"
          >
            <span>
              📅 ${this.escapeHTML(displayDate)}
            </span>
            <span class="recap-day-arrow">
              ▼
            </span>
          </button>
          <div
            class="recap-day-content"
            hidden
          >
            <div class="recap-missing-day">
              No saved POPS picks were found for
              this date.
            </div>
          </div>
        </article>
      `;
    }
    const hrRecord =
      this.calculateRecord(
        recap.hrResults
      );
    const hitRecord =
      this.calculateRecord(
        recap.hitResults
      );
    const moneylineRecord =
      this.calculateRecord(
        recap.moneylineResults
      );
    const openByDefault = index === 0;
    return `
      <article class="recap-day-card">
        <button
          type="button"
          class="recap-day-button"
          aria-expanded="${
            openByDefault
              ? "true"
              : "false"
          }"
        >
          <span>
            📅 ${this.escapeHTML(displayDate)}
          </span>
          <span class="recap-day-preview">
            💣 ${hrRecord.wins}/${hrRecord.graded}
            &nbsp;
            🔥 ${hitRecord.wins}/${hitRecord.graded}
            &nbsp;
            💰 ${moneylineRecord.wins}/${moneylineRecord.graded}
          </span>
          <span class="recap-day-arrow">
            ${openByDefault ? "▲" : "▼"}
          </span>
        </button>
        <div
          class="recap-day-content"
          ${openByDefault ? "" : "hidden"}
        >
          ${this.renderResultList(
            "Home Run Pickz",
            "💣",
            recap.hrResults
          )}
          ${this.renderResultList(
            "Hit Pickz",
            "🔥",
            recap.hitResults
          )}
          ${this.renderResultList(
            "Moneyline Pickz",
            "💰",
            recap.moneylineResults
          )}
        </div>
      </article>
    `;
  },
  /*
  =========================================================
  MAIN RENDER
  =========================================================
  */
  render(dailyRecaps) {
    if (!dailyRecaps.length) {
      this.renderError(
        "No recent recap information was found."
      );
      return;
    }
    const validRecaps =
      dailyRecaps.filter(
        recap => !recap.missing
      );
    const allHRResults =
      this.combineResults(
        validRecaps,
        "hrResults"
      );
    const allHitResults =
      this.combineResults(
        validRecaps,
        "hitResults"
      );
    const allMoneylineResults =
      this.combineResults(
        validRecaps,
        "moneylineResults"
      );
    const hrRecord =
      this.calculateRecord(
        allHRResults
      );
    const hitRecord =
      this.calculateRecord(
        allHitResults
      );
    const moneylineRecord =
      this.calculateRecord(
        allMoneylineResults
      );
    const dailyCards =
      dailyRecaps
        .map((recap, index) =>
          this.renderDailyCard(
            recap,
            index
          )
        )
        .join("");
    this.box.innerHTML = `
      <div class="recap-wrapper">
        <div class="recap-intro">
          <h3>📈 POPS Last 5 Days</h3>
          <p>
            Recent results from the POPS Home Run,
            Hit and Moneyline pick lists.
          </p>
        </div>
        <div class="recap-summary-grid">
          ${this.renderSummaryCard(
            "💣",
            "Home Runs",
            hrRecord
          )}
          ${this.renderSummaryCard(
            "🔥",
            "Hits",
            hitRecord
          )}
          ${this.renderSummaryCard(
            "💰",
            "Moneyline",
            moneylineRecord
          )}
        </div>
        <div class="recap-days">
          ${dailyCards}
        </div>
      </div>
    `;
    this.activateDailyCards();
  },
  activateDailyCards() {
    const buttons =
      this.box.querySelectorAll(
        ".recap-day-button"
      );
    buttons.forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const card =
            button.closest(
              ".recap-day-card"
            );
          const content =
            card?.querySelector(
              ".recap-day-content"
            );
          const arrow =
            button.querySelector(
              ".recap-day-arrow"
            );
          if (!content) {
            return;
          }
          const isOpen =
            !content.hasAttribute(
              "hidden"
            );
          if (isOpen) {
            content.setAttribute(
              "hidden",
              ""
            );
            button.setAttribute(
              "aria-expanded",
              "false"
            );
            if (arrow) {
              arrow.textContent = "▼";
            }
          } else {
            content.removeAttribute(
              "hidden"
            );
            button.setAttribute(
              "aria-expanded",
              "true"
            );
            if (arrow) {
              arrow.textContent = "▲";
            }
          }
        }
      );
    });
  }
};
/*
=========================================================
AUTOMATIC START
=========================================================
*/
document.addEventListener(
  "DOMContentLoaded",
  () => {
    Recap.init();
  }
);
