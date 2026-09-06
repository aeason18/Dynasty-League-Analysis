// Row shapes mirroring supabase/migrations/0001_init.sql. Hand-written
// rather than generated since we don't have Supabase CLI project linkage —
// keep these in sync with the migration if the schema changes.

export interface League {
  league_id: string;
  season: string;
  name: string;
  status: string;
  total_rosters: number;
  playoff_week_start: number | null;
  roster_positions: string[];
  settings: Record<string, unknown>;
  scoring_settings: Record<string, number>;
  previous_league_id: string | null;
  is_current: boolean;
}

export interface Manager {
  user_id: string;
  display_name: string;
  avatar: string | null;
}

export interface TeamSeason {
  league_id: string;
  roster_id: number;
  manager_id: string | null;
  team_name: string | null;
  division: number | null;
  wins: number;
  losses: number;
  ties: number;
  fpts_for: number;
  fpts_against: number;
  potential_points: number | null;
  waiver_budget_used: number | null;
  moves: number | null;
  final_standing: number | null;
  playoff_result: string | null;
}

export interface Player {
  player_id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  fantasy_positions: string[] | null;
  team: string | null;
  status: string | null;
  active: boolean | null;
  years_exp: number | null;
  birth_date: string | null;
  college: string | null;
  height: string | null;
  weight: string | null;
}

export interface Matchup {
  league_id: string;
  week: number;
  roster_id: number;
  matchup_id: number | null;
  points: number;
  is_playoff: boolean;
  playoff_round: number | null;
}

export interface MatchupPlayer {
  league_id: string;
  week: number;
  roster_id: number;
  player_id: string;
  points: number;
  is_starter: boolean;
  did_play: boolean | null;
}

export interface PlayoffResult {
  id: number;
  league_id: string;
  bracket: "winners" | "losers";
  round: number;
  match_id: number;
  roster_id_1: number | null;
  roster_id_2: number | null;
  winner_roster_id: number | null;
  placement: number | null;
}

export interface Transaction {
  transaction_id: string;
  league_id: string;
  week: number | null;
  type: string;
  status: string;
  creator_manager_id: string | null;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: { round: number; season: string; roster_id: number; owner_id: number; previous_owner_id: number }[];
  waiver_budget: { sender: number; receiver: number; amount: number }[];
  created_at: string | null;
}

export interface ManagerCareerStats {
  manager_id: string;
  display_name: string;
  avatar: string | null;
  seasons_played: number;
  wins: number;
  losses: number;
  ties: number;
  fpts_for: number;
  fpts_against: number;
}

export interface PlayerTeamPoints {
  player_id: string;
  player_name: string | null;
  player_position: string | null;
  manager_id: string;
  manager_name: string;
  total_points: number;
  games_played: number;
  ppg: number;
}
