import { createReadClient } from "@/lib/supabase/server";
import { getAllGames } from "@/lib/queries/games";

export interface SeasonTrend {
  season: string;
  avg_points: number;
  high_score: number;
  low_score: number;
  games: number;
}

export interface LeagueOverview {
  seasons: number;
  managers: number;
  totalGames: number;
  totalPointsScored: number;
  avgPointsPerGame: number;
  currentSeason: string | null;
}

export async function getLeagueOverview(leagueGroupId: string): Promise<LeagueOverview> {
  const db = createReadClient();
  // managers is a global table (the same real Sleeper user can appear in
  // more than one onboarded league), so "how many managers" has to come
  // from this league's own team_seasons rows, not a bare table count.
  const [{ data: teamSeasons }, { data: leagues }] = await Promise.all([
    db.from("team_seasons").select("manager_id").eq("league_group_id", leagueGroupId),
    db.from("leagues").select("season, is_current").eq("league_group_id", leagueGroupId),
  ]);
  const managerCount = new Set((teamSeasons ?? []).map((t) => t.manager_id)).size;

  const games = await getAllGames(leagueGroupId);
  const totalPoints = games.reduce((sum, g) => sum + g.points, 0);

  return {
    seasons: leagues?.length ?? 0,
    managers: managerCount,
    totalGames: games.length,
    totalPointsScored: totalPoints,
    avgPointsPerGame: games.length ? totalPoints / games.length : 0,
    currentSeason: leagues?.find((l) => l.is_current)?.season ?? null,
  };
}

export async function getScoringTrends(leagueGroupId: string): Promise<SeasonTrend[]> {
  const games = await getAllGames(leagueGroupId);
  const bySeason = new Map<string, number[]>();
  for (const g of games) {
    const list = bySeason.get(g.season) ?? [];
    list.push(g.points);
    bySeason.set(g.season, list);
  }

  return Array.from(bySeason.entries())
    .map(([season, points]) => ({
      season,
      avg_points: points.reduce((a, b) => a + b, 0) / points.length,
      high_score: Math.max(...points),
      low_score: Math.min(...points),
      games: points.length,
    }))
    .sort((a, b) => a.season.localeCompare(b.season));
}
