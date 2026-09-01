import { createReadClient } from "@/lib/supabase/server";
import type { Manager, TeamSeason, Transaction } from "@/lib/types";

export interface TradeAsset {
  kind: "player" | "pick" | "faab";
  label: string;
  value: number | null; // null when unvaluable (FAAB, or a pick FantasyCalc has no entry for)
  detail?: string; // e.g. "-> Ja'Marr Chase" for a resolved pick
}

export interface TradeSide {
  roster_id: number;
  manager_id: string | null;
  manager_name: string | null;
  team_name: string | null;
  avatar: string | null;
  received: TradeAsset[];
  receivedValue: number;
  sent: TradeAsset[];
  sentValue: number;
  /** receivedValue - sentValue. Self-relative to this side alone — not a
   * split of the trade's total pool, so it's meaningful on its own even in
   * a 3+ team trade where sides don't necessarily exchange equal shares. */
  netValue: number;
}

export interface Trade {
  transaction_id: string;
  season: string;
  week: number | null;
  created_at: string | null;
  sides: TradeSide[];
}

interface FcValueRow {
  fc_id: number;
  sleeper_player_id: string | null;
  name: string;
  position: string;
  is_pick: boolean;
  pick_season: number | null;
  pick_round: number | null;
  pick_tier: "exact" | "early" | "mid" | "late" | null;
  value: number;
}

interface ResolvedPickRow {
  season: string;
  round: number;
  original_roster_id: number;
  resolved_player_id: string;
}

type TeamSeasonWithManager = TeamSeason & { manager: Manager | null };

export async function getTrades(): Promise<Trade[]> {
  const db = createReadClient();

  const [
    { data: transactions, error: txErr },
    { data: leagues, error: lErr },
    { data: teamSeasons, error: tErr },
    { data: fcValues, error: fcErr },
    { data: resolvedPicks, error: rpErr },
    { data: players, error: pErr },
  ] = await Promise.all([
    db.from("transactions").select("*").eq("type", "trade").eq("status", "complete"),
    db.from("leagues").select("league_id, season"),
    db.from("team_seasons").select("*, manager:managers(*)"),
    db.from("fantasycalc_values").select("*"),
    db.from("resolved_draft_picks").select("season, round, original_roster_id, resolved_player_id"),
    db.from("players").select("player_id, full_name, position"),
  ]);
  if (txErr) throw txErr;
  if (lErr) throw lErr;
  if (tErr) throw tErr;
  if (fcErr) throw fcErr;
  if (rpErr) throw rpErr;
  if (pErr) throw pErr;

  const seasonByLeague = new Map((leagues ?? []).map((l) => [l.league_id, l.season as string]));
  const teamByKey = new Map(
    ((teamSeasons ?? []) as unknown as TeamSeasonWithManager[]).map((t) => [`${t.league_id}:${t.roster_id}`, t])
  );
  const playerName = new Map((players ?? []).map((p) => [p.player_id, p.full_name ?? p.player_id]));

  const valueBySleeperId = new Map<string, FcValueRow>();
  const pickValueByRound = new Map<string, FcValueRow[]>(); // "season:round" -> tiers
  for (const v of (fcValues ?? []) as FcValueRow[]) {
    if (v.sleeper_player_id) valueBySleeperId.set(v.sleeper_player_id, v);
    if (v.is_pick && v.pick_season != null && v.pick_round != null) {
      const key = `${v.pick_season}:${v.pick_round}`;
      const list = pickValueByRound.get(key) ?? [];
      list.push(v);
      pickValueByRound.set(key, list);
    }
  }

  const resolvedByKey = new Map(
    ((resolvedPicks ?? []) as ResolvedPickRow[]).map((r) => [`${r.season}:${r.round}:${r.original_roster_id}`, r])
  );

  function pickValue(season: number, round: number): number | null {
    const tiers = pickValueByRound.get(`${season}:${round}`);
    if (!tiers || tiers.length === 0) return null;
    return Math.round(tiers.reduce((sum, t) => sum + t.value, 0) / tiers.length);
  }

  function playerAssets(map: Record<string, number>, rosterId: number): TradeAsset[] {
    const out: TradeAsset[] = [];
    for (const [playerId, r] of Object.entries(map)) {
      if (r !== rosterId) continue;
      const fc = valueBySleeperId.get(playerId);
      out.push({ kind: "player", label: playerName.get(playerId) ?? fc?.name ?? playerId, value: fc?.value ?? null });
    }
    return out;
  }

  function pickAssets(
    draftPicksMoved: Transaction["draft_picks"],
    rosterId: number,
    direction: "received" | "sent"
  ): TradeAsset[] {
    const out: TradeAsset[] = [];
    for (const dp of draftPicksMoved) {
      const matchRoster = direction === "received" ? dp.owner_id : dp.roster_id;
      if (matchRoster !== rosterId) continue;
      const resolved = resolvedByKey.get(`${dp.season}:${dp.round}:${dp.roster_id}`);
      if (resolved) {
        const fc = valueBySleeperId.get(resolved.resolved_player_id);
        out.push({
          kind: "pick",
          label: `${dp.season} Round ${dp.round} pick`,
          detail: playerName.get(resolved.resolved_player_id) ?? undefined,
          value: fc?.value ?? null,
        });
      } else {
        out.push({
          kind: "pick",
          label: `${dp.season} Round ${dp.round} pick`,
          value: pickValue(Number(dp.season), dp.round),
        });
      }
    }
    return out;
  }

  function faabAssets(waiverBudget: Transaction["waiver_budget"], rosterId: number, direction: "received" | "sent"): TradeAsset[] {
    const out: TradeAsset[] = [];
    for (const wb of waiverBudget) {
      const matchRoster = direction === "received" ? wb.receiver : wb.sender;
      if (matchRoster !== rosterId) continue;
      out.push({ kind: "faab", label: `$${wb.amount} FAAB`, value: null });
    }
    return out;
  }

  const trades: Trade[] = [];

  for (const tx of (transactions ?? []) as Transaction[]) {
    const season = seasonByLeague.get(tx.league_id) ?? "";
    const rosterIds = tx.roster_ids ?? [];
    const adds = tx.adds ?? {};
    const drops = tx.drops ?? {};
    const draftPicksMoved = tx.draft_picks ?? [];
    const waiverBudget = tx.waiver_budget ?? [];

    const sides: TradeSide[] = rosterIds.map((rosterId) => {
      const team = teamByKey.get(`${tx.league_id}:${rosterId}`);

      const received = [
        ...playerAssets(adds, rosterId),
        ...pickAssets(draftPicksMoved, rosterId, "received"),
        ...faabAssets(waiverBudget, rosterId, "received"),
      ];
      const sent = [
        ...playerAssets(drops, rosterId),
        ...pickAssets(draftPicksMoved, rosterId, "sent"),
        ...faabAssets(waiverBudget, rosterId, "sent"),
      ];
      const receivedValue = received.reduce((sum, a) => sum + (a.value ?? 0), 0);
      const sentValue = sent.reduce((sum, a) => sum + (a.value ?? 0), 0);

      return {
        roster_id: rosterId,
        manager_id: team?.manager_id ?? null,
        manager_name: team?.manager?.display_name ?? null,
        team_name: team?.team_name ?? null,
        avatar: team?.manager?.avatar ?? null,
        received,
        receivedValue,
        sent,
        sentValue,
        netValue: receivedValue - sentValue,
      };
    });

    trades.push({
      transaction_id: tx.transaction_id,
      season,
      week: tx.week,
      created_at: tx.created_at,
      sides,
    });
  }

  trades.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return trades;
}

