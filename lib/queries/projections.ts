import { createReadClient } from "@/lib/supabase/server";
import { getCurrentLeague } from "@/lib/queries/leagues";
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
