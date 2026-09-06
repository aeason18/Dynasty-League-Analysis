-- The public Sentiment tab (news search + LLM scoring) turned out to be
-- impractical: it needed an external news API + LLM account, and Vercel AI
-- Gateway's free tier proved too rate-limited for real multi-user use.
-- Replaced with a season projection model (see 0008_season_projections.sql)
-- that needs no external API and runs entirely on this league's own data.

drop table if exists player_sentiment_articles;
drop table if exists player_sentiment_snapshots;
drop table if exists nfl_player_index;
