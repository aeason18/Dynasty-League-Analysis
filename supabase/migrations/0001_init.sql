-- Fantasy League Archive: initial schema
-- Normalized around the real shapes returned by api.sleeper.app (see lib/sleeper/types.ts).
-- Franchise identity across seasons is the Sleeper user_id (managers.user_id / team_seasons.manager_id),
-- since Sleeper reissues league_id and renumbers roster_id every season.

create table if not exists managers (
  user_id text primary key,
  display_name text not null,
  avatar text
);

create table if not exists leagues (
  league_id text primary key,
  season text not null,
  name text not null,
  status text not null,
  total_rosters int not null,
  playoff_week_start int,
  roster_positions text[] not null default '{}',
  settings jsonb not null default '{}',
  scoring_settings jsonb not null default '{}',
  previous_league_id text references leagues (league_id),
  is_current boolean not null default false,
  synced_at timestamptz not null default now()
);
create unique index if not exists leagues_season_key on leagues (season);

create table if not exists team_seasons (
  league_id text not null references leagues (league_id) on delete cascade,
  roster_id int not null,
  manager_id text references managers (user_id),
  team_name text,
  division int,
  wins int not null default 0,
  losses int not null default 0,
  ties int not null default 0,
  fpts_for numeric(8, 2) not null default 0,
  fpts_against numeric(8, 2) not null default 0,
  potential_points numeric(8, 2),
  waiver_budget_used int,
  moves int,
  final_standing int,
  playoff_result text,
  primary key (league_id, roster_id)
);
create index if not exists team_seasons_manager_idx on team_seasons (manager_id);

create table if not exists players (
  player_id text primary key,
  full_name text,
  first_name text,
  last_name text,
  position text,
  fantasy_positions text[],
  team text,
  status text,
  active boolean,
  years_exp int,
  birth_date date,
  college text,
  height text,
  weight text
);

create table if not exists roster_players (
  league_id text not null references leagues (league_id) on delete cascade,
  roster_id int not null,
  player_id text not null references players (player_id),
  slot text not null check (slot in ('starter', 'bench', 'reserve', 'taxi')),
  primary key (league_id, roster_id, player_id),
  foreign key (league_id, roster_id) references team_seasons (league_id, roster_id) on delete cascade
);
create index if not exists roster_players_player_idx on roster_players (player_id);

create table if not exists drafts (
  draft_id text primary key,
  league_id text not null references leagues (league_id) on delete cascade,
  season text not null,
  type text,
  rounds int,
  status text,
  settings jsonb default '{}'
);
create index if not exists drafts_league_idx on drafts (league_id);

create table if not exists draft_picks (
  draft_id text not null references drafts (draft_id) on delete cascade,
  pick_no int not null,
  round int not null,
  draft_slot int,
  roster_id int,
  player_id text references players (player_id),
  is_keeper boolean,
  primary key (draft_id, pick_no)
);
create index if not exists draft_picks_player_idx on draft_picks (player_id);

create table if not exists traded_picks (
  id bigserial primary key,
  league_id text not null references leagues (league_id) on delete cascade,
  season text not null,
  round int not null,
  original_roster_id int not null,
  previous_owner_roster_id int not null,
  new_owner_roster_id int not null,
  unique (league_id, season, round, original_roster_id, new_owner_roster_id)
);

create table if not exists matchups (
  league_id text not null references leagues (league_id) on delete cascade,
  week int not null,
  roster_id int not null,
  matchup_id int,
  points numeric(7, 2) not null,
  is_playoff boolean not null default false,
  playoff_round int,
  primary key (league_id, week, roster_id)
);
create index if not exists matchups_league_week_idx on matchups (league_id, week);

create table if not exists matchup_players (
  league_id text not null references leagues (league_id) on delete cascade,
  week int not null,
  roster_id int not null,
  player_id text not null references players (player_id),
  points numeric(6, 2) not null default 0,
  is_starter boolean not null default false,
  primary key (league_id, week, roster_id, player_id),
  foreign key (league_id, week, roster_id) references matchups (league_id, week, roster_id) on delete cascade
);
create index if not exists matchup_players_player_idx on matchup_players (player_id);
create index if not exists matchup_players_roster_idx on matchup_players (league_id, roster_id);

