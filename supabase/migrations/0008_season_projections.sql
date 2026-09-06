-- Season Projections: a linear regression (fit per position on this
-- league's own season-over-season player scoring history) projects each
-- rostered player's expected PPG for the current season, which feeds a
-- Monte Carlo simulation of the remaining schedule to produce projected
-- records, playoff odds, and weekly win probabilities. See
-- lib/projections/ and scripts/sync-projections.ts. Runs entirely on data
-- already in this database — no external API.

create table if not exists player_projections (
  player_id text not null references players (player_id),
  season text not null,
  position text not null,
  projected_ppg numeric(6, 2) not null,
  basis text not null check (basis in ('regression', 'position_average')),
  prior_season_ppg numeric(6, 2),
  prior_season_games int,
  computed_at timestamptz not null default now(),
  primary key (player_id, season)
);
create index if not exists player_projections_season_idx on player_projections (season);

create table if not exists team_season_projections (
  league_id text not null references leagues (league_id) on delete cascade,
  roster_id int not null,
  season text not null,
  projected_lineup_ppg numeric(6, 2) not null,
  mean_wins numeric(4, 2) not null,
  median_wins int not null,
  playoff_probability numeric(5, 4) not null,
  avg_final_standing numeric(4, 2) not null,
  standing_distribution jsonb not null,
  simulations int not null,
  computed_at timestamptz not null default now(),
  primary key (league_id, roster_id)
);

create table if not exists matchup_predictions (
  league_id text not null references leagues (league_id) on delete cascade,
  week int not null,
  roster_id int not null,
  opponent_roster_id int not null,
  matchup_id int not null,
  win_probability numeric(5, 4) not null,
  projected_points numeric(6, 2) not null,
  opponent_projected_points numeric(6, 2) not null,
  computed_at timestamptz not null default now(),
  primary key (league_id, week, roster_id)
);
create index if not exists matchup_predictions_week_idx on matchup_predictions (league_id, week);

alter table player_projections enable row level security;
alter table team_season_projections enable row level security;
alter table matchup_predictions enable row level security;

drop policy if exists public_read on player_projections;
create policy public_read on player_projections for select using (true);
drop policy if exists public_read on team_season_projections;
create policy public_read on team_season_projections for select using (true);
drop policy if exists public_read on matchup_predictions;
create policy public_read on matchup_predictions for select using (true);

grant select on player_projections, team_season_projections, matchup_predictions to anon, authenticated;
