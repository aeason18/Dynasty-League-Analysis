-- A player's fantasy scoring history includes weeks they were rostered but
-- genuinely didn't play at all (bye, injury, healthy scratch) — those
-- should count as "0 snaps", not "a game", when computing career/season
-- PPG anywhere in the app. `did_play` is backfilled from Sleeper's real
-- per-player weekly stats (scripts/backfill-snap-participation.ts) and
-- populated going forward by scripts/ingest.ts. Nullable so existing rows
-- read as "played" (old behavior) until backfilled — never treat null as
-- "didn't play".
alter table matchup_players add column if not exists did_play boolean;
create index if not exists matchup_players_did_play_idx on matchup_players (did_play);

create or replace view player_league_totals as
select
  mp.player_id,
  p.full_name,
  p.position,
  p.team,
  p.status,
  p.active,
  sum(mp.points) filter (where mp.did_play is distinct from false) as total_points,
  count(*) filter (where mp.did_play is distinct from false) as games_played,
  round(
    sum(mp.points) filter (where mp.did_play is distinct from false)
      / nullif(count(*) filter (where mp.did_play is distinct from false), 0),
    2
  ) as ppg
from matchup_players mp
join players p on p.player_id = mp.player_id
group by mp.player_id, p.full_name, p.position, p.team, p.status, p.active;

create or replace view player_team_points as
select
  mp.player_id,
  p.full_name as player_name,
  p.position as player_position,
  ts.manager_id,
  m.display_name as manager_name,
  sum(mp.points) filter (where mp.did_play is distinct from false) as total_points,
  count(*) filter (where mp.did_play is distinct from false) as games_played,
  round(
    sum(mp.points) filter (where mp.did_play is distinct from false)
      / nullif(count(*) filter (where mp.did_play is distinct from false), 0),
    2
  ) as ppg
from matchup_players mp
join team_seasons ts on ts.league_id = mp.league_id and ts.roster_id = mp.roster_id
join managers m on m.user_id = ts.manager_id
join players p on p.player_id = mp.player_id
where p.position is distinct from 'DEF'
group by mp.player_id, p.full_name, p.position, ts.manager_id, m.display_name;
