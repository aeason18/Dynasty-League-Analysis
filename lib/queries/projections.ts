import { createReadClient } from "@/lib/supabase/server";
import { getCurrentLeague } from "@/lib/queries/leagues";
import { pickOptimalLineup, type ProjectedRosterPlayer } from "@/lib/projections/lineup";
import type { Manager, TeamSeason } from "@/lib/types";

type TeamSeasonWithManager = TeamSeason & { manager: Manager | null };

export interface TeamProjectionRow {
  roster_id: number;
  team_name: string | null;
  manager: Manager | null;
  wins: number;
  losses: number;
  projected_lineup_ppg: number;
  mean_wins: number;
  median_wins: number;
  playoff_probability: number;
  avg_final_standing: number;
  standing_distribution: Record<string, number>;
  simulations: number;
}

export async function getTeamProjections(): Promise<TeamProjectionRow[]> {
  const league = await getCurrentLeague();
  if (!league) return [];
  const db = createReadClient();
  const [{ data: projections, error: pErr }, { data: teamSeasons, error: tErr }] = await Promise.all([
    db.from("team_season_projections").select("*").eq("league_id", league.league_id),
    db.from("team_seasons").select("*, manager:managers(*)").eq("league_id", league.league_id),
  ]);
  if (pErr) throw pErr;
  if (tErr) throw tErr;

  const teamByRoster = new Map(((teamSeasons ?? []) as unknown as TeamSeasonWithManager[]).map((t) => [t.roster_id, t]));

  return (projections ?? [])
    .map((p) => {
      const team = teamByRoster.get(p.roster_id);
      return {
        roster_id: p.roster_id,
        team_name: team?.team_name ?? null,
        manager: team?.manager ?? null,
        wins: team?.wins ?? 0,
        losses: team?.losses ?? 0,
        projected_lineup_ppg: Number(p.projected_lineup_ppg),
        mean_wins: Number(p.mean_wins),
        median_wins: p.median_wins,
        playoff_probability: Number(p.playoff_probability),
        avg_final_standing: Number(p.avg_final_standing),
        standing_distribution: p.standing_distribution as Record<string, number>,
        simulations: p.simulations,
      };
    })
    .sort((a, b) => b.mean_wins - a.mean_wins);
}

export interface MatchupPredictionRow {
  week: number;
  roster_id: number;
  team_name: string | null;
  manager_name: string | null;
  opponent_roster_id: number;
  opponent_team_name: string | null;
  opponent_manager_name: string | null;
  win_probability: number;
  projected_points: number;
  opponent_projected_points: number;
}

export async function getNextWeekPredictions(): Promise<MatchupPredictionRow[]> {
  const league = await getCurrentLeague();
  if (!league) return [];
  const db = createReadClient();
  const [{ data: predictions, error: predErr }, { data: teamSeasons, error: tErr }] = await Promise.all([
    db.from("matchup_predictions").select("*").eq("league_id", league.league_id).order("week", { ascending: true }),
    db.from("team_seasons").select("*, manager:managers(*)").eq("league_id", league.league_id),
  ]);
  if (predErr) throw predErr;
  if (tErr) throw tErr;
  if (!predictions || predictions.length === 0) return [];

  const teamByRoster = new Map(((teamSeasons ?? []) as unknown as TeamSeasonWithManager[]).map((t) => [t.roster_id, t]));
  const nextWeek = predictions[0].week;

  return predictions
    .filter((p) => p.week === nextWeek && p.roster_id < p.opponent_roster_id)
    .map((p) => {
      const team = teamByRoster.get(p.roster_id);
      const opponent = teamByRoster.get(p.opponent_roster_id);
      return {
        week: p.week,
        roster_id: p.roster_id,
        team_name: team?.team_name ?? null,
        manager_name: team?.manager?.display_name ?? null,
        opponent_roster_id: p.opponent_roster_id,
        opponent_team_name: opponent?.team_name ?? null,
        opponent_manager_name: opponent?.manager?.display_name ?? null,
        win_probability: Number(p.win_probability),
        projected_points: Number(p.projected_points),
        opponent_projected_points: Number(p.opponent_projected_points),
      };
    });
}

export interface TeamProjectionDetail extends TeamProjectionRow {
  ties: number;
}

export async function getTeamProjectionDetail(rosterId: number): Promise<TeamProjectionDetail | null> {
  const rows = await getTeamProjections();
  const row = rows.find((r) => r.roster_id === rosterId);
  if (!row) return null;
  const league = await getCurrentLeague();
  const db = createReadClient();
  const { data: teamSeason } = await db
    .from("team_seasons")
    .select("ties")
    .eq("league_id", league?.league_id ?? "")
    .eq("roster_id", rosterId)
    .maybeSingle();
  return { ...row, ties: teamSeason?.ties ?? 0 };
}

