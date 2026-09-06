-- The Projections tab (linear regression + Monte Carlo season simulation)
-- was removed at the user's request. The site-wide snap-participation fix
-- it was built on top of (did_play, migration 0009) stays — that fixed
-- real PPG bugs on the Players and Franchise pages unrelated to this
-- feature.

drop table if exists matchup_predictions;
drop table if exists team_season_projections;
drop table if exists player_projections;
