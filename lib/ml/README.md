# Future ML work

Not implemented yet. Reserved for:

1. Linear regression model predicting future fantasy performance
2. Player / trade market values
3. Trade value gained/lost
4. Trade analysis

Feature sources already preserved in the schema for this:

- `matchup_players` — per-game (not season-aggregated) player scoring, joined to the roster/manager that started or benched them that week.
- `transactions` / `transaction_players` — full add/drop/trade history, normalized enough to reconstruct trade packages.
- `draft_picks` / `traded_picks` — draft capital and its movement over time, needed for pick valuation.
