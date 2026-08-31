import { createReadClient } from "@/lib/supabase/server";
import { getAllGames } from "@/lib/queries/games";
import type { Manager, ManagerCareerStats, PlayerTeamPoints, TeamSeason } from "@/lib/types";

export interface FranchiseSeason extends TeamSeason {
  season: string;
  league_name: string;
}

export interface HeadToHeadRow {
  opponent_id: string;
  opponent_name: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  games: number;
}

export async function getManagerByUserId(userId: string): Promise<Manager | null> {
  const db = createReadClient();
  const { data, error } = await db.from("managers").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as Manager | null;
}

export async function getAllFranchiseManagers(): Promise<Manager[]> {
  const db = createReadClient();
  const { data, error } = await db
    .from("team_seasons")
    .select("manager:managers(*)")
    .not("manager_id", "is", null);
  if (error) throw error;

  const seen = new Map<string, Manager>();
  for (const row of (data ?? []) as unknown as { manager: Manager | null }[]) {
    if (row.manager) seen.set(row.manager.user_id, row.manager);
  }
  return Array.from(seen.values()).sort((a, b) => a.display_name.localeCompare(b.display_name));
}

export async function getFranchiseCareerStats(managerId: string): Promise<ManagerCareerStats | null> {
  const db = createReadClient();
  const { data, error } = await db
    .from("manager_career_stats")
    .select("*")
    .eq("manager_id", managerId)
    .maybeSingle();
  if (error) throw error;
  return data as ManagerCareerStats | null;
}

export async function getFranchiseSeasons(managerId: string): Promise<FranchiseSeason[]> {
  const db = createReadClient();
  const { data, error } = await db
    .from("team_seasons")
    .select("*, league:leagues!team_seasons_league_id_fkey(season, name)")
    .eq("manager_id", managerId);
  if (error) throw error;
  return ((data ?? []) as unknown as (TeamSeason & { league: { season: string; name: string } })[])
    .map((row) => ({ ...row, season: row.league.season, league_name: row.league.name }))
    .sort((a, b) => a.season.localeCompare(b.season));
}

export async function getFranchiseBestPlayers(managerId: string, limit = 15): Promise<PlayerTeamPoints[]> {
  const db = createReadClient();
  const { data, error } = await db
    .from("player_team_points")
    .select("*")
    .eq("manager_id", managerId)
    .order("total_points", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PlayerTeamPoints[];
}

export async function getFranchiseGames(managerId: string) {
  const games = await getAllGames();
  return games.filter((g) => g.manager_id === managerId);
}

export async function getFranchiseHeadToHead(managerId: string): Promise<HeadToHeadRow[]> {
  const games = (await getAllGames()).filter((g) => g.manager_id === managerId && g.opp_manager_id);
  const byOpponent = new Map<string, HeadToHeadRow>();

  for (const g of games) {
    const oppId = g.opp_manager_id!;
    const row =
      byOpponent.get(oppId) ??
      ({
        opponent_id: oppId,
        opponent_name: g.opp_manager_name ?? "Unknown",
        wins: 0,
        losses: 0,
        ties: 0,
        points_for: 0,
        points_against: 0,
        games: 0,
      } satisfies HeadToHeadRow);

    row.games++;
    row.points_for += g.points;
    row.points_against += g.opp_points ?? 0;
    if (g.result === "W") row.wins++;
    else if (g.result === "L") row.losses++;
    else if (g.result === "T") row.ties++;

    byOpponent.set(oppId, row);
  }

  return Array.from(byOpponent.values()).sort((a, b) => b.games - a.games);
}
