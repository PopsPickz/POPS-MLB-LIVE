const Moneyline = {
  num(value) {
    const n = Number(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  },

  pitcherScore(stats = {}) {
    const era = this.num(stats.era);
    const whip = this.num(stats.whip);
    const innings = this.num(stats.inningsPitched);
    const strikeouts = this.num(stats.strikeOuts);
    const walks = this.num(stats.baseOnBalls);
    const homeRuns = this.num(stats.homeRuns);

    let score = 100;

    if (era > 0) score -= era * 6;
    if (whip > 0) score -= whip * 15;
    score -= homeRuns * 0.8;

    if (innings > 0) {
      const k9 = (strikeouts * 9) / innings;
      const bb9 = (walks * 9) / innings;

      score += k9 * 1.2;
      score -= bb9 * 2;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  },

  offenseScore(stats = {}) {
    const runs = this.num(stats.runs);
    const hits = this.num(stats.hits);
    const homeRuns = this.num(stats.homeRuns);
    const avg = this.num(stats.avg);
    const ops = this.num(stats.ops);

    let score = 0;

    score += ops * 45;
    score += avg * 80;
    score += runs * 0.08;
    score += hits * 0.04;
    score += homeRuns * 0.25;

    return Math.max(0, Math.min(100, Math.round(score)));
  },

  bullpenScore(stats = {}) {
    const era = this.num(stats.era);
    const whip = this.num(stats.whip);
    const saves = this.num(stats.saves);
    const blownSaves = this.num(stats.blownSaves);

    let score = 100;

    if (era > 0) score -= era * 7;
    if (whip > 0) score -= whip * 18;
    score += saves * 0.2;
    score -= blownSaves * 1.5;

    return Math.max(0, Math.min(100, Math.round(score)));
  },

  defenseScore(stats = {}) {
    const fielding = this.num(stats.fielding);
    const errors = this.num(stats.errors);
    const doublePlays = this.num(stats.doublePlays);

    let score = 0;

    score += fielding * 100;
    score -= errors * 0.45;
    score += doublePlays * 0.12;

    return Math.max(0, Math.min(100, Math.round(score)));
  },

  compareCategory(awayScore, homeScore) {
    if (awayScore > homeScore) return "away";
    if (homeScore > awayScore) return "home";
    return "tie";
  },

  async buildCard(game) {
    const awayStats = await safe(() => API.getTeamStats(game.awayTeamId), {
      hitting: {},
      pitching: {},
      fielding: {}
    });

    const homeStats = await safe(() => API.getTeamStats(game.homeTeamId), {
      hitting: {},
      pitching: {},
      fielding: {}
    });

    const awayPitcherStats = await safe(
      () => API.getPlayerStats(game.awayPitcherId),
      {}
    );

    const homePitcherStats = await safe(
      () => API.getPlayerStats(game.homePitcherId),
      {}
    );

    const awayScores = {
      pitcher: game.awayPitcherId ? this.pitcherScore(awayPitcherStats) : 0,
      bullpen: this.bullpenScore(awayStats.pitching),
      offense: this.offenseScore(awayStats.hitting),
      defense: this.defenseScore(awayStats.fielding)
    };

    const homeScores = {
      pitcher: game.homePitcherId ? this.pitcherScore(homePitcherStats) : 0,
      bullpen: this.bullpenScore(homeStats.pitching),
      offense: this.offenseScore(homeStats.hitting),
      defense: this.defenseScore(homeStats.fielding)
    };

    const categories = {
      pitcher: this.compareCategory(awayScores.pitcher, homeScores.pitcher),
      bullpen: this.compareCategory(awayScores.bullpen, homeScores.bullpen),
      offense: this.compareCategory(awayScores.offense, homeScores.offense),
      defense: this.compareCategory(awayScores.defense, homeScores.defense)
    };

    const awayChecks = Object.values(categories).filter(v => v === "away").length;
    const homeChecks = Object.values(categories).filter(v => v === "home").length;

    const awayTotal =
      awayScores.pitcher * 0.35 +
      awayScores.bullpen * 0.25 +
      awayScores.offense * 0.25 +
      awayScores.defense * 0.15;

    const homeTotal =
      homeScores.pitcher * 0.35 +
      homeScores.bullpen * 0.25 +
      homeScores.offense * 0.25 +
      homeScores.defense * 0.15 +
      2; // small home-field edge

    const pick =
      awayTotal > homeTotal
        ? game.awayTeam
        : homeTotal > awayTotal
        ? game.homeTeam
        : "No Clear Edge";

    const confidence = Math.min(
      90,
      Math.max(50, Math.round(Math.abs(awayTotal - homeTotal) + 55))
    );

    return `
      <div class="pick-card">
        <h3>${game.awayTeam} vs ${game.homeTeam}</h3>
        <p>⏰ ${formatTime(game.date)}</p>
        <p>💰 POPS Pick: <span class="score">${pick}</span></p>
        <p class="small">Checklist: ${awayChecks} - ${homeChecks}</p>
        <p class="small">Confidence: ${confidence}%</p>
        <hr>

        <p><strong>${game.awayTeam}</strong></p>
        <p>Starting Pitcher ${categories.pitcher === "away" ? "✅" : categories.pitcher === "tie" ? "➖" : "❌"} 
          <span class="small">Score: ${awayScores.pitcher}</span>
        </p>
        <p>Better Bullpen ${categories.bullpen === "away" ? "✅" : categories.bullpen === "tie" ? "➖" : "❌"} 
          <span class="small">Score: ${awayScores.bullpen}</span>
        </p>
        <p>Offense ${categories.offense === "away" ? "✅" : categories.offense === "tie" ? "➖" : "❌"} 
          <span class="small">Score: ${awayScores.offense}</span>
        </p>
        <p>Defense ${categories.defense === "away" ? "✅" : categories.defense === "tie" ? "➖" : "❌"} 
          <span class="small">Score: ${awayScores.defense}</span>
        </p>
        <p class="small">
          Starter: ${game.awayPitcher} | Overall: ${Math.round(awayTotal)}
        </p>

        <hr>

        <p><strong>${game.homeTeam}</strong></p>
        <p>Starting Pitcher ${categories.pitcher === "home" ? "✅" : categories.pitcher === "tie" ? "➖" : "❌"} 
          <span class="small">Score: ${homeScores.pitcher}</span>
        </p>
        <p>Better Bullpen ${categories.bullpen === "home" ? "✅" : categories.bullpen === "tie" ? "➖" : "❌"} 
          <span class="small">Score: ${homeScores.bullpen}</span>
        </p>
        <p>Offense ${categories.offense === "home" ? "✅" : categories.offense === "tie" ? "➖" : "❌"} 
          <span class="small">Score: ${homeScores.offense}</span>
        </p>
        <p>Defense ${categories.defense === "home" ? "✅" : categories.defense === "tie" ? "➖" : "❌"} 
          <span class="small">Score: ${homeScores.defense}</span>
        </p>
        <p class="small">
          Starter: ${game.homePitcher} | Overall: ${Math.round(homeTotal)}
        </p>
      </div>
    `;
  },

  async load(games) {
    const cards = [];

    for (const game of games) {
      const card = await this.buildCard(game);
      cards.push(card);
    }

    moneylineBox.innerHTML = cards.join("");
  }
};

async function loadMoneyline() {
  moneylineBox.innerHTML = "<p>Loading Moneyline Pickz...</p>";
  return await Moneyline.load(games);
}