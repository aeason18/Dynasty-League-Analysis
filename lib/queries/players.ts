import { createReadClient } from "@/lib/supabase/server";
import type { MatchupPlayer, Player, PlayerTeamPoints, TeamSeason } from "@/lib/types";

type TeamSeasonWithManager = TeamSeason & { manager: { display_name: string } | null };

export interface PlayerLeagueTotal {
  player_id: string;
  full_name: string | null;
  position: string | null;
  team: string | null;
  status: string | null;
  active: boolean | null;
  total_points: number;
  games_played: number;
  ppg: number;
}

export async function listPlayers(opts: { search?: string; position?: string } = {}): Promise<PlayerLeagueTotal[]> {
  const db = createReadClient();
  let query = db.from("player_league_totals").select("*").order("total_points", { ascending: false });

  if (opts.search) {
    query = query.ilike("full_name", `%${opts.search}%`);
  }
  if (opts.position && opts.position !== "ALL") {
    query = query.eq("position", opts.position);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PlayerLeagueTotal[];
}

export async function getPlayer(playerId: string): Promise<Player | null> {
  const db = createReadClient();
  const { data, error } = await db.from("players").select("*").eq("player_id", playerId).maybeSingle();
  if (error) throw error;
  return data as Player | null;
}

export async function getPlayerTeamSplits(playerId: string): Promise<PlayerTeamPoints[]> {
  const db = createReadClient();
  const { data, error } = await db
    .from("player_team_points")
    .select("*")
    .eq("player_id", playerId)
    .order("total_points", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PlayerTeamPoints[];
}

export interface PlayerGameLog {
  season: string;
  week: number;
  points: number;
  is_starter: boolean;
  did_play: boolean | null;
  manager_name: string | null;
  team_name: string | null;
}

export async function getPlayerGameLog(playerId: string): Promise<PlayerGameLog[]> {
  const db = createReadClient();
  const [{ data: mp, error: mpErr }, { data: leagues, error: lErr }, { data: teamSeasons, error: tErr }] =
    await Promise.all([
      db.from("matchup_players").select("*").eq("player_id", playerId),
      db.from("leagues").select("league_id, season"),
      db.from("team_seasons").select("*, manager:managers(display_name)"),
    ]);
  if (mpErr) throw mpErr;
  if (lErr) throw lErr;
  if (tErr) throw tErr;

  const seasonByLeague = new Map((leagues ?? []).map((l) => [l.league_id, l.season as string]));
  const teamByKey = new Map(
    ((teamSeasons ?? []) as unknown as TeamSeasonWithManager[]).map((t) => [
      `${t.league_id}:${t.roster_id}`,
      t,
    ])
  );

  return ((mp ?? []) as MatchupPlayer[])
    .map((row) => {
      const team = teamByKey.get(`${row.league_id}:${row.roster_id}`);
      return {
        season: seasonByLeague.get(row.league_id) ?? "",
        week: row.week,
        points: Number(row.points),
        is_starter: row.is_starter,
        did_play: row.did_play,
        manager_name: team?.manager?.display_name ?? null,
        team_name: team?.team_name ?? null,
      };
    })
    .sort((a, b) => (a.season === b.season ? a.week - b.week : a.season.localeCompare(b.season)));
}
