-- Public "Sentiment" tab: search any active NFL skill-position player, pull
-- recent news via Exa, and have an LLM judge relevance + sentiment per
-- article (see lib/sentiment/). Weekly refresh happens in the same
-- GitHub Actions sync as everything else (scripts/sync-sentiment.ts). A
-- narrow exception to the "service-role key only in scripts/" rule also
-- lets app/api/sentiment/analyze compute on demand for a player with no
-- history yet — see the comment in that route for why.

-- Reference list of real, active NFL players a search can resolve to. This
-- is what keeps searches football-related: the UI only ever offers/accepts
-- player_ids from this table, never arbitrary free text, so nothing
-- unrelated to football ever reaches Exa or the LLM. Populated from
-- Sleeper's full player list (scripts/sync-nfl-player-index.ts) — separate
-- from `players`, which only holds players who've actually appeared in this
-- league's history.
create table if not exists nfl_player_index (
  player_id text primary key,
  full_name text not null,
  position text not null check (position in ('QB', 'RB', 'WR', 'TE', 'K')),
  team text,
  synced_at timestamptz not null default now()
);
create index if not exists nfl_player_index_full_name_idx on nfl_player_index (full_name);

-- One row per computed sentiment read for a player. History across rows is
-- what drives the "sentiment over time" chart.
create table if not exists player_sentiment_snapshots (
  id bigint generated always as identity primary key,
  player_id text not null references nfl_player_index (player_id) on delete cascade,
  computed_at timestamptz not null default now(),
  window_days int not null,
  article_count int not null default 0,
  positive_count int not null default 0,
  neutral_count int not null default 0,
  negative_count int not null default 0,
  score numeric(4, 3),
  label text not null check (label in ('positive', 'neutral', 'negative', 'no_data')),
  summary text
);
create index if not exists player_sentiment_snapshots_player_idx on player_sentiment_snapshots (player_id, computed_at desc);

-- The individual articles behind one snapshot, kept for transparency (so
-- the UI can show what the score is actually based on).
create table if not exists player_sentiment_articles (
  id bigint generated always as identity primary key,
  snapshot_id bigint not null references player_sentiment_snapshots (id) on delete cascade,
  url text not null,
  title text not null,
  source text,
  published_at timestamptz,
  sentiment_label text not null check (sentiment_label in ('positive', 'neutral', 'negative')),
  sentiment_score numeric(4, 3) not null,
  reason text
);
create index if not exists player_sentiment_articles_snapshot_idx on player_sentiment_articles (snapshot_id);

alter table nfl_player_index enable row level security;
alter table player_sentiment_snapshots enable row level security;
alter table player_sentiment_articles enable row level security;

drop policy if exists public_read on nfl_player_index;
create policy public_read on nfl_player_index for select using (true);
drop policy if exists public_read on player_sentiment_snapshots;
create policy public_read on player_sentiment_snapshots for select using (true);
drop policy if exists public_read on player_sentiment_articles;
create policy public_read on player_sentiment_articles for select using (true);

grant select on nfl_player_index, player_sentiment_snapshots, player_sentiment_articles to anon, authenticated;
