/*
=========================================================
POPS PICKZ — PREVIOUS DAY RECAP
File: recap.js
Version: 1.0
=========================================================

PURPOSE

Displays only the previous day's finalized:

- HR Pickz Results
- Hit Pickz Results
- HR Success Percentage
- Hit Success Percentage

It does not show:

- Total Results
- Unique Players
- Individual player cards
- Live updates

EXPECTED SAVED KEY

pops-live-results-YYYY-MM-DD

Example:

pops-live-results-2026-07-11

The module also checks:

data/history/YYYY-MM-DD.json

=========================================================
*/

const Recap = {
  box: null,

  settings: {
    maximumHRPicks: 20,
    maximumHitPicks: 20,

    storagePrefix:
      "pops-live-results-",

    historyFolder:
      "data/history"
  },

  /*
  =======================================================
  GENERAL HELPERS
  =======================================================
  */

  number(value, fallback = 0) {
    const converted =
      Number(value);

    return Number.isFinite(converted)
      ? converted
      : fallback;
  },

  escapeHTML(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  percentage(results, total) {
    const safeResults =
      this.number(results);

    const safeTotal =
      this.number(total);

    if (safeTotal <= 0) {
      return 0;
    }

    return Math.round(
      (safeResults / safeTotal) * 100
    );
  },

  /*
  =======================================================
  DATE HELPERS
  =======================================================
  */

  formatDateKey(date) {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  },

  getPreviousDateKey() {
    const date =
      new Date();

    /*
    Noon prevents daylight-saving or midnight issues.
    */

    date.setHours(
      12,
      0,
      0,
      0
    );

    date.setDate(
      date.getDate() - 1
    );

    return this.formatDateKey(
      date
    );
  },

  getDisplayDate(dateKey) {
    const parts =
      String(dateKey)
        .split("-")
        .map(Number);

    if (parts.length !== 3) {
      return dateKey;
    }

    const date =
      new Date(
        parts[0],
        parts[1] - 1,
        parts[2],
        12,
        0,
        0
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return dateKey;
    }

    return date.toLocaleDateString(
      [],
      {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      }
    );
  },

  /*
  =======================================================
  DATA FIELD HELPERS
  =======================================================
  */

  getValue(
    objects = [],
    names = [],
    fallback = 0
  ) {
    for (const object of objects) {
      if (
        !object ||
        typeof object !== "object"
      ) {
        continue;
      }

      for (const name of names) {
        const value =
          object[name];

        if (
          value !== undefined &&
          value !== null &&
          value !== ""
        ) {
          return value;
        }
      }
    }

    return fallback;
  },

  getArray(
    objects = [],
    names = []
  ) {
    for (const object of objects) {
      if (
        !object ||
        typeof object !== "object"
      ) {
        continue;
      }

      for (const name of names) {
        if (
          Array.isArray(
            object[name]
          )
        ) {
          return object[name];
        }
      }
    }

    return [];
  },

  playerRecordedHit(player = {}) {
    const hits =
      this.number(
        player.hits ??
        player.hitCount ??
        player.gameHits ??
        player.results?.hits
      );

    return (
      hits > 0 ||
      player.hit === true ||
      player.didHit === true ||
      player.success === true ||
      player.result === "hit" ||
      player.status === "hit"
    );
  },

  playerRecordedHomeRun(
    player = {}
  ) {
    const homeRuns =
      this.number(
        player.homeRuns ??
        player.hr ??
        player.gameHomeRuns ??
        player.results?.homeRuns
      );

    return (
      homeRuns > 0 ||
      player.homered === true ||
      player.didHomer === true ||
      player.homeRun === true ||
      player.result === "hr" ||
      player.result === "home-run" ||
      player.status === "home-run"
    );
  },

  /*
  =======================================================
  NORMALIZE SAVED RESULTS
  =======================================================
  */

  normalizeResults(
    data = {},
    dateKey = ""
  ) {
    const summary =
      data.summary ||
      data.results ||
      data.totals ||
      {};

    const objects = [
      summary,
      data
    ];

    const hrPicks =
      this.getArray(
        objects,
        [
          "hrPicks",
          "hrResults",
          "homeRunPicks",
          "homerunPicks"
        ]
      );

    const hitPicks =
      this.getArray(
        objects,
        [
          "hitPicks",
          "hitResults",
          "hitsPicks"
        ]
      );

    const calculatedHRResults =
      hrPicks.filter(player =>
        this.playerRecordedHomeRun(
          player
        )
      ).length;

    const calculatedHitResults =
      hitPicks.filter(player =>
        this.playerRecordedHit(
          player
        )
      ).length;

    const hrResults =
      this.number(
        this.getValue(
          objects,
          [
            "successfulHRPicks",
            "hrPickResults",
            "hrHits",
            "homeRunsHit",
            "homeRuns",
            "hrResults"
          ],
          calculatedHRResults
        )
      );

    const hitResults =
      this.number(
        this.getValue(
          objects,
          [
            "successfulHitPicks",
            "hitPickResults",
            "playersWithHits",
            "allHits",
            "hits",
            "hitResults"
          ],
          calculatedHitResults
        )
      );

    const savedHRTracked =
      this.number(
        this.getValue(
          objects,
          [
            "hrTracked",
            "totalHRPicks",
            "hrPicksTracked",
            "hrTotal"
          ],
          hrPicks.length
        )
      );

    const savedHitTracked =
      this.number(
        this.getValue(
          objects,
          [
            "hitTracked",
            "totalHitPicks",
            "hitPicksTracked",
            "hitTotal"
          ],
          hitPicks.length
        )
      );

    const hrTracked =
      savedHRTracked > 0
        ? savedHRTracked
        : this.settings
            .maximumHRPicks;

    const hitTracked =
      savedHitTracked > 0
        ? savedHitTracked
        : this.settings
            .maximumHitPicks;

    return {
      date:
        data.date ||
        data.resultsDate ||
        data.gameDate ||
        dateKey,

      hrResults,

      hitResults,

      hrTracked,

      hitTracked,

      hrSuccess:
        this.percentage(
          hrResults,
          hrTracked
        ),

      hitSuccess:
        this.percentage(
          hitResults,
          hitTracked
        )
    };
  },

  /*
  =======================================================
  LOAD FROM LOCAL STORAGE
  =======================================================
  */

  loadFromStorage(dateKey) {
    const possibleKeys = [
      `${this.settings.storagePrefix}${dateKey}`,

      `pops-liveplays-results-${dateKey}`,

      `pops-live-plays-${dateKey}`,

      `pops-daily-results-${dateKey}`,

      `pops-recap-${dateKey}`
    ];

    for (const key of possibleKeys) {
      try {
        const saved =
          localStorage.getItem(
            key
          );

        if (!saved) {
          continue;
        }

        const parsed =
          JSON.parse(saved);

        if (
          parsed &&
          typeof parsed === "object"
        ) {
          console.log(
            `📊 POPS Recap loaded from ${key}.`
          );

          return parsed;
        }
      } catch (error) {
        console.warn(
          `POPS Recap could not read ${key}:`,
          error
        );
      }
    }

    return null;
  },

  /*
  =======================================================
  LOAD FROM HISTORY FILE
  =======================================================
  */

  async loadFromHistoryFile(
    dateKey
  ) {
    const path =
      `${this.settings.historyFolder}/${dateKey}.json`;

    try {
      const response =
        await fetch(
          `${path}?_=${Date.now()}`,
          {
            cache: "no-store"
          }
        );

      if (!response.ok) {
        return null;
      }

      const data =
        await response.json();

      console.log(
        `📊 POPS Recap loaded ${path}.`
      );

      return data;
    } catch (error) {
      console.warn(
        "POPS Recap history file unavailable:",
        error
      );

      return null;
    }
  },

  /*
  =======================================================
  RENDER LOADING
  =======================================================
  */

  renderLoading() {
    if (!this.box) {
      return;
    }

    this.box.innerHTML = `
      <div class="recap-card">
        <div class="recap-header">
          <h2>
            📊 Yesterday's POPS Recap
          </h2>

          <p>
            Loading the previous day's
            finalized results...
          </p>
        </div>
      </div>
    `;
  },

  /*
  =======================================================
  RENDER NO RESULTS
  =======================================================
  */

  renderNoResults(dateKey) {
    if (!this.box) {
      return;
    }

    const displayDate =
      this.escapeHTML(
        this.getDisplayDate(
          dateKey
        )
      );

    this.box.innerHTML = `
      <div class="recap-card">

        <div class="recap-header">

          <h2>
            📊 Yesterday's POPS Recap
          </h2>

          <p>
            Results for ${displayDate}
          </p>

        </div>

        <div class="recap-no-results">

          <h3>
            No saved recap is available
          </h3>

          <p>
            Yesterday's finalized results
            have not been saved yet.
          </p>

        </div>

        ${this.buildStatsGrid({
          hrResults: 0,
          hitResults: 0,
          hrTracked: 20,
          hitTracked: 20,
          hrSuccess: 0,
          hitSuccess: 0
        })}

      </div>
    `;
  },

  /*
  =======================================================
  BUILD STATS GRID
  =======================================================
  */

  buildStatsGrid(results) {
    return `
      <div class="recap-results-grid">

        <div class="
          recap-stat-box
          recap-hr-result
        ">

          <div class="recap-stat-title">
            HR PICKZ RESULTS
          </div>

          <div class="
            recap-stat-number
            recap-red-number
          ">
            ${results.hrResults}
          </div>

          <div class="recap-stat-label">
            Home runs
          </div>

        </div>

        <div class="
          recap-stat-box
          recap-hit-result
        ">

          <div class="recap-stat-title">
            HIT PICKZ RESULTS
          </div>

          <div class="
            recap-stat-number
            recap-orange-number
          ">
            ${results.hitResults}
          </div>

          <div class="recap-stat-label">
            All hits
          </div>

        </div>

        <div class="
          recap-stat-box
          recap-hr-success
        ">

          <div class="recap-stat-title">
            HR SUCCESS
          </div>

          <div class="
            recap-stat-number
            recap-red-number
          ">
            ${results.hrSuccess}%
          </div>

          <div class="recap-stat-label">
            ${results.hrResults}
            of
            ${results.hrTracked}
          </div>

        </div>

        <div class="
          recap-stat-box
          recap-hit-success
        ">

          <div class="recap-stat-title">
            HIT SUCCESS
          </div>

          <div class="
            recap-stat-number
            recap-orange-number
          ">
            ${results.hitSuccess}%
          </div>

          <div class="recap-stat-label">
            ${results.hitResults}
            of
            ${results.hitTracked}
          </div>

        </div>

      </div>
    `;
  },

  /*
  =======================================================
  RENDER RESULTS
  =======================================================
  */

  renderResults(results) {
    if (!this.box) {
      return;
    }

    const displayDate =
      this.escapeHTML(
        this.getDisplayDate(
          results.date
        )
      );

    this.box.innerHTML = `
      <div class="recap-card">

        <div class="recap-header">

          <h2>
            📊 Yesterday's POPS Recap
          </h2>

          <p>
            Final results from
            ${displayDate}
          </p>

        </div>

        <div class="recap-final-status">

          <span class="recap-status-dot">
          </span>

          <div>
            <strong>
              Results finalized
            </strong>

            <small>
              Previous day's POPS Pickz
            </small>
          </div>

        </div>

        ${this.buildStatsGrid(
          results
        )}

      </div>
    `;
  },

  /*
  =======================================================
  LOAD RECAP
  =======================================================
  */

  async load() {
    this.box =
      document.getElementById(
        "recapBox"
      );

    if (!this.box) {
      console.warn(
        "POPS Recap: #recapBox was not found."
      );

      return;
    }

    this.renderLoading();

    const dateKey =
      this.getPreviousDateKey();

    let data =
      this.loadFromStorage(
        dateKey
      );

    if (!data) {
      data =
        await this.loadFromHistoryFile(
          dateKey
        );
    }

    if (!data) {
      this.renderNoResults(
        dateKey
      );

      return;
    }

    const results =
      this.normalizeResults(
        data,
        dateKey
      );

    this.renderResults(
      results
    );
  },

  /*
  =======================================================
  START RECAP
  =======================================================
  */

  init() {
    this.load().catch(error => {
      console.error(
        "POPS Recap loading error:",
        error
      );

      if (this.box) {
        this.box.innerHTML = `
          <div class="recap-card">
            <h3>
              ⚠️ Recap could not load
            </h3>

            <p>
              ${this.escapeHTML(
                error.message
              )}
            </p>
          </div>
        `;
      }
    });
  }
};

/*
=========================================================
AUTOMATIC START
=========================================================
*/

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    () => Recap.init()
  );
} else {
  Recap.init();
}

/*
=========================================================
MAKE GLOBAL
=========================================================
*/

window.Recap =
  Recap;
