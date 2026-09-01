-- Trade value analysis: FantasyCalc market values + resolved draft picks
-- (a traded pick that has since been used in a draft, mapped to the actual
-- player selected). See scripts/sync-fantasycalc.ts and
-- scripts/resolve-draft-picks.ts.

create table if not exists fantasycalc_values (
  fc_id int primary key,
  sleeper_player_id text references players (player_id),
  name text not null,
  position text not null,
  is_pick boolean not null default false,
  pick_season int,
  pick_round int,
  pick_tier text check (pick_tier in ('exact', 'early', 'mid', 'late')),
  value int not null,
  synced_at timestamptz not null default now()
);
create index if not exists fantasycalc_values_sleeper_player_idx on fantasycalc_values (sleeper_player_id);
create index if not exists fantasycalc_values_pick_idx on fantasycalc_values (pick_season, pick_round) where is_pick;

create table if not exists resolved_draft_picks (
  season text not null,
  round int not null,
  original_roster_id int not null,
  resolved_player_id text not null references players (player_id),
  draft_id text not null,
  pick_no int not null,
  primary key (season, round, original_roster_id)
);

alter table fantasycalc_values enable row level security;
alter table resolved_draft_picks enable row level security;

drop policy if exists public_read on fantasycalc_values;
create policy public_read on fantasycalc_values for select using (true);
drop policy if exists public_read on resolved_draft_picks;
create policy public_read on resolved_draft_picks for select using (true);

grant select on fantasycalc_values, resolved_draft_picks to anon, authenticated;
