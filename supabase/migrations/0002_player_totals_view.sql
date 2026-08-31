-- League-wide (career, across every manager who ever rostered them) player
-- scoring totals. Powers the Players list/search page.

create or replace view player_league_totals as
select
  mp.player_id,
  p.full_name,
  p.position,
  p.team,
  p.status,
  p.active,
  sum(mp.points) as total_points,
  count(*) as games_played,
  round(sum(mp.points) / nullif(count(*), 0), 2) as ppg
from matchup_players mp
join players p on p.player_id = mp.player_id
group by mp.player_id, p.full_name, p.position, p.team, p.status, p.active;

grant select on player_league_totals to anon, authenticated;
