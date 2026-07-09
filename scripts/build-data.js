const fs = require("fs/promises");

const MLB = "https://statsapi.mlb.com/api/v1";

const today = new Date().toISOString().split("T")[0];

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch {
    return null;
  }
}

async function getSchedule() {
  const url = `${MLB}/schedule?sportId=1&date=${today}&hydrate=team,probablePitcher,venue`;
  const data = await fetchJSON(url);
  return data?.dates?.[0]?.games || [];
}

async function getPlayerStats(id, group) {
  if (!id) return {};
  const data = await fetchJSON(`${MLB}/people/${id}/stats?stats=season&group=${group}`);
  return data?.stats?.[0]?.splits?.[0]?.stat || {};
}

async function getPlayerInfo(id) {
  if (!id) return {};
  const data = await fetchJSON(`${MLB}/people/${id}`);
  const p = data?.people?.[0] || {};
  return {
    id,
    name: p.fullName || "",
    batSide: p.batSide?.code || "",
    pitchHand: p.pitchHand?.code || ""
  };
}

async function getLiveGame(gamePk) {
  return await fetchJSON(`${MLB}/game/${gamePk}/feed/live`);
}

async function getLineup(gamePk, teamId) {
  const live = await getLiveGame(gamePk);
  const box = live?.liveData?.boxscore;
  if (!box) return [];

  const side =
    box.teams.away.team.id === teamId
      ? box.teams.away
      : box.teams.home.team.id === teamId
      ? box.teams.home
      : null;

  if (!side?.battingOrder?.length) return [];

  return side.battingOrder.map((id, i) => {
    const p = side.players[`ID${id}`];
    return {
      id,
      name: p?.person?.fullName || "Unknown",
      position: p?.position?.abbreviation || "",
      lineupSpot: i + 1,
      confirmed: true
    };
  });
}

async function getRoster(teamId) {
  const data = await fetchJSON(`${MLB}/teams/${teamId}/roster?rosterType=active`);
  return data?.roster?.map(x => ({
    id: x.person.id,
    name: x.person.fullName,
    position: x.position.abbreviation,
    confirmed: false
  })) || [];
}

async function getHitStreak(playerId) {
  const year = new Date().getFullYear();
  const data = await fetchJSON(`${MLB}/people/${playerId}/stats?stats=gameLog&group=hitting&season=${year}`);
  const logs = data?.stats?.[0]?.splits || [];

  let streak = 0;

  logs
    .filter(g => g.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .some(g => {
      if (Number(g.stat?.hits || 0) > 0) {
        streak++;
        return false;
      }
      return true;
    });

  return streak;
}

async function getBvP(batterId, pitcherId) {
  const year = new Date().getFullYear();
  const data = await fetchJSON(
    `${MLB}/people/${batterId}/stats?stats=vsPlayer&group=hitting&opposingPlayerId=${pitcherId}&season=${year}`
  );

  const s = data?.stats?.[0]?.splits?.[0]?.stat || {};

  return {
    atBats: Number(s.atBats || 0),
    hits: Number(s.hits || 0),
    avg: s.avg || ".000",
    homeRuns: Number(s.homeRuns || 0)
  };
}

async function getStatcast(playerId) {
  const year = new Date().getFullYear();

  const url =
    "https://baseballsavant.mlb.com/statcast_search/csv?" +
    `hfSea=${year}%7C` +
    "&player_type=batter" +
    `&batters_lookup%5B%5D=${playerId}` +
    "&game_date_gt=" + `${year}-03-01` +
    "&game_date_lt=" + `${year}-11-30` +
    "&group_by=name&type=details";

  try {
    const res = await fetch(url);
    const text = await res.text();

    const lines = text.trim().split("\n");
    const headers = lines[0]?.split(",") || [];

    const rows = lines.slice(1).map(line => {
      const values = line.split(",");
      const obj = {};
      headers.forEach((h, i) => obj[h.trim()] = values[i]);
      return obj;
    });

    const balls = rows.filter(r => Number(r.launch_speed) > 0);
    const total = balls.length;

    if (!total) {
      return { hardHitRate: 0, barrelRate: 0, exitVelocity: 0, flyBallRate: 0 };
    }

    const hard = balls.filter(r => Number(r.launch_speed) >= 95).length;
    const barrels = balls.filter(r => String(r.launch_speed_angle) === "6").length;
    const fly = balls.filter(r => Number(r.launch_angle) >= 25 && Number(r.launch_angle) <= 50).length;
    const ev = balls.reduce((sum, r) => sum + Number(r.launch_speed || 0), 0) / total;

    return {
      hardHitRate: Number(((hard / total) * 100).toFixed(1)),
      barrelRate: Number(((barrels / total) * 100).toFixed(1)),
      exitVelocity: Number(ev.toFixed(1)),
      flyBallRate: Number(((fly / total) * 100).toFixed(1))
    };
  } catch {
    return { hardHitRate: 0, barrelRate: 0, exitVelocity: 0, flyBallRate: 0 };
  }
}

async function main() {
  const schedule = await getSchedule();
  const output = {
    date: today,
    games: []
  };

  for (const game of schedule) {
    const gamePk = game.gamePk;

    const away = game.teams.away.team;
    const home = game.teams.home.team;

    const awayPitcher = game.teams.away.probablePitcher || {};
    const homePitcher = game.teams.home.probablePitcher || {};

    let awayLineup = await getLineup(gamePk, away.id);
    let homeLineup = await getLineup(gamePk, home.id);

    if (!awayLineup.length) awayLineup = (await getRoster(away.id)).filter(p => !["P", "SP", "RP"].includes(p.position)).slice(0, 9);
    if (!homeLineup.length) homeLineup = (await getRoster(home.id)).filter(p => !["P", "SP", "RP"].includes(p.position)).slice(0, 9);

    async function enrichBatters(lineup, opposingPitcherId) {
      const batters = [];

      for (let i = 0; i < lineup.length; i++) {
        const p = lineup[i];
        const hitting = await getPlayerStats(p.id, "hitting");
        const info = await getPlayerInfo(p.id);
        const statcast = await getStatcast(p.id);
        const bvp = await getBvP(p.id, opposingPitcherId);
        const hitStreak = await getHitStreak(p.id);

        batters.push({
          ...p,
          lineupSpot: p.lineupSpot || i + 1,
          batSide: info.batSide,
          hitting,
          statcast,
          bvp,
          hitStreak
        });
      }

      return batters;
    }

    output.games.push({
      gamePk,
      date: game.gameDate,
      venue: game.venue?.name || "TBD",
      awayTeam: away.name,
      homeTeam: home.name,
      awayTeamId: away.id,
      homeTeamId: home.id,
      awayPitcher: awayPitcher.fullName || "TBD",
      homePitcher: homePitcher.fullName || "TBD",
      awayPitcherId: awayPitcher.id || null,
      homePitcherId: homePitcher.id || null,
      awayPitcherStats: await getPlayerStats(awayPitcher.id, "pitching"),
      homePitcherStats: await getPlayerStats(homePitcher.id, "pitching"),
      awayLineup: await enrichBatters(awayLineup, homePitcher.id),
      homeLineup: await enrichBatters(homeLineup, awayPitcher.id)
    });
  }

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile("data/today.json", JSON.stringify(output, null, 2));
}

main();
