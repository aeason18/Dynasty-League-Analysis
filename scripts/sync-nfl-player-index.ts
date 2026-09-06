import { config } from "dotenv";
config({ path: ".env.local" });

import { sleeper } from "../lib/sleeper/client";
import { createAdminClient } from "../lib/supabase/admin";

const db = createAdminClient();

// Skill positions only — these are the positions a fantasy news search
// meaningfully applies to. Keeps the reference table (and thus the
// sentiment search box) to a few thousand rows instead of Sleeper's full
// ~11k player dump.
const SKILL_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);

async function main() {
  console.log("Fetching full Sleeper player dictionary...");
  const allPlayers = await sleeper.getAllPlayers();

  const rows = Object.values(allPlayers)
    .filter((p) => p.active && p.full_name && p.position && SKILL_POSITIONS.has(p.position))
    .map((p) => ({
      player_id: p.player_id,
      full_name: p.full_name,
      position: p.position,
      team: p.team,
    }));

  console.log(`  keeping ${rows.length} active skill-position players`);

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from("nfl_player_index").upsert(rows.slice(i, i + CHUNK), { onConflict: "player_id" });
    if (error) throw new Error(`upsert nfl_player_index failed: ${error.message}`);
  }

  console.log(`Upserted ${rows.length} players into nfl_player_index.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
