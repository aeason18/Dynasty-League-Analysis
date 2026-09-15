import { config } from "dotenv";
// quiet: true — this script's stdout is consumed directly as data (one
// league_id per line) by the sync workflow's shell loop; dotenv's own
// "tip" banner would otherwise get parsed as a bogus league id.
config({ path: ".env.local", quiet: true });

import { createAdminClient } from "../lib/supabase/admin";

// Prints one league_id per line — the *current* season's league_id for
// every distinct tenant already in the database (leagues.is_current gives
// exactly one seed id per league_group_id, which is all ingest.ts needs to
// re-walk that dynasty's full chain). Used by the scheduled sync workflow
// to resync every onboarded league, not just the one in SLEEPER_LEAGUE_ID.
// Deliberately prints nothing else to stdout so a shell loop can consume it
// directly.
async function main() {
  const db = createAdminClient();
  const { data, error } = await db.from("leagues").select("league_id").eq("is_current", true);
  if (error) throw error;
  for (const row of data ?? []) {
    console.log(row.league_id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
