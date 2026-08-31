import { getAllGames } from "@/lib/queries/games";

export async function getSeasonMatchups(season: string) {
  const games = await getAllGames();
  const seasonGames = games.filter((g) => g.season === season);

  const seen = new Set<string>();
  const unique = [];
  for (const g of seasonGames) {
    const key = `${g.league_id}:${g.week}:${g.matchup_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(g);
  }
  return unique.sort((a, b) => a.week - b.week);
}

export interface HeadToHeadSummary {
  manager_a: string;
  manager_b: string;
  a_wins: number;
  b_wins: number;
  ties: number;
  games: { season: string; week: number; a_points: number; b_points: number }[];
}

export async function getHeadToHead(managerA: string, managerB: string): Promise<HeadToHeadSummary | null> {
  const games = await getAllGames();
  const matches = games.filter((g) => g.manager_id === managerA && g.opp_manager_id === managerB);
  if (matches.length === 0) return null;

  let aWins = 0;
  let bWins = 0;
  let ties = 0;
  const gameList = matches.map((g) => {
    if (g.result === "W") aWins++;
    else if (g.result === "L") bWins++;
    else ties++;
    return { season: g.season, week: g.week, a_points: g.points, b_points: g.opp_points ?? 0 };
  });

  return { manager_a: managerA, manager_b: managerB, a_wins: aWins, b_wins: bWins, ties, games: gameList };
}

export async function listManagersWithGames() {
  const games = await getAllGames();
  const map = new Map<string, string>();
  for (const g of games) {
    if (g.manager_id && g.manager_name) map.set(g.manager_id, g.manager_name);
  }
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}