create table if not exists playoff_results (
  id bigserial primary key,
  league_id text not null references leagues (league_id) on delete cascade,
  bracket text not null default 'winners' check (bracket in ('winners', 'losers')),
  round int not null,
  match_id int not null,
  roster_id_1 int,
  roster_id_2 int,
  winner_roster_id int,
  placement int,
  unique (league_id, bracket, match_id)
);

create table if not exists transactions (
  transaction_id text primary key,
  league_id text not null references leagues (league_id) on delete cascade,
  week int,
  type text not null,
  status text not null,
  creator_manager_id text references managers (user_id),
  roster_ids int[] default '{}',
  adds jsonb,
  drops jsonb,
  waiver_budget jsonb,
  draft_picks jsonb,
  created_at timestamptz
);
create index if not exists transactions_league_week_idx on transactions (league_id, week);

create table if not exists transaction_players (
  transaction_id text not null references transactions (transaction_id) on delete cascade,
  player_id text not null references players (player_id),
  roster_id int not null,
  action text not null check (action in ('add', 'drop')),
  primary key (transaction_id, player_id, roster_id, action)
);
create index if not exists transaction_players_player_idx on transaction_players (player_id);

-- Shared aggregates, reused across the Dashboard/Franchise/Records pages.

create or replace view manager_career_stats as
select
  m.user_id as manager_id,
  m.display_name,
  m.avatar,
  count(distinct ts.league_id) as seasons_played,
  coalesce(sum(ts.wins), 0) as wins,
  coalesce(sum(ts.losses), 0) as losses,
  coalesce(sum(ts.ties), 0) as ties,
  coalesce(sum(ts.fpts_for), 0) as fpts_for,
  coalesce(sum(ts.fpts_against), 0) as fpts_against
from managers m
join team_seasons ts on ts.manager_id = m.user_id
group by m.user_id, m.display_name, m.avatar;

create or replace view player_team_points as
select
  mp.player_id,
  p.full_name as player_name,
  p.position as player_position,
  ts.manager_id,
  m.display_name as manager_name,
  sum(mp.points) as total_points,
  count(*) as games_played,
  round(sum(mp.points) / nullif(count(*), 0), 2) as ppg
from matchup_players mp
join team_seasons ts on ts.league_id = mp.league_id and ts.roster_id = mp.roster_id
join managers m on m.user_id = ts.manager_id
join players p on p.player_id = mp.player_id
group by mp.player_id, p.full_name, p.position, ts.manager_id, m.display_name;

-- Row Level Security: public read-only. All writes happen server-side via the
-- service_role key in scripts/ingest.ts, which bypasses RLS entirely.

alter table managers enable row level security;
alter table leagues enable row level security;
alter table team_seasons enable row level security;
alter table players enable row level security;
alter table roster_players enable row level security;
alter table drafts enable row level security;
alter table draft_picks enable row level security;
alter table traded_picks enable row level security;
alter table matchups enable row level security;
alter table matchup_players enable row level security;
alter table playoff_results enable row level security;
alter table transactions enable row level security;
alter table transaction_players enable row level security;

drop policy if exists public_read on managers;
create policy public_read on managers for select using (true);
drop policy if exists public_read on leagues;
create policy public_read on leagues for select using (true);
drop policy if exists public_read on team_seasons;
create policy public_read on team_seasons for select using (true);
drop policy if exists public_read on players;
create policy public_read on players for select using (true);
drop policy if exists public_read on roster_players;
create policy public_read on roster_players for select using (true);
drop policy if exists public_read on drafts;
create policy public_read on drafts for select using (true);
drop policy if exists public_read on draft_picks;
create policy public_read on draft_picks for select using (true);
drop policy if exists public_read on traded_picks;
create policy public_read on traded_picks for select using (true);
drop policy if exists public_read on matchups;
create policy public_read on matchups for select using (true);
drop policy if exists public_read on matchup_players;
create policy public_read on matchup_players for select using (true);
drop policy if exists public_read on playoff_results;
create policy public_read on playoff_results for select using (true);
drop policy if exists public_read on transactions;
create policy public_read on transactions for select using (true);
drop policy if exists public_read on transaction_players;
create policy public_read on transaction_players for select using (true);

grant select on all tables in schema public to anon, authenticated;
grant usage on schema public to anon, authenticated;
