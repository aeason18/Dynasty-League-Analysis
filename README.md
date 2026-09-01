# Fantasy League Archive

**Your league. Your history. Your analytics.**

A historical analytics platform for a dynasty fantasy football league on Sleeper, built on real ingested Sleeper data — no mock data anywhere.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres)
- Recharts
- Deployed on Vercel

## Architecture

- `lib/sleeper/` — typed Sleeper API client, no database knowledge.
- `scripts/ingest.ts` — pulls a full dynasty league history (resolved from the current league backward via `previous_league_id`, so it never blindly picks a league) and upserts it into Supabase. Safe to re-run at any time — everything is an idempotent upsert.
- `scripts/migrate.ts` — applies `supabase/migrations/*.sql` in order via a direct Postgres connection, tracked in a `_migrations` table.
- `supabase/migrations/` — the normalized schema (leagues, managers, team_seasons, players, roster_players, drafts, draft_picks, traded_picks, matchups, matchup_players, playoff_results, transactions, transaction_players, fantasycalc_values, resolved_draft_picks) plus aggregate views (`manager_career_stats`, `player_team_points`, `player_league_totals`). RLS is enabled on every table with a public read-only policy — writes only happen server-side via the service-role key.
- `scripts/sync-fantasycalc.ts` — pulls current dynasty player/pick values from FantasyCalc's public API (no key required, joins on `sleeperId`).
- `scripts/resolve-draft-picks.ts` — maps a traded draft pick to the actual player it became, once that draft has happened. Uses each draft's `draft_order` field (not reverse-standings — verified against real data that standings-order ties break this) joined through `team_seasons` to find the pick's original owner, then cross-validates every resolution against the real drafter before trusting it; anything that doesn't check out is skipped, not guessed.
- `lib/queries/` — server-only read functions (anon key) that pages call. Keeps ingestion/DB logic fully separate from the UI.
- `app/` — Dashboard, Franchise, Players, Matchups, Records, Trades.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run migrate              # apply the schema to Supabase
npm run ingest                # pull Sleeper data and populate the database
npm run dev
```

Env vars (`.env.local`, gitignored):

```
SLEEPER_USER_ID=
SLEEPER_LEAGUE_ID=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only, never exposed to the client
SUPABASE_DB_URL=                 # used once by scripts/migrate.ts
```

## Scripts

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` — ESLint
- `npm run test:sleeper` — sanity-checks every Sleeper endpoint against the real league, no DB writes
- `npm run migrate` — applies pending SQL migrations
- `npm run ingest` — re-syncs the database from Sleeper (idempotent; run this periodically during the season)
- `npm run sync:fantasycalc` — refreshes player/pick market values (values are a live snapshot, not historical — rerun periodically)
- `npm run resolve:picks` — re-resolves traded picks against newly completed drafts

## Planned (structure only, not implemented)

- `app/api/v1/` — a REST API over this data, reusing `lib/queries`
- `lib/ml/` — feature source for a future regression model and deeper trade analysis (the trade *value* feature itself now exists at `/trades`, built on FantasyCalc + resolved draft picks; this is about predictive/ML work beyond that).
