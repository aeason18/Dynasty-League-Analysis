-- Multi-tenant support: let more than one dynasty league's data live in this
-- database. A Sleeper league's `league_id` changes every season, so it can't
-- identify "this dynasty" across time — `league_group_id` (the oldest
-- league_id in the previous_league_id chain, i.e. the dynasty's very first
-- season) is the stable tenant identifier, stamped onto every per-league
-- table going forward by scripts/ingest.ts.
--
-- Backfill assumes exactly one tenant exists in the database at migration
-- time (true as of writing — this is still a single-league deployment).
-- Anything ingested after this migration stamps league_group_id itself; this
-- backfill only needs to cover data that predates the concept.

alter table leagues add column if not exists league_group_id text;
alter table team_seasons add column if not exists league_group_id text;
alter table roster_players add column if not exists league_group_id text;
alter table drafts add column if not exists league_group_id text;
alter table traded_picks add column if not exists league_group_id text;
alter table matchups add column if not exists league_group_id text;
alter table matchup_players add column if not exists league_group_id text;
alter table playoff_results add column if not exists league_group_id text;
alter table transactions add column if not exists league_group_id text;
alter table resolved_draft_picks add column if not exists league_group_id text;

-- Resolve each league's chain root via previous_league_id and backfill.
with recursive walk as (
  select league_id as start_id, league_id as cur, previous_league_id as prev
  from leagues
  union all
  select w.start_id, l.league_id as cur, l.previous_league_id as prev
  from walk w
  join leagues l on l.league_id = w.prev
)
update leagues target
set league_group_id = w.cur
from walk w
where w.start_id = target.league_id and w.prev is null;

update team_seasons t set league_group_id = l.league_group_id from leagues l where l.league_id = t.league_id;
update roster_players t set league_group_id = l.league_group_id from leagues l where l.league_id = t.league_id;
update drafts t set league_group_id = l.league_group_id from leagues l where l.league_id = t.league_id;
update traded_picks t set league_group_id = l.league_group_id from leagues l where l.league_id = t.league_id;
update matchups t set league_group_id = l.league_group_id from leagues l where l.league_id = t.league_id;
update matchup_players t set league_group_id = l.league_group_id from leagues l where l.league_id = t.league_id;
update playoff_results t set league_group_id = l.league_group_id from leagues l where l.league_id = t.league_id;
update transactions t set league_group_id = l.league_group_id from leagues l where l.league_id = t.league_id;

-- resolved_draft_picks has no league_id column to correlate from (it never
-- needed one under the single-tenant assumption this migration is fixing).
-- Safe to backfill to "the" one existing group since only one tenant exists
-- pre-migration; every row inserted after this point carries its own real
-- league_group_id (see scripts/resolve-draft-picks.ts).
update resolved_draft_picks
set league_group_id = (select league_group_id from leagues where is_current = true limit 1)
where league_group_id is null;

alter table leagues alter column league_group_id set not null;
alter table team_seasons alter column league_group_id set not null;
alter table roster_players alter column league_group_id set not null;
alter table drafts alter column league_group_id set not null;
alter table traded_picks alter column league_group_id set not null;
alter table matchups alter column league_group_id set not null;
alter table matchup_players alter column league_group_id set not null;
alter table playoff_results alter column league_group_id set not null;
alter table transactions alter column league_group_id set not null;
alter table resolved_draft_picks alter column league_group_id set not null;

create index if not exists leagues_group_idx on leagues (league_group_id);
create index if not exists team_seasons_group_idx on team_seasons (league_group_id);
create index if not exists roster_players_group_idx on roster_players (league_group_id);
create index if not exists drafts_group_idx on drafts (league_group_id);
create index if not exists traded_picks_group_idx on traded_picks (league_group_id);
create index if not exists matchups_group_idx on matchups (league_group_id);
create index if not exists matchup_players_group_idx on matchup_players (league_group_id);
create index if not exists playoff_results_group_idx on playoff_results (league_group_id);
create index if not exists transactions_group_idx on transactions (league_group_id);

-- `leagues.season` was globally unique (one league per season, period) under
-- the single-tenant assumption. Two different dynasties can both have a
-- "2023" season, so uniqueness must be scoped per tenant instead.
drop index if exists leagues_season_key;
create unique index if not exists leagues_group_season_key on leagues (league_group_id, season);

-- Fix a real cross-tenant bug: resolved_draft_picks was keyed only by
-- (season, round, original_roster_id) with no league scoping at all — two
-- different leagues' picks would silently collide and overwrite each other
-- on upsert (roster_id 1-8 isn't globally unique). Rekey with the tenant id.
alter table resolved_draft_picks drop constraint resolved_draft_picks_pkey;
alter table resolved_draft_picks add primary key (league_group_id, season, round, original_roster_id);
