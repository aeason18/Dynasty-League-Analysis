import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { computePlayerSentiment } from "../lib/sentiment/compute";
import { isGatewayRateLimitError } from "../lib/sentiment/classify";
import type { NflPlayerIndexRow } from "../lib/types";

const db = createAdminClient();

// Free-tier AI Gateway accounts hit a short burst rate limit well before any
// weekly batch like this would finish end to end. Spacing requests out keeps
// us under that burst window more often than firing them back to back.
const DELAY_BETWEEN_PLAYERS_MS = 4000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Refreshes sentiment only for players someone has already searched for at
// least once (i.e. already have a snapshot). This is what builds the
// week-over-week trend line the Sentiment tab charts, without paying for
// Exa + LLM calls on the entire NFL player pool every week. Ordered
// least-recently-refreshed first, so if a run gets cut short by the AI
// Gateway's rate limit, it's a different set of players left stale each
// time rather than the same tail never getting refreshed.
async function main() {
  const { data: tracked, error: trackedErr } = await db
    .from("player_sentiment_snapshots")
    .select("player_id, computed_at")
    .order("computed_at", { ascending: false });
  if (trackedErr) throw new Error(`fetching tracked players failed: ${trackedErr.message}`);

  const latestByPlayer = new Map<string, string>();
  for (const row of tracked ?? []) {
    if (!latestByPlayer.has(row.player_id)) latestByPlayer.set(row.player_id, row.computed_at);
  }
  const playerIds = [...latestByPlayer.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id]) => id);
  console.log(`Refreshing sentiment for ${playerIds.length} previously-searched players...`);

  if (playerIds.length === 0) return;

  const { data: players, error: playersErr } = await db
    .from("nfl_player_index")
    .select("player_id, full_name, position, team")
    .in("player_id", playerIds);
  if (playersErr) throw new Error(`fetching nfl_player_index failed: ${playersErr.message}`);

  const playerById = new Map(((players ?? []) as NflPlayerIndexRow[]).map((p) => [p.player_id, p]));
  const orderedPlayers = playerIds.map((id) => playerById.get(id)).filter((p): p is NflPlayerIndexRow => !!p);

  for (const [i, player] of orderedPlayers.entries()) {
    if (i > 0) await sleep(DELAY_BETWEEN_PLAYERS_MS);
    try {
      const { snapshot } = await computePlayerSentiment(db, player);
      console.log(`  ${player.full_name}: ${snapshot.label} (${snapshot.article_count} articles)`);
    } catch (err) {
      if (isGatewayRateLimitError(err)) {
        console.error(
          `  Hit the AI Gateway rate limit at ${player.full_name} — stopping early. Remaining players will pick up on the next run.`
        );
        break;
      }
      console.error(`  ${player.full_name}: failed —`, err instanceof Error ? err.message : err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
