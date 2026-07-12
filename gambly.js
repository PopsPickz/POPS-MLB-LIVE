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

    console.log(
      `Gambly slip updated: ${
        this.getSelectionCount()
      } pick(s)`
    );
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
