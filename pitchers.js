const Pitchers = {
  box: null,

  /*
  =========================================================
  PITCHER RISK DISPLAY
  =========================================================
  */

  getTier(risk) {
    if (risk >= 95) return "💀 EXTREME DANGER";
    if (risk >= 90) return "💣 ELITE HR TARGET";
    if (risk >= 85) return "🔥 VERY HIGH HR RISK";
    if (risk >= 80) return "🔴 HIGH HR RISK";
    if (risk >= 75) return "🟠 STRONG HR RISK";
    if (risk >= 65) return "🟡 MODERATE HR RISK";

    return "🟢 LOW HR RISK";
  },

  getColorClass(risk) {
    if (risk >= 90) return "elite";
    if (risk >= 80) return "red";
    if (risk >= 70) return "orange";
    if (risk >= 60) return "gold";

    return "green";
  },

  /*
  =========================================================
  GENERAL HELPERS
  =========================================================
  */

  num(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  },

  safeText(value, fallback = "N/A") {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return fallback;
    }

    return value;
  },

  normalizeStats(stats = {}) {
    const inningsPitched = this.num(
      stats.inningsPitched ||
      stats.ip
    );

    const homeRuns = this.num(
      stats.homeRuns ||
      stats.hrAllowed ||
      stats.hr
    );

    let homeRunsPer9 = this.num(
      stats.homeRunsPer9 ||
      stats.hr9
    );

    if (
      !homeRunsPer9 &&
      inningsPitched > 0
    ) {
      homeRunsPer9 = Number(
        (
          (homeRuns * 9) /
          inningsPitched
        ).toFixed(2)
      );
    }

    return {
      ...stats,

      era: this.num(stats.era),
      whip: this.num(stats.whip),

      inningsPitched,
      ip: inningsPitched,

      homeRuns,
      hrAllowed: homeRuns,

      homeRunsPer9,
      hr9: homeRunsPer9
    };
  },

  calculateRisk(stats = {}) {
    const normalized =
      this.normalizeStats(stats);

    let risk = 45;

    if (normalized.hr9 >= 2.0) {
      risk += 35;
    } else if (normalized.hr9 >= 1.7) {
      risk += 30;
    } else if (normalized.hr9 >= 1.4) {
      risk += 24;
    } else if (normalized.hr9 >= 1.1) {
      risk += 18;
    } else if (normalized.hr9 >= 0.9) {
      risk += 10;
    }

    if (normalized.era >= 6.0) {
      risk += 18;
    } else if (normalized.era >= 5.0) {
      risk += 14;
    } else if (normalized.era >= 4.5) {
      risk += 10;
    } else if (normalized.era >= 4.0) {
      risk += 6;
    }

    if (normalized.whip >= 1.55) {
      risk += 12;
    } else if (normalized.whip >= 1.4) {
      risk += 9;
    } else if (normalized.whip >= 1.3) {
      risk += 5;
    }

    if (normalized.hrAllowed >= 20) {
      risk += 10;
    } else if (normalized.hrAllowed >= 15) {
      risk += 7;
    } else if (normalized.hrAllowed >= 10) {
      risk += 4;
    }

    return Math.min(
      100,
      Math.round(risk)
    );
  },

  /*
  =========================================================
  PITCHER INFORMATION
  =========================================================
  */

  async getPitcherHand(pitcherId) {
    pitcherId = Number(pitcherId || 0);

    if (
      !pitcherId ||
      typeof API === "undefined" ||
      typeof API.getPlayerInfo !== "function"
    ) {
      return "";
    }

    try {
      const info =
        await API.getPlayerInfo(pitcherId);

      return info?.pitchHand || "";
    } catch (error) {
      console.warn(
        "Could not load pitcher hand:",
        error
      );

      return "";
    }
  },

  /*
  =========================================================
  MAIN PITCHER TARGET LOADER
  =========================================================
  */

  async loadPitcherTargets() {
    this.box =
      document.getElementById(
        "pitchersBox"
      );

    if (!this.box) return;

    this.box.innerHTML =
      "<p>Loading pitcher targets...</p>";

    try {
      const games =
        window.todayData?.games || [];

      if (!games.length) {
        this.box.innerHTML =
          "<p>No games loaded yet.</p>";

        return;
      }

      const pitcherCards = [];

      for (const game of games) {
        const pitcherOptions = [
          {
            pitcherName:
              game.awayPitcher,

            pitcherId:
              Number(
                game.awayPitcherId || 0
              ),

            stats:
              this.normalizeStats(
                game.awayPitcherStats || {}
              ),

            targetTeam:
              game.homeTeam,

            gameText:
              `${game.awayTeam} vs ${game.homeTeam}`,

            opponentHitters:
              game.homeLineup || []
          },

          {
            pitcherName:
              game.homePitcher,

            pitcherId:
              Number(
                game.homePitcherId || 0
              ),

            stats:
              this.normalizeStats(
                game.homePitcherStats || {}
              ),

            targetTeam:
              game.awayTeam,

            gameText:
              `${game.awayTeam} vs ${game.homeTeam}`,

            opponentHitters:
              game.awayLineup || []
          }
        ];

        for (const item of pitcherOptions) {
          const pitcherName =
            String(
              item.pitcherName || ""
            ).trim();

          if (
            !pitcherName ||
            pitcherName.toLowerCase() ===
              "tbd"
          ) {
            continue;
          }

          const risk =
            this.calculateRisk(
              item.stats
            );

          if (risk < 65) {
            continue;
          }

          const pitcherHand =
            await this.getPitcherHand(
              item.pitcherId
            );

          const previousHR =
            this.getPreviousHRList(
              item.opponentHitters
            );

          const hotHitters =
            this.getHotHitters(
              item.opponentHitters
            );

          const recentHR =
            this.getRecentHRList(
              item.opponentHitters
            );

          const bestTargets =
            this.getBestTargets(
              item.opponentHitters,
              item.stats,
              pitcherHand
            );

          pitcherCards.push({
            ...item,

            pitcherHand,
            risk,
            previousHR,
            hotHitters,
            recentHR,
            bestTargets
          });
        }
      }

      pitcherCards.sort(
        (a, b) => b.risk - a.risk
      );

      this.box.innerHTML =
        pitcherCards.length
          ? pitcherCards
              .map(card =>
                this.renderCard(card)
              )
              .join("")
          : `
              <div class="pick-card">
                <h3>No Strong Pitcher Targets</h3>

                <p>
                  No pitchers currently meet
                  the POPS minimum HR-risk level.
                </p>
              </div>
            `;
    } catch (error) {
      console.error(
        "Pitchers load error:",
        error
      );

      this.box.innerHTML = `
        <div class="pick-card">
          <h3>Pitcher Targets Unavailable</h3>

          <p>
            Pitcher targets could not be
            calculated right now.
          </p>
        </div>
      `;
    }
  },

  /*
  =========================================================
  PREVIOUS HR VS PITCHER
  =========================================================
  */

  getPreviousHRList(hitters = []) {
    return hitters
      .map(hitter => ({
        name:
          hitter.name || "Unknown",

        hr:
          this.num(
            hitter.bvp?.homeRuns ||
            hitter.bvp?.hr
          )
      }))
      .filter(item => item.hr > 0)
      .sort(
        (a, b) => b.hr - a.hr
      );
  },

  /*
  =========================================================
  HOT HITTERS
  =========================================================
  */

  getHotHitters(hitters = []) {
    return hitters
      .map(hitter => ({
        name:
          hitter.name || "Unknown",

        streak:
          this.num(
            hitter.hitStreak
          )
      }))
      .filter(
        item => item.streak >= 2
      )
      .sort(
        (a, b) =>
          b.streak - a.streak
      );
  },

  /*
  =========================================================
  HOME RUNS IN LAST FIVE GAMES
  =========================================================
  */

  getRecentHRList(hitters = []) {
    return hitters
      .map(hitter => ({
        name:
          hitter.name || "Unknown",

        hr:
          this.num(
            hitter.last5HR ||
            hitter.hrLast5 ||
            hitter.recentHR ||
            hitter.last5HomeRuns ||
            hitter.recentForm?.homeRuns
          )
      }))
      .filter(item => item.hr > 0)
      .sort(
        (a, b) => b.hr - a.hr
      );
  },

  /*
  =========================================================
  PREPARE BATTER DATA FOR FORMULA
  =========================================================
  */

  buildFormulaBatter(hitter = {}) {
    const hitting =
      hitter.hitting || {};

    const statcast =
      hitter.statcast || {
        available: false,
        barrelPct: null,
        hardHitPct: null,
        avgExitVelocity: null,
        launchAngle: null,
        sweetSpotPct: null,
        flyBallPct: null,
        pullPct: null
      };

    const average =
      this.num(hitting.avg);

    const slugging =
      this.num(hitting.slg);

    const homeRuns =
      this.num(hitting.homeRuns);

    const plateAppearances =
      this.num(
        hitting.plateAppearances
      );

    const atBats =
      this.num(hitting.atBats);

    const doubles =
      this.num(hitting.doubles);

    const triples =
      this.num(hitting.triples);

    const extraBaseHits =
      this.num(
        hitting.extraBaseHits ||
        (
          doubles +
          triples +
          homeRuns
        )
      );

    const denominator =
      plateAppearances ||
      atBats;

    const hrRate =
      this.num(
        hitting.hrRate
      ) ||
      (
        denominator > 0
          ? homeRuns / denominator
          : 0
      );

    const extraBaseHitRate =
      this.num(
        hitting.extraBaseHitRate
      ) ||
      (
        denominator > 0
          ? extraBaseHits /
            denominator
          : 0
      );

    const iso =
      this.num(hitting.iso) ||
      (
        slugging > 0
          ? Number(
              (
                slugging -
                average
              ).toFixed(3)
            )
          : 0
      );

    return {
      ...hitter,

      name:
        hitter.name || "Unknown",

      lineupSpot:
        Number(
          hitter.lineupSpot || 9
        ),

      batSide:
        hitter.batSide || "",

      hitStreak:
        this.num(
          hitter.hitStreak
        ),

      hitting: {
        ...hitting,

        avg: average,
        slg: slugging,

        ops:
          this.num(hitting.ops),

        homeRuns,
        plateAppearances,
        atBats,
        doubles,
        triples,
        extraBaseHits,
        hrRate,
        extraBaseHitRate,
        iso
      },

      statcast,

      recentForm:
        hitter.recentForm || {},

      handednessSplit:
        hitter.handednessSplit || {},

      bvp: {
        atBats:
          this.num(
            hitter.bvp?.atBats
          ),

        hits:
          this.num(
            hitter.bvp?.hits
          ),

        avg:
          hitter.bvp?.avg ||
          ".000",

        homeRuns:
          this.num(
            hitter.bvp?.homeRuns ||
            hitter.bvp?.hr
          )
      }
    };
  },

  /*
  =========================================================
  BEST HR TARGETS

  Uses the exact same Formula.getHRScore structure as app.js.
  =========================================================
  */

  getBestTargets(
    hitters = [],
    pitcherStats = {},
    pitcherHand = ""
  ) {
    if (
      typeof Formula === "undefined" ||
      typeof Formula.getHRScore !==
        "function"
    ) {
      console.error(
        "Formula.getHRScore is unavailable."
      );

      return [];
    }

    return hitters
      .map(hitter => {
        const batter =
          this.buildFormulaBatter(
            hitter
          );

        const result =
          Formula.getHRScore({
            batter,

            pitcher:
              this.normalizeStats(
                pitcherStats
              ),

            pitcherHand,

            handednessSplit:
              batter.handednessSplit ||
              {},

            recentForm:
              batter.recentForm ||
              {}
          });

        return {
          name:
            batter.name,

          score:
            Math.min(
              100,
              Math.round(
                this.num(
                  result?.score
                )
              )
            ),

          tier:
            result?.tier || "",

          confidence:
            result?.confidence || {},

          breakdown:
            result?.breakdown || [],

          lineupSpot:
            batter.lineupSpot,

          confirmed:
            Boolean(
              batter.confirmed
            )
        };
      })

      /*
      Prevent broken or completely empty players
      from appearing in the card.
      */
      .filter(target =>
        target.name &&
        target.name !== "Unknown" &&
        target.score > 0
      )

      .sort(
        (a, b) =>
          b.score - a.score
      )

      .slice(0, 5);
  },

  /*
  =========================================================
  RENDER PITCHER CARD
  =========================================================
  */

  renderCard(card) {
    const stats =
      this.normalizeStats(
        card.stats || {}
      );

    const color =
      this.getColorClass(
        card.risk
      );

    return `
      <div class="pitcher-target-card ${color}">
        <h2>
          🎯 ${card.pitcherName}
        </h2>

        <p>
          <strong>Target Bats:</strong>
          ${card.targetTeam}
        </p>

        <p>
          <strong>Game:</strong>
          ${card.gameText}
        </p>

        <p>
          <strong>Pitcher Hand:</strong>
          ${card.pitcherHand || "N/A"}
        </p>

        <h3>
          Risk:
          <span class="risk-score">
            ${card.risk}/100
          </span>
        </h3>

        <p class="tier">
          ${this.getTier(card.risk)}
        </p>

        <p class="pitching-line">
          ERA:
          ${
            stats.era > 0
              ? stats.era.toFixed(2)
              : "N/A"
          }
          |

          WHIP:
          ${
            stats.whip > 0
              ? stats.whip.toFixed(2)
              : "N/A"
          }
          |

          HR/9:
          ${
            stats.hr9 > 0
              ? stats.hr9.toFixed(2)
              : "N/A"
          }
          |

          HR Allowed:
          ${
            stats.hrAllowed > 0
              ? stats.hrAllowed
              : "N/A"
          }
          |

          IP:
          ${
            stats.ip > 0
              ? stats.ip
              : "N/A"
          }
        </p>

        <div class="pitcher-grid">
          <div class="mini-card">
            <h4>
              💣 Previous HR vs Pitcher
            </h4>

            ${this.renderList(
              card.previousHR,
              item =>
                `${item.name}: ${item.hr} HR`
            )}
          </div>

          <div class="mini-card">
            <h4>🔥 Hot Hitters</h4>

            ${this.renderList(
              card.hotHitters,
              item =>
                `${item.name}: ${item.streak}+ game hit streak`
            )}
          </div>

          <div class="mini-card">
            <h4>
              💣 HR in Last 10 Games
            </h4>

            ${this.renderList(
              card.recentHR,
              item =>
                `${item.name}: ${item.hr} HR`
            )}
          </div>

          <div class="mini-card">
            <h4>
              ⭐ POPS Best HR Targets
            </h4>

            ${this.renderList(
              card.bestTargets,
              item => `
                <strong>${item.name}</strong>:
                ${item.score}/100
                <br>
                <span class="small">
                  ${item.tier || ""}
                  ${
                    item.confirmed
                      ? " • Confirmed lineup"
                      : " • Projected lineup"
                  }
                </span>
              `
            )}
          </div>
        </div>
      </div>
    `;
  },

  /*
  =========================================================
  LIST RENDERER
  =========================================================
  */

  renderList(list = [], formatter) {
    if (!Array.isArray(list) || !list.length) {
      return `
        <p class="muted">
          No strong matches found.
        </p>
      `;
    }

    return `
      <ul>
        ${list
          .map(
            item => `
              <li>
                ${formatter(item)}
              </li>
            `
          )
          .join("")}
      </ul>
    `;
  }
};

window.Pitchers = Pitchers;
