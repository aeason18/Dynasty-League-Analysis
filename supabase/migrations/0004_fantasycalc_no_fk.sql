-- fantasycalc_values covers FantasyCalc's whole fantasy-relevant player
-- universe, not just players who've appeared in this league, so
-- sleeper_player_id can't be a referential FK to our (league-scoped)
-- players table.

alter table fantasycalc_values drop constraint if exists fantasycalc_values_sleeper_player_id_fkey;
