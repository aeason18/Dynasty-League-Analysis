-- Team defenses shouldn't appear in "best players" rankings (Franchise
-- Best Players is built on this view). The Players page's own browse list
-- (player_league_totals) intentionally keeps defenses, since it has an
-- explicit DEF filter for browsing them — only this view changes.

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
where p.position is distinct from 'DEF'
group by mp.player_id, p.full_name, p.position, ts.manager_id, m.display_name;
