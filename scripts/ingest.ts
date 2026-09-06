import { config } from "dotenv";
config({ path: ".env.local" });

import { sleeper } from "../lib/sleeper/client";
import { resolveLeagueChain } from "../lib/sleeper/chain";
import { createAdminClient } from "../lib/supabase/admin";
import type { SleeperLeague, SleeperPlayer } from "../lib/sleeper/types";

const db = createAdminClient();

// Sleeper splits points into an integer part and a two-digit decimal part
// (e.g. fpts=1601, fpts_decimal=6 -> 1601.06).
function points(intPart: number | undefined, decPart: number | undefined): number {
  return (intPart ?? 0) + (decPart ?? 0) / 100;
}

async function upsert(table: string, rows: unknown[], onConflict: string) {
  if (rows.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict });
    if (error) throw new Error(`upsert ${table} failed: ${error.message}`);
  }
}

async function main() {
  const currentLeagueId = process.env.SLEEPER_LEAGUE_ID;
  if (!currentLeagueId) throw new Error("SLEEPER_LEAGUE_ID not set");

  console.log("Resolving dynasty league chain...");
  const chain = await resolveLeagueChain(currentLeagueId); // oldest -> newest
  console.log(chain.map((l) => `${l.season}:${l.league_id}`).join(" -> "));

  const nflState = await sleeper.getNflState();
  console.log(`current NFL state: season ${nflState.season}, week ${nflState.week}`);

  // ============================================================
  // Phase 1: fetch + transform everything from Sleeper into rows,
  // in memory, before any DB writes. This is what lets us know the
  // *complete* set of referenced player_ids (a player drafted as a
  // rookie in 2025 is only discovered while processing 2025) before
  // we write the players table, which everything else FKs to.
  // ============================================================

  const referencedPlayerIds = new Set<string>();
  const managersById = new Map<string, { user_id: string; display_name: string; avatar: string | null }>();

  const leagueRows: unknown[] = [];
  const teamSeasonRows: { league_id: string; roster_id: number; playoff_result: string | null; [k: string]: unknown }[] = [];
  const playoffResultRows: unknown[] = [];
  const rosterPlayerRows: unknown[] = [];
  const draftRows: unknown[] = [];
  const draftPickRows: unknown[] = [];
  const tradedPickRows: unknown[] = [];
  const matchupRows: unknown[] = [];
  const matchupPlayerRows: unknown[] = [];
  const transactionRows: unknown[] = [];
  const transactionPlayerRows: unknown[] = [];

  leagueRows.push(
    ...chain.map((l: SleeperLeague, i: number) => ({
      league_id: l.league_id,
      season: l.season,
      name: l.name,
      status: l.status,
      total_rosters: l.total_rosters,
      playoff_week_start: l.settings?.playoff_week_start ?? null,
      roster_positions: l.roster_positions ?? [],
      settings: l.settings ?? {},
      scoring_settings: l.scoring_settings ?? {},
      previous_league_id: l.previous_league_id,
      is_current: i === chain.length - 1,
    }))
  );

  for (const league of chain) {
    console.log(`\n=== fetching season ${league.season} (${league.league_id}) ===`);

    const users = await sleeper.getLeagueUsers(league.league_id);
    for (const u of users) {
      managersById.set(u.user_id, { user_id: u.user_id, display_name: u.display_name, avatar: u.avatar });
    }
    const teamNameByUser = new Map(users.map((u) => [u.user_id, u.metadata?.team_name ?? null]));

    const rosters = await sleeper.getRosters(league.league_id);
    for (const r of rosters) {
      teamSeasonRows.push({
        league_id: league.league_id,
        roster_id: r.roster_id,
        manager_id: r.owner_id,
        team_name: r.owner_id ? teamNameByUser.get(r.owner_id) ?? null : null,
        division: r.settings?.division ?? null,
        wins: r.settings?.wins ?? 0,
        losses: r.settings?.losses ?? 0,
        ties: r.settings?.ties ?? 0,
        fpts_for: points(r.settings?.fpts, r.settings?.fpts_decimal),
        fpts_against: points(r.settings?.fpts_against, r.settings?.fpts_against_decimal),
        potential_points: points(r.settings?.ppts, r.settings?.ppts_decimal),
        waiver_budget_used: r.settings?.waiver_budget_used ?? null,
        moves: r.settings?.total_moves ?? null,
        final_standing: null,
        playoff_result: null,
      });

      const starters = new Set(r.starters ?? []);
      const reserve = new Set(r.reserve ?? []);
      const taxi = new Set(r.taxi ?? []);
      for (const pid of r.players ?? []) {
        referencedPlayerIds.add(pid);
        let slot: "starter" | "reserve" | "taxi" | "bench" = "bench";
        if (starters.has(pid)) slot = "starter";
        else if (reserve.has(pid)) slot = "reserve";
        else if (taxi.has(pid)) slot = "taxi";
        rosterPlayerRows.push({ league_id: league.league_id, roster_id: r.roster_id, player_id: pid, slot });
      }
    }

    if (league.status === "complete") {
      const winners = await sleeper.getWinnersBracket(league.league_id);
      const losers = await sleeper.getLosersBracket(league.league_id);
      for (const [bracket, matches] of [
        ["winners", winners],
        ["losers", losers],
      ] as const) {
        for (const m of matches) {
          playoffResultRows.push({
            league_id: league.league_id,
            bracket,
            round: m.r,
            match_id: m.m,
            roster_id_1: typeof m.t1 === "number" ? m.t1 : null,
            roster_id_2: typeof m.t2 === "number" ? m.t2 : null,
            winner_roster_id: m.w ?? null,
            placement: m.p ?? null,
          });
        }
      }
      const championshipMatch = winners.find((m) => m.p === 1);
      if (championshipMatch?.w != null) {
        const champ = teamSeasonRows.find(
          (t) => t.league_id === league.league_id && t.roster_id === championshipMatch.w
        );
        if (champ) champ.playoff_result = "champion";
        const runnerUpId =
          championshipMatch.t1 === championshipMatch.w ? championshipMatch.t2 : championshipMatch.t1;
        const runnerUp = teamSeasonRows.find(
          (t) => t.league_id === league.league_id && t.roster_id === runnerUpId
        );
        if (runnerUp) runnerUp.playoff_result = "runner_up";
      }
    }

    const drafts = await sleeper.getDrafts(league.league_id);
    for (const d of drafts) {
      draftRows.push({
        draft_id: d.draft_id,
        league_id: league.league_id,
        season: d.season,
        type: d.type,
        rounds: d.settings?.rounds ?? null,
        status: d.status,
        settings: d.settings ?? {},
      });
      const picks = await sleeper.getDraftPicks(d.draft_id);
      for (const p of picks) {
        referencedPlayerIds.add(p.player_id);
        draftPickRows.push({
          draft_id: p.draft_id,
          pick_no: p.pick_no,
          round: p.round,
          draft_slot: p.draft_slot,
          roster_id: p.roster_id,
          player_id: p.player_id,
          is_keeper: p.is_keeper,
        });
      }
    }

    const tradedPicks = await sleeper.getTradedPicks(league.league_id);
    for (const tp of tradedPicks) {
      tradedPickRows.push({
        league_id: league.league_id,
        season: tp.season,
        round: tp.round,
        original_roster_id: tp.roster_id,
        previous_owner_roster_id: tp.previous_owner_id,
        new_owner_roster_id: tp.owner_id,
      });
    }

    const playoffWeekStart = league.settings?.playoff_week_start ?? null;
    let finalWeeks = 0;
    for (let week = 1; week <= 18; week++) {
      const isCurrentLeague = league.league_id === currentLeagueId;
      const isFinal = league.status === "complete" || (isCurrentLeague && week < nflState.week);
      if (!isFinal) continue;

      const matchups = await sleeper.getMatchups(league.league_id, week);
      if (!matchups || matchups.length === 0) continue;
      finalWeeks++;

      const isPlayoff = playoffWeekStart != null && week >= playoffWeekStart;
      const playoffRound = isPlayoff ? week - playoffWeekStart + 1 : null;

      // Real per-player snap data, so we can tell "rostered but on a bye /
      // inactive / injured" (didn't play) apart from "played, just scored
      // low" — a fantasy matchup response alone can't distinguish those.
      // Team defenses aren't covered by this endpoint at all; treated as
      // always-played, matching prior behavior for them.
      const weekStats = await sleeper.getWeekStats(league.season, week);
      const isDefense = (pid: string) => pid.length <= 3 && pid === pid.toUpperCase();

      for (const m of matchups) {
        matchupRows.push({
          league_id: league.league_id,
          week,
          roster_id: m.roster_id,
          matchup_id: m.matchup_id,
          points: m.points ?? 0,
          is_playoff: isPlayoff,
          playoff_round: playoffRound,
        });
        const starters = new Set(m.starters ?? []);
        for (const [pid, pts] of Object.entries(m.players_points ?? {})) {
          referencedPlayerIds.add(pid);
          matchupPlayerRows.push({
            league_id: league.league_id,
            week,
            roster_id: m.roster_id,
            player_id: pid,
            points: pts ?? 0,
            is_starter: starters.has(pid),
            did_play: isDefense(pid) ? true : (weekStats[pid]?.gp ?? 0) > 0,
          });
        }
      }
    }

    let txCount = 0;
    for (let week = 0; week <= 18; week++) {
      const txs = await sleeper.getTransactions(league.league_id, week);
      if (!txs) continue;
      for (const tx of txs) {
        txCount++;
        transactionRows.push({
          transaction_id: tx.transaction_id,
          league_id: league.league_id,
          week: tx.leg,
          type: tx.type,
          status: tx.status,
          creator_manager_id: tx.creator,
          roster_ids: tx.roster_ids ?? [],
          adds: tx.adds ?? null,
          drops: tx.drops ?? null,
          waiver_budget: tx.waiver_budget ?? null,
          draft_picks: tx.draft_picks ?? [],
          created_at: tx.created ? new Date(tx.created).toISOString() : null,
        });
        for (const [pid, rosterId] of Object.entries(tx.adds ?? {})) {
          referencedPlayerIds.add(pid);
          transactionPlayerRows.push({ transaction_id: tx.transaction_id, player_id: pid, roster_id: rosterId, action: "add" });
        }
        for (const [pid, rosterId] of Object.entries(tx.drops ?? {})) {
          referencedPlayerIds.add(pid);
          transactionPlayerRows.push({ transaction_id: tx.transaction_id, player_id: pid, roster_id: rosterId, action: "drop" });
        }
      }
    }

    console.log(
      `  users=${users.length} rosters=${rosters.length} drafts=${drafts.length} tradedPicks=${tradedPicks.length} finalMatchupWeeks=${finalWeeks} transactions=${txCount}`
    );
  }

  console.log(`\nfetching full Sleeper player dictionary (${referencedPlayerIds.size} referenced player_ids to keep)...`);
  const allPlayers = await sleeper.getAllPlayers();
  const playerRows: unknown[] = [];
  for (const pid of referencedPlayerIds) {
    const p: SleeperPlayer | undefined = allPlayers[pid];
    if (!p) {
      // Sleeper's player dict doesn't always include team defenses (e.g. "SF");
      // store a minimal, honest stub rather than fabricating data.
      playerRows.push({
        player_id: pid,
        full_name: pid,
        first_name: null,
        last_name: null,
        position: pid.length <= 3 ? "DEF" : null,
        fantasy_positions: pid.length <= 3 ? ["DEF"] : null,
        team: pid.length <= 3 ? pid : null,
        status: null,
        active: null,
        years_exp: null,
        birth_date: null,
        college: null,
        height: null,
        weight: null,
      });
      continue;
    }
    playerRows.push({
      player_id: p.player_id,
      full_name: p.full_name,
      first_name: p.first_name,
      last_name: p.last_name,
      position: p.position,
      fantasy_positions: p.fantasy_positions,
      team: p.team,
      status: p.status,
      active: p.active,
      years_exp: p.years_exp,
      birth_date: p.birth_date,
      college: p.college,
      height: p.height,
      weight: p.weight,
    });
  }

  // ============================================================
  // Phase 2: write everything in FK dependency order. All upserts,
  // so this whole script is safe to re-run at any time (e.g. weekly
  // during the season).
  // ============================================================

  console.log("\nWriting to Supabase...");
  await upsert("leagues", leagueRows, "league_id");
  console.log(`  leagues: ${leagueRows.length}`);
  await upsert("managers", Array.from(managersById.values()), "user_id");
  console.log(`  managers: ${managersById.size}`);
  await upsert("players", playerRows, "player_id");
  console.log(`  players: ${playerRows.length}`);
  await upsert("team_seasons", teamSeasonRows, "league_id,roster_id");
  console.log(`  team_seasons: ${teamSeasonRows.length}`);
  await upsert("roster_players", rosterPlayerRows, "league_id,roster_id,player_id");
  console.log(`  roster_players: ${rosterPlayerRows.length}`);
  await upsert("drafts", draftRows, "draft_id");
  console.log(`  drafts: ${draftRows.length}`);
  await upsert("draft_picks", draftPickRows, "draft_id,pick_no");
  console.log(`  draft_picks: ${draftPickRows.length}`);
  await upsert("traded_picks", tradedPickRows, "league_id,season,round,original_roster_id,new_owner_roster_id");
  console.log(`  traded_picks: ${tradedPickRows.length}`);
  await upsert("matchups", matchupRows, "league_id,week,roster_id");
  console.log(`  matchups: ${matchupRows.length}`);
  await upsert("matchup_players", matchupPlayerRows, "league_id,week,roster_id,player_id");
  console.log(`  matchup_players: ${matchupPlayerRows.length}`);
  await upsert("playoff_results", playoffResultRows, "league_id,bracket,match_id");
  console.log(`  playoff_results: ${playoffResultRows.length}`);
  await upsert("transactions", transactionRows, "transaction_id");
  console.log(`  transactions: ${transactionRows.length}`);
  await upsert("transaction_players", transactionPlayerRows, "transaction_id,player_id,roster_id,action");
  console.log(`  transaction_players: ${transactionPlayerRows.length}`);

  console.log("\nIngestion complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
