/*
=========================================================
POPS PICKZ — GAMBLY SLIP BUILDER
File: gambly.js
Version: 1.0
=========================================================

PURPOSE

Allows users to:

- Add multiple POPS Pickz
- Build a parlay list
- Remove individual picks
- Clear the complete slip
- Save selections during page refreshes
- Copy selections for Gambly Bot

IMPORTANT

This first version does not use a private Gambly API.

It safely creates the parlay text, copies it, and can later
open Gambly Bot for the user.

=========================================================
*/

const Gambly = {
  /*
  =======================================================
  SETTINGS
  =======================================================
  */

  settings: {
    storageKey: "pops-gambly-slip",
    maximumSelections: 20
  },

  /*
  =======================================================
  CURRENT SLIP
  =======================================================
  */

  selections: [],

  /*
  =======================================================
  GENERAL HELPERS
  =======================================================
  */

  cleanText(value = "") {
    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  },

  createId(pick = {}) {
    const playerId =
      pick.playerId ||
      pick.id ||
      pick.personId ||
      "";

    const playerName =
      pick.playerName ||
      pick.name ||
      pick.team ||
      "";

    const market =
      pick.market ||
      pick.pickType ||
      pick.type ||
      "";

    const game =
      pick.gamePk ||
      pick.gameId ||
      pick.game ||
      "";

    return [
      playerId || playerName,
      market,
      game
    ]
      .map(value =>
        this.cleanText(value).toLowerCase()
      )
      .filter(Boolean)
      .join("-");
  },

  normalizePick(pick = {}) {
    const normalized = {
      id: "",

      playerId:
        pick.playerId ||
        pick.personId ||
        pick.id ||
        "",

      playerName: this.cleanText(
        pick.playerName ||
        pick.name ||
        ""
      ),

      team: this.cleanText(
        pick.team ||
        pick.teamName ||
        ""
      ),

      opponent: this.cleanText(
        pick.opponent ||
        pick.opponentName ||
        ""
      ),

      market: this.cleanText(
        pick.market ||
        pick.pickType ||
        pick.type ||
        "POPS Pick"
      ),

      selection: this.cleanText(
        pick.selection ||
        pick.bet ||
        pick.play ||
        ""
      ),

      game: this.cleanText(
        pick.game ||
        pick.matchup ||
        ""
      ),

      gamePk:
        pick.gamePk ||
        pick.gameId ||
        "",

      odds: this.cleanText(
        pick.odds ||
        ""
      ),

      source: this.cleanText(
        pick.source ||
        "POPS Pickz"
      ),

      addedAt: new Date().toISOString()
    };

    normalized.id = this.createId(normalized);

    return normalized;
  },

  /*
  =======================================================
  LOCAL STORAGE
  =======================================================
  */

  loadSavedSelections() {
    try {
      const saved = localStorage.getItem(
        this.settings.storageKey
      );

      if (!saved) {
        this.selections = [];
        return;
      }

      const parsed = JSON.parse(saved);

      this.selections = Array.isArray(parsed)
        ? parsed
        : [];
    } catch (error) {
      console.warn(
        "POPS Gambly could not load saved selections:",
        error
      );

      this.selections = [];
    }
  },

  saveSelections() {
    try {
      localStorage.setItem(
        this.settings.storageKey,
        JSON.stringify(this.selections)
      );
    } catch (error) {
      console.warn(
        "POPS Gambly could not save selections:",
        error
      );
    }
  },

  /*
  =======================================================
  CHECK SELECTION
  =======================================================
  */

  hasPick(pickOrId) {
    const id =
      typeof pickOrId === "string"
        ? pickOrId
        : this.createId(
            this.normalizePick(pickOrId)
          );

    return this.selections.some(
      pick => pick.id === id
    );
  },

  getSelectionCount() {
    return this.selections.length;
  },

  getSelections() {
    return [...this.selections];
  },

  /*
  =======================================================
  ADD PICK
  =======================================================
  */

  addPick(pick = {}) {
    const normalized = this.normalizePick(pick);

    if (!normalized.id) {
      console.warn(
        "POPS Gambly could not add the pick.",
        pick
      );

      return {
        success: false,
        reason: "invalid-pick"
      };
    }

    if (this.hasPick(normalized.id)) {
      return {
        success: false,
        reason: "duplicate",
        pick: normalized
      };
    }

    if (
      this.selections.length >=
      this.settings.maximumSelections
    ) {
      return {
        success: false,
        reason: "maximum-reached",
        maximum:
          this.settings.maximumSelections
      };
    }

    this.selections.push(normalized);

    this.saveSelections();

    this.onSlipChanged();

    return {
      success: true,
      pick: normalized,
      count: this.getSelectionCount()
    };
  },

  /*
  =======================================================
  REMOVE PICK
  =======================================================
  */

  removePick(pickOrId) {
    const id =
      typeof pickOrId === "string"
        ? pickOrId
        : this.createId(
            this.normalizePick(pickOrId)
          );

    const originalLength =
      this.selections.length;

    this.selections =
      this.selections.filter(
        pick => pick.id !== id
      );

    const removed =
      this.selections.length <
      originalLength;

    if (removed) {
      this.saveSelections();
      this.onSlipChanged();
    }

    return removed;
  },

  /*
  =======================================================
  CLEAR SLIP
  =======================================================
  */

  clearSlip() {
    this.selections = [];

    this.saveSelections();

    this.onSlipChanged();

    return true;
  },

  /*
  =======================================================
  SLIP CHANGE EVENT
  =======================================================
  */

  onSlipChanged() {
    window.dispatchEvent(
      new CustomEvent(
        "pops-gambly-slip-changed",
        {
          detail: {
            count: this.getSelectionCount(),
            selections: this.getSelections()
          }
        }
      )
    );

    this.render();
    
    console.log(
      `Gambly slip updated: ${
        this.getSelectionCount()
      } pick(s)`
    );
  },

/*
  =======================================================
  DISPLAY HELPERS
  =======================================================
  */

  escapeHTML(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  getPickTitle(pick = {}) {
    if (pick.selection) {
      return pick.selection;
    }

    if (pick.playerName && pick.market) {
      return `${pick.playerName} — ${pick.market}`;
    }

    if (pick.team && pick.market) {
      return `${pick.team} — ${pick.market}`;
    }

    return (
      pick.playerName ||
      pick.team ||
      pick.market ||
      "POPS Pick"
    );
  },

  /*
  =======================================================
  BUILD GAMBLY MESSAGE
  =======================================================
  */

  buildMessage() {
    if (!this.selections.length) {
      return "";
    }

    const lines = this.selections.map(
      (pick, index) => {
        const title = this.getPickTitle(pick);

        const gameText = pick.game
          ? ` | ${pick.game}`
          : "";

        const oddsText = pick.odds
          ? ` | ${pick.odds}`
          : "";

        return `${
          index + 1
        }. ${title}${gameText}${oddsText}`;
      }
    );

    return [
      `Build this ${this.selections.length}-leg parlay:`,
      "",
      ...lines,
      "",
      "Created with POPS Pickz"
    ].join("\n");
  },

  /*
  =======================================================
  COPY PICKS
  =======================================================
  */

  async copySlip() {
    const message = this.buildMessage();

    if (!message) {
      this.showNotice(
        "Add at least one pick first.",
        "warning"
      );

      return false;
    }

    try {
      await navigator.clipboard.writeText(message);

      this.showNotice(
        "Gambly parlay copied.",
        "success"
      );

      return true;
    } catch (error) {
      console.warn(
        "Clipboard copy failed:",
        error
      );

      const textArea =
        document.createElement("textarea");

      textArea.value = message;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";

      document.body.appendChild(textArea);

      textArea.focus();
      textArea.select();

      const copied =
        document.execCommand("copy");

      textArea.remove();

      this.showNotice(
        copied
          ? "Gambly parlay copied."
          : "Could not copy the parlay.",
        copied ? "success" : "warning"
      );

      return copied;
    }
  },

  /*
  =======================================================
  OPEN GAMBLY
  =======================================================
  */

  async openGambly() {
    if (!this.selections.length) {
      this.showNotice(
        "Add at least one pick first.",
        "warning"
      );

      return;
    }

    await this.copySlip();

    /*
    Replace this URL later if Gambly gives you a special
    partner, bot, affiliate, or deep-link URL.
    */

    const gamblyURL = "https://gambly.com";

    window.open(
      gamblyURL,
      "_blank",
      "noopener,noreferrer"
    );
  },

  /*
  =======================================================
  NOTIFICATION
  =======================================================
  */

  showNotice(message, type = "success") {
    const notice =
      document.getElementById(
        "gamblyNotice"
      );

    if (!notice) {
      return;
    }

    notice.textContent = message;

    notice.className =
      `gambly-notice ${type} show`;

    clearTimeout(this.noticeTimer);

    this.noticeTimer = setTimeout(() => {
      notice.classList.remove("show");
    }, 2500);
  },

  /*
  =======================================================
  RENDER SLIP PANEL
  =======================================================
  */

  render() {
    const box =
      document.getElementById(
        "gamblyBox"
      );

    if (!box) {
      return;
    }

    const count =
      this.getSelectionCount();

    if (!count) {
      box.innerHTML = `
        <div class="gambly-slip-card">
          <div class="gambly-slip-header">
            <div>
              <h2>🤖 Gambly Slip</h2>

              <p>
                Add POPS Pickz to create your parlay.
              </p>
            </div>

            <span class="gambly-count">
              0 Picks
            </span>
          </div>

          <div class="gambly-empty">
            <div class="gambly-empty-icon">
              🤖
            </div>

            <h3>Your slip is empty</h3>

            <p>
              Tap “Add to Gambly” on any POPS pick.
            </p>
          </div>

          <div
            id="gamblyNotice"
            class="gambly-notice"
          ></div>
        </div>
      `;

      return;
    }

    const selectionsHTML =
      this.selections
        .map((pick, index) => {
          const title =
            this.escapeHTML(
              this.getPickTitle(pick)
            );

          const game =
            this.escapeHTML(
              pick.game || ""
            );

          const odds =
            this.escapeHTML(
              pick.odds || ""
            );

          return `
            <div class="gambly-pick">
              <div class="gambly-pick-number">
                ${index + 1}
              </div>

              <div class="gambly-pick-info">
                <strong>${title}</strong>

                ${
                  game
                    ? `<span>${game}</span>`
                    : ""
                }

                ${
                  odds
                    ? `<small>${odds}</small>`
                    : ""
                }
              </div>

              <button
                type="button"
                class="gambly-remove-button"
                onclick="Gambly.removePick(
                  '${this.escapeHTML(pick.id)}'
                )"
                aria-label="Remove pick"
              >
                ✕
              </button>
            </div>
          `;
        })
        .join("");

    box.innerHTML = `
      <div class="gambly-slip-card">
        <div class="gambly-slip-header">
          <div>
            <h2>🤖 Gambly Slip</h2>

            <p>
              Review your POPS Pickz parlay.
            </p>
          </div>

          <span class="gambly-count">
            ${count}
            ${count === 1 ? "Pick" : "Picks"}
          </span>
        </div>

        <div class="gambly-picks-list">
          ${selectionsHTML}
        </div>

        <div class="gambly-actions">
          <button
            type="button"
            class="gambly-clear-button"
            onclick="Gambly.clearSlip()"
          >
            Clear Slip
          </button>

          <button
            type="button"
            class="gambly-copy-button"
            onclick="Gambly.copySlip()"
          >
            📋 Copy Picks
          </button>

          <button
            type="button"
            class="gambly-open-button"
            onclick="Gambly.openGambly()"
          >
            🤖 Send to Gambly
          </button>
        </div>

        <div
          id="gamblyNotice"
          class="gambly-notice"
        ></div>
      </div>
    `;
  },
  
  /*
  =======================================================
  START GAMBLY
  =======================================================
  */

  init() {
    this.loadSavedSelections();

    console.log(
      `POPS Gambly loaded with ${
        this.getSelectionCount()
      } saved pick(s).`
    );

    this.onSlipChanged();
  }
};

/*
=========================================================
AUTOMATIC START
=========================================================
*/

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => Gambly.init()
  );
} else {
  Gambly.init();
}
