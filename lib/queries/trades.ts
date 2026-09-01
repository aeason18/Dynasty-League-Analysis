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
  totalValue: number;
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

  const trades: Trade[] = [];

  for (const tx of (transactions ?? []) as Transaction[]) {
    const season = seasonByLeague.get(tx.league_id) ?? "";
    const rosterIds = tx.roster_ids ?? [];
    const adds = tx.adds ?? {};
    const draftPicksMoved = tx.draft_picks ?? [];
    const waiverBudget = tx.waiver_budget ?? [];

    const sides: TradeSide[] = rosterIds.map((rosterId) => {
      const team = teamByKey.get(`${tx.league_id}:${rosterId}`);
      const received: TradeAsset[] = [];

      // Players this roster received.
      for (const [playerId, receivingRoster] of Object.entries(adds)) {
        if (receivingRoster !== rosterId) continue;
        const fc = valueBySleeperId.get(playerId);
        received.push({
          kind: "player",
          label: playerName.get(playerId) ?? fc?.name ?? playerId,
          value: fc?.value ?? null,
        });
      }

      // Picks this roster received.
      for (const dp of draftPicksMoved) {
        if (dp.owner_id !== rosterId) continue;
        const seasonNum = Number(dp.season);
        const resolved = resolvedByKey.get(`${dp.season}:${dp.round}:${dp.roster_id}`);
        if (resolved) {
          const fc = valueBySleeperId.get(resolved.resolved_player_id);
          received.push({
            kind: "pick",
            label: `${dp.season} Round ${dp.round} pick`,
            detail: playerName.get(resolved.resolved_player_id) ?? undefined,
            value: fc?.value ?? null,
          });
        } else {
          received.push({
            kind: "pick",
            label: `${dp.season} Round ${dp.round} pick`,
            value: pickValue(seasonNum, dp.round),
          });
        }
      }

      // FAAB received.
      for (const wb of waiverBudget) {
        if (wb.receiver !== rosterId) continue;
        received.push({ kind: "faab", label: `$${wb.amount} FAAB`, value: null });
      }

      return {
        roster_id: rosterId,
        manager_id: team?.manager_id ?? null,
        manager_name: team?.manager?.display_name ?? null,
        team_name: team?.team_name ?? null,
        avatar: team?.manager?.avatar ?? null,
        received,
        totalValue: received.reduce((sum, a) => sum + (a.value ?? 0), 0),
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
}

export async function getTradeLeaderboard(): Promise<TradeLeaderboardRow[]> {
  const trades = await getTrades();
  const byManager = new Map<string, TradeLeaderboardRow>();

  for (const trade of trades) {
    if (trade.sides.length < 2) continue;
    const totalPool = trade.sides.reduce((sum, s) => sum + s.totalValue, 0);
    const fairShare = totalPool / trade.sides.length;

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
        } satisfies TradeLeaderboardRow);
      row.trades++;
      row.netValue += Math.round(side.totalValue - fairShare);
      byManager.set(side.manager_id, row);
    }
  }

  return Array.from(byManager.values()).sort((a, b) => b.netValue - a.netValue);
}
