import { createReadClient } from "@/lib/supabase/server";
import type { Manager, TeamSeason } from "@/lib/types";

export interface StandingsRow extends TeamSeason {
  manager: Manager | null;
  rank: number;
  point_diff: number;
}

export async function getStandingsForSeason(leagueId: string): Promise<StandingsRow[]> {
  const db = createReadClient();
  const { data, error } = await db
    .from("team_seasons")
    .select("*, manager:managers(*)")
    .eq("league_id", leagueId);
  if (error) throw error;

  const rows = (data ?? []) as unknown as (TeamSeason & { manager: Manager | null })[];
  const sorted = [...rows].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return Number(b.fpts_for) - Number(a.fpts_for);
  });

  return sorted.map((row, i) => ({
    ...row,
    rank: i + 1,
    point_diff: Number(row.fpts_for) - Number(row.fpts_against),
  }));
}

export async function getManagerCareerStats() {
  const db = createReadClient();
  const { data, error } = await db
    .from("manager_career_stats")
    .select("*")
    .order("wins", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
