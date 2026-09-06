// Monte Carlo season simulation. Each team's weekly score is drawn from
// Normal(projected_mean, stddev) — stddev is a single league-wide pooled
// estimate (this league's own historical week-to-week scoring spread),
// not modeled per team, since we have no basis to say one team is more
// "volatile" than another going into an unplayed season.
//
// Simulations start from each team's ACTUAL wins/points-for so far this
// season (both 0 before Week 1) and only simulate remaining, unplayed
// games — so this stays meaningful all season, not just preseason.

export interface SimTeam {
  roster_id: number;
  projected_mean: number;
  actual_wins: number;
  actual_points_for: number;
}

export interface SimGame {
  week: number;
  matchup_id: number;
  rosterA: number;
  rosterB: number;
}

export interface TeamSimResult {
  roster_id: number;
  mean_wins: number;
  median_wins: number;
  playoff_probability: number;
  avg_final_standing: number;
  standing_distribution: Record<number, number>;
}

export interface SimulationOutput {
  teams: TeamSimResult[];
  matchupWinProbability: Map<string, number>; // key `${week}:${roster_id}`
}

function sampleNormal(mean: number, stddev: number): number {
  const u1 = Math.max(Math.random(), 1e-9);
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stddev * z;
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function simulateSeason(
  teams: SimTeam[],
  games: SimGame[],
  stddev: number,
  playoffTeams: number,
  numSimulations: number
): SimulationOutput {
  const rosterIds = teams.map((t) => t.roster_id);
  const meanById = new Map(teams.map((t) => [t.roster_id, t.projected_mean]));

  const winsAcrossSims = new Map<number, number[]>(rosterIds.map((id) => [id, []]));
  const standingSum = new Map<number, number>(rosterIds.map((id) => [id, 0]));
  const standingCounts = new Map<number, Record<number, number>>(rosterIds.map((id) => [id, {}]));
  const playoffCount = new Map<number, number>(rosterIds.map((id) => [id, 0]));
  const matchupWinCount = new Map<string, number>();

  for (let sim = 0; sim < numSimulations; sim++) {
    const wins = new Map<number, number>(teams.map((t) => [t.roster_id, t.actual_wins]));
    const pointsFor = new Map<number, number>(teams.map((t) => [t.roster_id, t.actual_points_for]));

    for (const game of games) {
      const scoreA = sampleNormal(meanById.get(game.rosterA) ?? 0, stddev);
      const scoreB = sampleNormal(meanById.get(game.rosterB) ?? 0, stddev);
      pointsFor.set(game.rosterA, (pointsFor.get(game.rosterA) ?? 0) + scoreA);
      pointsFor.set(game.rosterB, (pointsFor.get(game.rosterB) ?? 0) + scoreB);

      const winner = scoreA > scoreB ? game.rosterA : game.rosterB;
      wins.set(winner, (wins.get(winner) ?? 0) + 1);

      const key = `${game.week}:${winner}`;
      matchupWinCount.set(key, (matchupWinCount.get(key) ?? 0) + 1);
    }

    const standings = [...rosterIds].sort((a, b) => {
      const winDiff = (wins.get(b) ?? 0) - (wins.get(a) ?? 0);
      if (winDiff !== 0) return winDiff;
      return (pointsFor.get(b) ?? 0) - (pointsFor.get(a) ?? 0);
    });

    standings.forEach((rosterId, i) => {
      const standing = i + 1;
      winsAcrossSims.get(rosterId)!.push(wins.get(rosterId) ?? 0);
      standingSum.set(rosterId, (standingSum.get(rosterId) ?? 0) + standing);
      const counts = standingCounts.get(rosterId)!;
      counts[standing] = (counts[standing] ?? 0) + 1;
      if (standing <= playoffTeams) playoffCount.set(rosterId, (playoffCount.get(rosterId) ?? 0) + 1);
    });
  }

  const results: TeamSimResult[] = rosterIds.map((rosterId) => {
    const winsList = winsAcrossSims.get(rosterId)!;
    const distribution: Record<number, number> = {};
    for (const [standing, count] of Object.entries(standingCounts.get(rosterId)!)) {
      distribution[Number(standing)] = count / numSimulations;
    }
    return {
      roster_id: rosterId,
      mean_wins: winsList.reduce((s, w) => s + w, 0) / numSimulations,
      median_wins: median(winsList),
      playoff_probability: (playoffCount.get(rosterId) ?? 0) / numSimulations,
      avg_final_standing: (standingSum.get(rosterId) ?? 0) / numSimulations,
      standing_distribution: distribution,
    };
  });

  const matchupWinProbability = new Map<string, number>();
  for (const game of games) {
    for (const rosterId of [game.rosterA, game.rosterB]) {
      const wins = matchupWinCount.get(`${game.week}:${rosterId}`) ?? 0;
      matchupWinProbability.set(`${game.week}:${rosterId}`, wins / numSimulations);
    }
  }

  return { teams: results, matchupWinProbability };
}
