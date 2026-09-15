-- Multi-tenant follow-up: the three shared aggregate views joined data with
-- no league scoping at all, so a manager or player who appears in more than
-- one onboarded league would show stats blended across all of them. Add
-- league_group_id to each view's select + group by (available now via
-- matchup_players.league_group_id / team_seasons.league_group_id) so
-- callers can filter to one tenant. Aggregation logic itself is unchanged.

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
  coalesce(sum(ts.fpts_against), 0) as fpts_against,
  ts.league_group_id
from managers m
join team_seasons ts on ts.manager_id = m.user_id
group by m.user_id, m.display_name, m.avatar, ts.league_group_id;

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
  ) as ppg,
  mp.league_group_id
from matchup_players mp
join players p on p.player_id = mp.player_id
group by mp.player_id, p.full_name, p.position, p.team, p.status, p.active, mp.league_group_id;

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
  ) as ppg,
  mp.league_group_id
from matchup_players mp
join team_seasons ts on ts.league_id = mp.league_id and ts.roster_id = mp.roster_id
join managers m on m.user_id = ts.manager_id
join players p on p.player_id = mp.player_id
where p.position is distinct from 'DEF'
group by mp.player_id, p.full_name, p.position, ts.manager_id, m.display_name, mp.league_group_id;
