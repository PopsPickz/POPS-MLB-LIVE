const scoresBox = document.getElementById("scoresBox");
const hrBox = document.getElementById("hrBox");

const POPS_HR_V3 = {
  getTop3(game) {
    const away = game.teams.away.team.name;
    const home = game.teams.home.team.name;

    const awayTargets = this.getFallbackPowerBats(away).map(player =>
      this.scorePlayer(player, home, game)
    );

    const homeTargets = this.getFallbackPowerBats(home).map(player =>
      this.scorePlayer(player, away, game)
    );

    return [...awayTargets, ...homeTargets]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  },

  scorePlayer(player, opponent, game) {
    let score = 50;

    if (player.hr >= 25) score += 15;
    else if (player.hr >= 18) score += 11;
    else if (player.hr >= 12) score += 8;

    if (player.iso >= .250) score += 12;
    else if (player.iso >= .210) score += 9;
    else if (player.iso >= .180) score += 6;

    if (player.barrel >= 14) score += 12;
    else if (player.barrel >= 10) score += 9;
    else if (player.barrel >= 7) score += 5;

    if (player.hardHit >= 50) score += 8;
    else if (player.hardHit >= 45) score += 6;
    else if (player.hardHit >= 40) score += 4;

    score = Math.min(score, 100);

    return {
      name: player.name,
      team: player.team,
      opponent,
      score,
      reason: ⁠ ${player.hr} HR | ${player.barrel}% Barrel | ${player.hardHit}% Hard Hit ⁠
    };
  },

  getFallbackPowerBats(team) {
    const bats = {
      "Los Angeles Angels": [
        { name: "Mike Trout", team, bats: "R", hr: 20, iso: .240, barrel: 14, hardHit: 50 },
        { name: "Taylor Ward", team, bats: "R", hr: 18, iso: .220, barrel: 11, hardHit: 45 },
        { name: "Logan O'Hoppe", team, bats: "R", hr: 17, iso: .210, barrel: 10, hardHit: 44 }
      ],

      "Texas Rangers": [
        { name: "Corey Seager", team, bats: "L", hr: 25, iso: .260, barrel: 15, hardHit: 50 },
        { name: "Adolis García", team, bats: "R", hr: 24, iso: .250, barrel: 14, hardHit: 48 },
        { name: "Wyatt Langford", team, bats: "R", hr: 18, iso: .220, barrel: 11, hardHit: 46 }
      ]
    };

    return bats[team] || [
      { name: ⁠ ${team} Power Bat #1 ⁠, team, bats: "R", hr: 16, iso: .210, barrel: 10, hardHit: 44 },
      { name: ⁠ ${team} Power Bat #2 ⁠, team, bats: "L", hr: 14, iso: .200, barrel: 9, hardHit: 42 },
      { name: ⁠ ${team} Power Bat #3 ⁠, team, bats: "R", hr: 12, iso: .185, barrel: 8, hardHit: 40 }
    ];
  },

  renderGameTargets(game) {
    const targets = this.getTop3(game);

    return `
      <div class="pops-targets">
        <h4>💣 POPS HR Targets</h4>
        ${targets.map((p, i) => `
          <p>
            <strong>${i + 1}. ${p.name}</strong> — ${p.team}<br>
            POPS Score: ${p.score}/100<br>
            <small>${p.reason}</small>
          </p>
        `).join("")}
      </div>
    `;
  },

  renderAllGames(games, box) {
    box.innerHTML = games.map(game => {
      const away = game.teams.away.team.name;
      const home = game.teams.home.team.name;

      return `
        <div class="game">
          <h3>${away} vs ${home}</h3>
          ${this.renderGameTargets(game)}
        </div>
      `;
    }).join("");
  }
};

async function loadMLB() {
  scoresBox.innerHTML = "Loading MLB games...";
  hrBox.innerHTML = "Generating POPS HR targets...";

  try {
    const data = await API.getSchedule();
    const games = data.dates && data.dates.length ? data.dates[0].games : [];

    if (!games.length) {
      scoresBox.innerHTML = "No MLB games today.";
      hrBox.innerHTML = "No POPS HR targets today.";
      return;
    }

    scoresBox.innerHTML = games.map(game => {
      const away = game.teams.away.team.name;
      const home = game.teams.home.team.name;
      const awayScore = game.teams.away.score || 0;
      const homeScore = game.teams.home.score || 0;
      const status = game.status.detailedState;
      const gamePk = game.gamePk;

      return `
        <div class="game" onclick="Scouting.load(${gamePk})">
          <h3>${away} vs ${home}</h3>
          <p><strong>Score:</strong> ${awayScore} - ${homeScore}</p>
          <p><strong>Status:</strong> ${status}</p>
          <p class="tap-text">Tap to view scouting report</p>
        </div>
      `;
    }).join("");

    POPS_HR_V3.renderAllGames(games, hrBox);

  } catch (err) {
    console.log(err);
    scoresBox.innerHTML = "Error loading MLB scores.";
    hrBox.innerHTML = "Error loading POPS HR targets.";
  }
}

Scouting.init();
loadMLB();
setInterval(loadMLB, 60000);