export interface RosterProjectionEntry {
  player_id: string;
  full_name: string | null;
  position: string;
  projected_ppg: number;
  basis: "regression" | "position_average";
  prior_season_ppg: number | null;
  slot: string | null; // the lineup slot this player fills if they're a starter, else null (bench)
}

export interface TeamRosterBreakdown {
  starters: RosterProjectionEntry[];
  bench: RosterProjectionEntry[];
}

export async function getTeamRosterBreakdown(rosterId: number): Promise<TeamRosterBreakdown> {
  const league = await getCurrentLeague();
  if (!league) return { starters: [], bench: [] };
  const db = createReadClient();

  const [{ data: rosterPlayers, error: rpErr }] = await Promise.all([
    db.from("roster_players").select("player_id").eq("league_id", league.league_id).eq("roster_id", rosterId),
  ]);
  if (rpErr) throw rpErr;
  const playerIds = (rosterPlayers ?? []).map((r) => r.player_id);
  if (playerIds.length === 0) return { starters: [], bench: [] };

  const [{ data: projections, error: projErr }, { data: players, error: playersErr }] = await Promise.all([
    db.from("player_projections").select("*").eq("season", league.season).in("player_id", playerIds),
    db.from("players").select("player_id, full_name").in("player_id", playerIds),
  ]);
  if (projErr) throw projErr;
  if (playersErr) throw playersErr;

  const nameById = new Map((players ?? []).map((p) => [p.player_id, p.full_name]));
  const projectable: (ProjectedRosterPlayer & { basis: "regression" | "position_average"; prior_season_ppg: number | null })[] = (
    projections ?? []
  ).map((p) => ({
    player_id: p.player_id,
    position: p.position,
    projected_ppg: Number(p.projected_ppg),
    basis: p.basis,
    prior_season_ppg: p.prior_season_ppg !== null ? Number(p.prior_season_ppg) : null,
  }));

  const { slots } = pickOptimalLineup(projectable, league.roster_positions);
  const starterIds = new Set(slots.map((s) => s.player.player_id));
  const slotByPlayerId = new Map(slots.map((s) => [s.player.player_id, s.slot]));

  const toEntry = (p: (typeof projectable)[number]): RosterProjectionEntry => ({
    player_id: p.player_id,
    full_name: nameById.get(p.player_id) ?? p.player_id,
    position: p.position,
    projected_ppg: p.projected_ppg,
    basis: p.basis,
    prior_season_ppg: p.prior_season_ppg,
    slot: slotByPlayerId.get(p.player_id) ?? null,
  });

  const starters = slots
    .map((s) => toEntry(projectable.find((p) => p.player_id === s.player.player_id)!))
    .sort((a, b) => b.projected_ppg - a.projected_ppg);
  const bench = projectable
    .filter((p) => !starterIds.has(p.player_id))
    .map(toEntry)
    .sort((a, b) => b.projected_ppg - a.projected_ppg);

  return { starters, bench };
}

export interface ScheduleWeek {
  week: number;
  opponent_roster_id: number;
  opponent_team_name: string | null;
  opponent_manager_name: string | null;
  win_probability: number;
  projected_points: number;
  opponent_projected_points: number;
}

export async function getTeamSchedule(rosterId: number): Promise<ScheduleWeek[]> {
  const league = await getCurrentLeague();
  if (!league) return [];
  const db = createReadClient();
  const [{ data: predictions, error: predErr }, { data: teamSeasons, error: tErr }] = await Promise.all([
    db
      .from("matchup_predictions")
      .select("*")
      .eq("league_id", league.league_id)
      .eq("roster_id", rosterId)
      .order("week", { ascending: true }),
    db.from("team_seasons").select("*, manager:managers(*)").eq("league_id", league.league_id),
  ]);
  if (predErr) throw predErr;
  if (tErr) throw tErr;

  const teamByRoster = new Map(((teamSeasons ?? []) as unknown as TeamSeasonWithManager[]).map((t) => [t.roster_id, t]));

  return (predictions ?? []).map((p) => {
    const opponent = teamByRoster.get(p.opponent_roster_id);
    return {
      week: p.week,
      opponent_roster_id: p.opponent_roster_id,
      opponent_team_name: opponent?.team_name ?? null,
      opponent_manager_name: opponent?.manager?.display_name ?? null,
      win_probability: Number(p.win_probability),
      projected_points: Number(p.projected_points),
      opponent_projected_points: Number(p.opponent_projected_points),
    };
  });
}
