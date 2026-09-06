import { config } from "dotenv";
config({ path: ".env.local" });

import { sleeper } from "../lib/sleeper/client";
import { createAdminClient } from "../lib/supabase/admin";

const db = createAdminClient();

// One-time backfill: set matchup_players.did_play from Sleeper's real
// per-player weekly stats for every week already ingested. Going forward,
// scripts/ingest.ts sets this at ingest time — this script only exists to
// backfill history that predates that.
async function fetchAllMatchupPlayers(leagueId: string) {
  const PAGE = 1000;
  const rows: { player_id: string; week: number; roster_id: number; points: number; is_starter: boolean }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("matchup_players")
      .select("player_id, week, roster_id, points, is_starter")
      .eq("league_id", leagueId)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`matchup_players fetch failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function isDefense(playerId: string): boolean {
  // Same heuristic scripts/ingest.ts uses — Sleeper's per-player weekly
  // stats endpoint doesn't cover team defenses at all, so there's no
  // per-week play signal to look up for them; leave their history as-is.
  return playerId.length <= 3 && playerId === playerId.toUpperCase();
}

async function main() {
  const { data: leagues, error: leagueErr } = await db.from("leagues").select("league_id, season").order("season");
  if (leagueErr) throw new Error(`leagues fetch failed: ${leagueErr.message}`);

  for (const league of leagues ?? []) {
    const rows = await fetchAllMatchupPlayers(league.league_id);
    if (rows.length === 0) {
      console.log(`${league.season}: no matchup_players rows, skipping`);
      continue;
    }

    const weeks = [...new Set(rows.map((r) => r.week))].sort((a, b) => a - b);
    console.log(`${league.season}: ${rows.length} rows across ${weeks.length} weeks`);

    const statsByWeek = new Map<number, Record<string, { gp?: number }>>();
    for (const week of weeks) {
      statsByWeek.set(week, await sleeper.getWeekStats(league.season, week));
    }

    const updates = rows.map((r) => ({
      league_id: league.league_id,
      week: r.week,
      roster_id: r.roster_id,
      player_id: r.player_id,
      points: r.points,
      is_starter: r.is_starter,
      did_play: isDefense(r.player_id) ? true : (statsByWeek.get(r.week)?.[r.player_id]?.gp ?? 0) > 0,
    }));

    const CHUNK = 500;
    for (let i = 0; i < updates.length; i += CHUNK) {
      const { error } = await db
        .from("matchup_players")
        .upsert(updates.slice(i, i + CHUNK), { onConflict: "league_id,week,roster_id,player_id" });
      if (error) throw new Error(`upsert matchup_players failed: ${error.message}`);
    }

    const playedCount = updates.filter((u) => u.did_play).length;
    console.log(`  ${league.season}: ${playedCount}/${updates.length} rows marked did_play=true`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
