import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { sleeper } from "../lib/sleeper/client";

const db = createAdminClient();

/**
 * Maps a traded draft pick (season, round, original_roster_id) to the
 * actual player selected with it, for any pick whose draft has already
 * happened.
 *
 * Verified against this league's real data (see plan notes): the pick's
 * draft slot is NOT simply reverse-standings order (a 3-way tie in the
 * standings broke that hypothesis on the first real check) — it's each
 * draft's own `draft_order` field ({sleeper_user_id: slot}), joined through
 * that season's team_seasons to get the *original* roster per slot, then
 * pick_no = (round-1)*teams + slot for a linear draft, snake-adjusted for a
 * snake draft. Every resolved pick is cross-validated against the actual
 * drafter recorded in draft_picks before being trusted; anything that
 * doesn't match is skipped and logged rather than risking a wrong player.
 */
async function main() {
  const { data: leagues, error: lErr } = await db
    .from("leagues")
    .select("league_id, season, status, total_rosters")
    .order("season");
  if (lErr) throw lErr;

  const { data: teamSeasons, error: tErr } = await db.from("team_seasons").select("league_id, roster_id, manager_id");
  if (tErr) throw tErr;
  const rosterByManager = new Map(
    (teamSeasons ?? []).map((t) => [`${t.league_id}:${t.manager_id}`, t.roster_id as number])
  );

  const { data: tradedPicks, error: tpErr } = await db
    .from("traded_picks")
    .select("league_id, season, round, original_roster_id, new_owner_roster_id");
  if (tpErr) throw tpErr;

  let resolved = 0;
  let skippedNotDrafted = 0;
  let skippedMismatch = 0;
  const rows: {
    season: string;
    round: number;
    original_roster_id: number;
    resolved_player_id: string;
    draft_id: string;
    pick_no: number;
  }[] = [];

  for (const league of leagues ?? []) {
    // Gate on the *draft's* status, not the league's — a season's rookie
    // draft is typically complete well before that season's league itself
    // reaches "complete" (e.g. 2026's draft already happened, but the
    // league won't be "complete" until the season finishes).
    const drafts = await sleeper.getDrafts(league.league_id);
    const draft = drafts.find((d) => d.season === league.season);
    if (!draft || draft.status !== "complete") {
      skippedNotDrafted += (tradedPicks ?? []).filter((tp) => tp.season === league.season).length;
      continue;
    }

    const order = draft.draft_order;
    const type = draft.type;
    const teams = draft.settings?.teams ?? league.total_rosters ?? 8;
    if (!order) {
      console.warn(`  no draft_order for ${league.season} draft, skipping its picks`);
      continue;
    }

    const slotByOriginalRoster = new Map<number, number>();
    for (const [userId, slot] of Object.entries(order)) {
      const rosterId = rosterByManager.get(`${league.league_id}:${userId}`);
      if (rosterId != null) slotByOriginalRoster.set(rosterId, slot);
    }

    const picks = await sleeper.getDraftPicks(draft.draft_id);
    const pickByNo = new Map(picks.map((p) => [p.pick_no, p]));

    const thisSeasonTraded = (tradedPicks ?? []).filter((tp) => tp.season === league.season);
    for (const tp of thisSeasonTraded) {
      const slot = slotByOriginalRoster.get(tp.original_roster_id);
      if (slot == null) continue;

      const isEvenRound = tp.round % 2 === 0;
      const pickNo =
        type === "snake" && isEvenRound
          ? (tp.round - 1) * teams + (teams + 1 - slot)
          : (tp.round - 1) * teams + slot;

      const pick = pickByNo.get(pickNo);
      if (!pick) continue;

      // Cross-validate: the roster that actually made this pick must match
      // the pick's independently-known final owner.
      if (pick.roster_id !== tp.new_owner_roster_id) {
        skippedMismatch++;
        continue;
      }

      rows.push({
        season: tp.season,
        round: tp.round,
        original_roster_id: tp.original_roster_id,
        resolved_player_id: pick.player_id,
        draft_id: draft.draft_id,
        pick_no: pickNo,
      });
      resolved++;
    }
  }

  // Dedupe (multiple traded_picks rows across league_id snapshots can refer
  // to the same logical pick); last one wins, they should agree anyway.
  const uniqueRows = new Map(rows.map((r) => [`${r.season}:${r.round}:${r.original_roster_id}`, r]));

  const { error: upErr } = await db
    .from("resolved_draft_picks")
    .upsert(Array.from(uniqueRows.values()), { onConflict: "season,round,original_roster_id" });
  if (upErr) throw new Error(`upsert resolved_draft_picks failed: ${upErr.message}`);

  console.log(
    `Resolved ${uniqueRows.size} unique picks (${resolved} raw matches, ${skippedMismatch} skipped on cross-validation mismatch, ${skippedNotDrafted} skipped — draft not complete yet).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
