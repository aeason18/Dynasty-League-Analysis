import { cache } from "react";
import { createReadClient } from "@/lib/supabase/server";
import type { League } from "@/lib/types";

/**
 * Resolves the `[leagueId]` URL segment (a specific season's league_id) to
 * its stable `league_group_id` (the dynasty's chain root) — every query
 * function in lib/queries/ is scoped by the group, not any one season's id.
 * Wrapped in React's `cache()` so the layout's existence-guard and every
 * page's own call within the same request dedupe to a single DB round trip.
 */
export const resolveLeagueGroupId = cache(async (leagueId: string): Promise<string | null> => {
  const db = createReadClient();
  const { data, error } = await db.from("leagues").select("league_group_id").eq("league_id", leagueId).maybeSingle();
  if (error) throw error;
  return data?.league_group_id ?? null;
});

export async function getLeagues(leagueGroupId: string): Promise<League[]> {
  const db = createReadClient();
  const { data, error } = await db
    .from("leagues")
    .select("*")
    .eq("league_group_id", leagueGroupId)
    .order("season", { ascending: true });
  if (error) throw error;
  return (data ?? []) as League[];
}

export async function getCurrentLeague(leagueGroupId: string): Promise<League | null> {
  const db = createReadClient();
  const { data, error } = await db
    .from("leagues")
    .select("*")
    .eq("league_group_id", leagueGroupId)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw error;
  return data as League | null;
}

export async function getLeagueBySeason(leagueGroupId: string, season: string): Promise<League | null> {
  const db = createReadClient();
  const { data, error } = await db
    .from("leagues")
    .select("*")
    .eq("league_group_id", leagueGroupId)
    .eq("season", season)
    .maybeSingle();
  if (error) throw error;
  return data as League | null;
}
