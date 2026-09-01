import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";

const db = createAdminClient();

interface FantasyCalcEntry {
  player: {
    id: number;
    name: string;
    position: string;
    sleeperId: string | null;
  };
  value: number;
}

// Matched to this league's real settings: full PPR, single-QB, 8 teams
// (see leagues.scoring_settings / roster_positions).
const FC_URL = "https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=1&numTeams=8&ppr=1";

// FantasyCalc pick names look like "2026 Pick 1.01" (exact, order known),
// "2027 1st (Early)" / "(Mid)" / "(Late)" (round known, order not yet, split
// into tiers), or plain "2026 1st" (round known, no tier split available —
// typically the current season's picks once the tiers have converged).
function parsePick(
  name: string
): { season: number; round: number; tier: "exact" | "early" | "mid" | "late" | null } | null {
  const exact = name.match(/^(\d{4}) Pick (\d+)\.\d+$/);
  if (exact) return { season: Number(exact[1]), round: Number(exact[2]), tier: "exact" };

  const tiered = name.match(/^(\d{4}) (\d+)(?:st|nd|rd|th) \((Early|Mid|Late)\)$/);
  if (tiered) {
    return { season: Number(tiered[1]), round: Number(tiered[2]), tier: tiered[3].toLowerCase() as "early" | "mid" | "late" };
  }

  const plain = name.match(/^(\d{4}) (\d+)(?:st|nd|rd|th)$/);
  if (plain) return { season: Number(plain[1]), round: Number(plain[2]), tier: null };

  return null;
}

async function main() {
  console.log("Fetching FantasyCalc current values...");
  const res = await fetch(FC_URL);
  if (!res.ok) throw new Error(`FantasyCalc request failed: ${res.status}`);
  const entries: FantasyCalcEntry[] = await res.json();
  console.log(`  got ${entries.length} entries`);

  const rows = entries.map((e) => {
    const isPick = e.player.position === "PICK";
    const pick = isPick ? parsePick(e.player.name) : null;
    if (isPick && !pick) {
      console.warn(`  unrecognized pick name format: "${e.player.name}" — storing without season/round/tier`);
    }
    return {
      fc_id: e.player.id,
      sleeper_player_id: e.player.sleeperId,
      name: e.player.name,
      position: e.player.position,
      is_pick: isPick,
      pick_season: pick?.season ?? null,
      pick_round: pick?.round ?? null,
      pick_tier: pick?.tier ?? null,
      value: e.value,
    };
  });

  const { error } = await db.from("fantasycalc_values").upsert(rows, { onConflict: "fc_id" });
  if (error) throw new Error(`upsert fantasycalc_values failed: ${error.message}`);

  console.log(`Upserted ${rows.length} values (${rows.filter((r) => r.is_pick).length} picks, ${rows.filter((r) => !r.is_pick).length} players).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
