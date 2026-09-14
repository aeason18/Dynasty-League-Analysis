-- A player who was rostered but genuinely never played a snap (did_play
-- false for every row) got NULL total_points/ppg out of these FILTER
-- aggregates -- SUM/ROUND over zero matching rows is NULL, not 0. Postgres
-- sorts NULL first on `order by ... desc` by default, so these all-benched
-- players floated to the very top of the Players page's "highest scorers
-- first" list showing 0s across the board, instead of the bottom where
-- their real 0 total points belongs.
create or replace view player_league_totals as
select
  mp.player_id,
  p.full_name,
  p.position,
  p.team,
  p.status,
  p.active,
  coalesce(sum(mp.points) filter (where mp.did_play is distinct from false), 0) as total_points,
  count(*) filter (where mp.did_play is distinct from false) as games_played,
  coalesce(
    round(
      sum(mp.points) filter (where mp.did_play is distinct from false)
        / nullif(count(*) filter (where mp.did_play is distinct from false), 0),
      2
    ),
    0
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
  coalesce(sum(mp.points) filter (where mp.did_play is distinct from false), 0) as total_points,
  count(*) filter (where mp.did_play is distinct from false) as games_played,
  coalesce(
    round(
      sum(mp.points) filter (where mp.did_play is distinct from false)
        / nullif(count(*) filter (where mp.did_play is distinct from false), 0),
      2
    ),
    0
  ) as ppg
from matchup_players mp
join team_seasons ts on ts.league_id = mp.league_id and ts.roster_id = mp.roster_id
join managers m on m.user_id = ts.manager_id
join players p on p.player_id = mp.player_id
where p.position is distinct from 'DEF'
group by mp.player_id, p.full_name, p.position, ts.manager_id, m.display_name;