export interface TradeLeaderboardRow {
  manager_id: string;
  manager_name: string;
  avatar: string | null;
  trades: number;
  netValue: number;
  avgValue: number;
}

export async function getTradeLeaderboard(): Promise<TradeLeaderboardRow[]> {
  const trades = await getTrades();
  const byManager = new Map<string, TradeLeaderboardRow>();

  for (const trade of trades) {
    if (trade.sides.length < 2) continue;

    for (const side of trade.sides) {
      if (!side.manager_id) continue;
      const row =
        byManager.get(side.manager_id) ??
        ({
          manager_id: side.manager_id,
          manager_name: side.manager_name ?? "Unknown",
          avatar: side.avatar,
          trades: 0,
          netValue: 0,
          avgValue: 0,
        } satisfies TradeLeaderboardRow);
      row.trades++;
      row.netValue += side.netValue;
      byManager.set(side.manager_id, row);
    }
  }

  const rows = Array.from(byManager.values());
  for (const row of rows) {
    row.avgValue = Math.round(row.netValue / row.trades);
  }

  return rows.sort((a, b) => b.netValue - a.netValue);
}

/**
 * The trades with the biggest net-value gap between sides, out of a given
 * trade list (pure function, not a fetch — pass an already-loaded
 * `Trade[]` so a page can derive this from data it fetched once and share
 * it with the active season/manager filters).
 *
 * Ranked by netValue spread (received minus given up, per side), not raw
 * received-value spread — a side that received less because it also gave
 * up less isn't "lopsided," it just had a smaller piece of the deal. What
 * makes a trade lopsided is one side coming out ahead relative to what
 * they each put in.
 */
export function getMostLopsidedTrades(trades: Trade[], limit = 10): Trade[] {
  return trades
    .filter((t) => t.sides.length >= 2 && t.sides.some((s) => s.receivedValue > 0 || s.sentValue > 0))
    .map((t) => ({ trade: t, spread: Math.max(...t.sides.map((s) => s.netValue)) - Math.min(...t.sides.map((s) => s.netValue)) }))
    .sort((a, b) => b.spread - a.spread)
    .slice(0, limit)
    .map((x) => x.trade);
}
