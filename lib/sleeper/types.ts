// Types mirror the actual shapes returned by api.sleeper.app, confirmed by
// direct inspection against this league's real data. Only fields we
// actually use are typed; everything else is left to widen safely.

export interface SleeperUser {
  user_id: string;
  username: string | null;
  display_name: string;
  avatar: string | null;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  season_type: string;
  status: string;
  sport: string;
  total_rosters: number;
  previous_league_id: string | null;
  draft_id: string | null;
  avatar: string | null;
  settings: {
    playoff_week_start?: number;
    playoff_teams?: number;
    num_teams?: number;
    divisions?: number;
    type?: number;
    [key: string]: unknown;
  };
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  metadata: Record<string, unknown> | null;
}

export interface SleeperLeagueUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  is_owner: boolean | null;
  metadata: {
    team_name?: string;
    [key: string]: unknown;
  } | null;
}

export interface SleeperRosterSettings {
  wins?: number;
  losses?: number;
  ties?: number;
  fpts?: number;
  fpts_decimal?: number;
  fpts_against?: number;
  fpts_against_decimal?: number;
  ppts?: number;
  ppts_decimal?: number;
  waiver_budget_used?: number;
  total_moves?: number;
  division?: number;
  [key: string]: unknown;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  league_id: string;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  taxi: string[] | null;
  settings: SleeperRosterSettings;
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number | null;
  points: number;
  players: string[] | null;
  starters: string[] | null;
  starters_points: number[] | null;
  players_points: Record<string, number> | null;
  custom_points: number | null;
}

export interface SleeperBracketMatch {
  r: number; // round
  m: number; // match id
  t1: number | string | null; // roster_id, or { w: matchId } reference resolved via t1_from
  t2: number | string | null;
  w?: number; // winning roster_id
  l?: number; // losing roster_id
  p?: number; // placement this match determines (1 = championship, 3 = third place, etc.)
  t1_from?: { w?: number; l?: number };
  t2_from?: { w?: number; l?: number };
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  season: string;
  season_type: string;
  type: string;
  status: string;
  start_time: number | null;
  /** sleeper_user_id -> draft slot (1-indexed). The original per-slot
   * roster ownership signal for pick trading — NOT reverse-standings order
   * (verified against real data; see scripts/resolve-draft-picks.ts). */
  draft_order: Record<string, number> | null;
  settings: {
    rounds?: number;
    teams?: number;
    [key: string]: unknown;
  };
  metadata: Record<string, unknown> | null;
}

export interface SleeperDraftPick {
  draft_id: string;
  round: number;
  pick_no: number;
  draft_slot: number;
  roster_id: number | null;
  picked_by: string | null;
  player_id: string;
  is_keeper: boolean | null;
}

export interface SleeperTradedPick {
  season: string;
  round: number;
  roster_id: number;
  owner_id: number;
  previous_owner_id: number;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: string;
  status: string;
  leg: number;
  creator: string | null;
  created: number;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  waiver_budget: { sender: number; receiver: number; amount: number }[] | null;
  draft_picks: {
    season: string;
    round: number;
    roster_id: number;
    previous_owner_id: number;
    owner_id: number;
  }[];
}

export interface SleeperPlayer {
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

export interface SleeperNflState {
  season: string;
  season_type: string;
  week: number;
  display_week: number;
  previous_season: string;
}
