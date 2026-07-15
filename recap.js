/*
=========================================================
POPS PICKZ — PREVIOUS DAY RECAP
File: recap.js
Version: 2.0
Design: Option 3
=========================================================

Displays the previous day's finalized:

- HR Pickz Results
- Hit Pickz Results
- HR Success Percentage
- Hit Success Percentage

EXPECTED SAVED KEY

pops-live-results-YYYY-MM-DD

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
    Noon prevents daylight-saving and midnight issues.
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

  getDateObject(dateKey) {
    const parts =
      String(dateKey)
        .split("-")
        .map(Number);

    if (
      parts.length !== 3 ||
      parts.some(part =>
        !Number.isFinite(part)
      )
    ) {
      return null;
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
      return null;
    }

    return date;
  },

  getDisplayDate(dateKey) {
    const date =
      this.getDateObject(
        dateKey
      );

    if (!date) {
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

  getShortMonth(dateKey) {
    const date =
      this.getDateObject(
        dateKey
      );

    if (!date) {
      return "";
    }

    return date
      .toLocaleDateString(
        [],
        {
          month: "short"
        }
      )
      .toUpperCase();
  },

  getDayNumber(dateKey) {
    const date =
      this.getDateObject(
        dateKey
      );

    return date
      ? date.getDate()
      : "";
  },

  getYear(dateKey) {
    const date =
      this.getDateObject(
        dateKey
      );

    return date
      ? date.getFullYear()
      : "";
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
        : this.settings.maximumHRPicks;

    const hitTracked =
      savedHitTracked > 0
        ? savedHitTracked
        : this.settings.maximumHitPicks;

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
  BUILD RECAP HEADER
  =======================================================
  */

  buildHeader(dateKey) {
    const safeDate =
      this.escapeHTML(
        this.getDisplayDate(
          dateKey
        )
      );

    const month =
      this.escapeHTML(
        this.getShortMonth(
          dateKey
        )
      );

    const day =
      this.escapeHTML(
        this.getDayNumber(
          dateKey
        )
      );

    const year =
      this.escapeHTML(
        this.getYear(
          dateKey
        )
      );

    return `
      <div class="recap-premium-header">

        <div class="recap-heading-group">

          <div class="recap-heading-icon">
            📊
          </div>

          <div>
            <div class="recap-kicker">
              DAILY RESULTS
            </div>

            <h2>
              Yesterday's
              <span>POPS Recap</span>
            </h2>
          </div>

        </div>

        <div class="recap-date-badge">

          <span class="recap-calendar-icon">
            📅
          </span>

          <div>
            <strong>
              ${month} ${day}
            </strong>

            <small>
              ${year}
            </small>
          </div>

        </div>

      </div>

      <p class="recap-date-description">
        Final results from ${safeDate}
      </p>
    `;
  },

  /*
  =======================================================
  BUILD RESULTS SECTION
  =======================================================
  */

  buildResultsSection(results) {
    return `
      <section class="recap-results-panel">

        <div class="recap-section-heading">

          <span></span>

          <h3>
            POPS PICKZ RESULTS
          </h3>

          <span></span>

        </div>

        <div class="recap-result-list">

          <article class="
            recap-result-row
            recap-result-row-hr
          ">

            <div class="
              recap-result-icon
              recap-result-icon-hr
            ">
              ⚾
            </div>

            <div class="recap-result-copy">

              <strong>
                HR PICKZ RESULTS
              </strong>

              <span>
                Home runs
              </span>

            </div>

            <div class="
              recap-result-total
              recap-result-total-hr
            ">
              ${results.hrResults}
            </div>

          </article>

          <article class="
            recap-result-row
            recap-result-row-hit
          ">

            <div class="
              recap-result-icon
              recap-result-icon-hit
            ">
              🎯
            </div>

            <div class="recap-result-copy">

              <strong>
                HIT PICKZ RESULTS
              </strong>

              <span>
                All hits
              </span>

            </div>

            <div class="
              recap-result-total
              recap-result-total-hit
            ">
              ${results.hitResults}
            </div>

          </article>

        </div>

      </section>
    `;
  },

  /*
  =======================================================
  BUILD SUCCESS SUMMARY
  =======================================================
  */

  buildSuccessSummary(results) {
    return `
      <section class="recap-success-section">

        <div class="recap-section-heading">

          <span></span>

          <h3>
            SUCCESS SUMMARY
          </h3>

          <span></span>

        </div>

        <div class="recap-success-grid">

          <article class="
            recap-success-card
            recap-success-card-hr
          ">

            <span class="recap-success-label">
              HR SUCCESS
            </span>

            <strong>
              ${results.hrSuccess}%
            </strong>

            <small>
              ${results.hrResults}
              of
              ${results.hrTracked}
            </small>

          </article>

          <article class="
            recap-success-card
            recap-success-card-hit
          ">

            <span class="recap-success-label">
              HIT SUCCESS
            </span>

            <strong>
              ${results.hitSuccess}%
            </strong>

            <small>
              ${results.hitResults}
              of
              ${results.hitTracked}
            </small>

          </article>

        </div>

      </section>
    `;
  },

  /*
  =======================================================
  BUILD FOOTER MESSAGE
  =======================================================
  */

  buildFooterMessage() {
    return `
      <div class="recap-footer-message">

        <div class="recap-footer-icon">
          📈
        </div>

        <p>
          Every pick. Every day.
          <strong>
            We track. You win.
          </strong>
        </p>

      </div>
    `;
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

    const dateKey =
      this.getPreviousDateKey();

    this.box.innerHTML = `
      <div class="
        recap-dashboard
        recap-loading-dashboard
      ">

        ${this.buildHeader(
          dateKey
        )}

        <div class="recap-loading-panel">

          <div class="recap-loading-spinner">
          </div>

          <strong>
            Loading yesterday's results
          </strong>

          <p>
            Checking saved POPS Pickz results...
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

    const emptyResults = {
      hrResults: 0,
      hitResults: 0,
      hrTracked:
        this.settings.maximumHRPicks,
      hitTracked:
        this.settings.maximumHitPicks,
      hrSuccess: 0,
      hitSuccess: 0
    };

    this.box.innerHTML = `
      <div class="recap-dashboard">

        ${this.buildHeader(
          dateKey
        )}

        <div class="recap-no-results">

          <div class="recap-no-results-icon">
            📭
          </div>

          <h3>
            No saved recap available
          </h3>

          <p>
            Yesterday's finalized results
            have not been saved yet.
          </p>

        </div>

        ${this.buildResultsSection(
          emptyResults
        )}

        ${this.buildSuccessSummary(
          emptyResults
        )}

        ${this.buildFooterMessage()}

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

    this.box.innerHTML = `
      <div class="recap-dashboard">

        ${this.buildHeader(
          results.date
        )}

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

        ${this.buildResultsSection(
          results
        )}

        ${this.buildSuccessSummary(
          results
        )}

        ${this.buildFooterMessage()}

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
          <div class="recap-dashboard">

            <div class="recap-error-panel">

              <div class="recap-error-icon">
                ⚠️
              </div>

              <h3>
                Recap could not load
              </h3>

              <p>
                ${this.escapeHTML(
                  error.message
                )}
              </p>

            </div>

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