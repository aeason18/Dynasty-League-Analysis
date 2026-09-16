import { createReadClient } from "@/lib/supabase/server";
import type { Manager, TeamSeason } from "@/lib/types";

export type RosterProfile = "Top Heavy" | "Balanced" | "Deep";

export interface PowerRankingPlayer {
  player_id: string;
  name: string;
  position: string | null;
  value: number;
}

export interface PowerRankingPick {
  season: string;
  round: number;
  value: number;
}

export interface PowerRanking {
  rank: number;
  roster_id: number;
  manager_id: string | null;
  manager_name: string;
  team_name: string | null;
  avatar: string | null;
  overall: number;
  starScore: number;
  coreScore: number;
  depthScore: number;
  picksScore: number;
  profile: RosterProfile;
  /** Every group sorted desc by value -- the full "why" behind each tier's
   * score, for the expandable breakdown in the UI. */
  starGroup: PowerRankingPlayer[];
  coreGroup: PowerRankingPlayer[];
  depthGroup: PowerRankingPlayer[];
  pickGroup: PowerRankingPick[];
}

interface FcRow {
  sleeper_player_id: string | null;
  is_pick: boolean;
  pick_season: number | null;
  pick_round: number | null;
  value: number;
}

type TeamSeasonWithManager = TeamSeason & { manager: Manager | null };

/**
 * Weighted average with geometric decay over a value list already sorted
 * descending -- the 1st entry counts fully, each one after counts `decay`x
 * less than the one before. This is how every tier gets "diminishing
 * returns" without a hard cutoff: an empty tier contributes 0, a short one
 * is dominated by its top entries, a long one still gets a (shrinking) say
 * from its tail.
 */
function decayWeightedAvg(valuesDesc: number[], decay: number): number {
  if (valuesDesc.length === 0) return 0;
  let weightSum = 0;
  let valueSum = 0;
  let weight = 1;
  for (const v of valuesDesc) {
    weightSum += weight;
    valueSum += weight * v;
    weight *= decay;
  }
  return valueSum / weightSum;
}

/** Min-max normalize onto a 50-99 display band so the worst team in the
 * league still reads as a real score rather than bottoming out near 0. */
function normalize(raw: number, min: number, max: number): number {
  if (max === min) return 75;
  return 50 + 49 * ((raw - min) / (max - min));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Power rankings for the league's CURRENT roster snapshot only (not a
 * per-season historical view) -- weighted so a team's top-end talent
 * dominates the score while still rewarding a deep bench and draft capital.
 * See app/[leagueId]/rankings/page.tsx for the tier writeup.
 */
export async function getPowerRankings(leagueGroupId: string): Promise<PowerRanking[]> {
  const db = createReadClient();

  const { data: league, error: lErr } = await db
    .from("leagues")
    .select("league_id, season")
    .eq("league_group_id", leagueGroupId)
    .eq("is_current", true)
    .maybeSingle();
  if (lErr) throw lErr;
  if (!league) return [];

  const [
    { data: teamSeasons, error: tErr },
    { data: rosterPlayers, error: rpErr },
    { data: players, error: pErr },
    { data: fcValues, error: fcErr },
    { data: tradedPicks, error: tpErr },
    { data: draft, error: dErr },
  ] = await Promise.all([
    db.from("team_seasons").select("*, manager:managers(*)").eq("league_id", league.league_id),
    db.from("roster_players").select("roster_id, player_id, slot").eq("league_id", league.league_id),
    db.from("players").select("player_id, full_name, position"),
    db.from("fantasycalc_values").select("sleeper_player_id, is_pick, pick_season, pick_round, value"),
    db.from("traded_picks").select("season, round, original_roster_id, new_owner_roster_id").eq("league_id", league.league_id),
    db.from("drafts").select("rounds").eq("league_id", league.league_id).maybeSingle(),
  ]);
  if (tErr) throw tErr;
  if (rpErr) throw rpErr;
  if (pErr) throw pErr;
  if (fcErr) throw fcErr;
  if (tpErr) throw tpErr;
  if (dErr) throw dErr;

  const teams = (teamSeasons ?? []) as unknown as TeamSeasonWithManager[];
  if (teams.length === 0) return [];

  const rounds = draft?.rounds ?? 3;
  const currentSeasonNum = Number(league.season);

  const playerName = new Map((players ?? []).map((p) => [p.player_id, p.full_name ?? p.player_id]));
  const playerPos = new Map((players ?? []).map((p) => [p.player_id, p.position]));

  const valueBySleeperId = new Map<string, number>();
  const pickTiersByKey = new Map<string, number[]>();
  for (const v of (fcValues ?? []) as FcRow[]) {
    if (!v.is_pick && v.sleeper_player_id) valueBySleeperId.set(v.sleeper_player_id, v.value);
    if (v.is_pick && v.pick_season != null && v.pick_round != null) {
      const key = `${v.pick_season}:${v.pick_round}`;
      const list = pickTiersByKey.get(key) ?? [];
      list.push(v.value);
      pickTiersByKey.set(key, list);
    }
  }
  function pickValue(season: number, round: number): number {
    const tiers = pickTiersByKey.get(`${season}:${round}`);
    if (!tiers || tiers.length === 0) return 0;
    return tiers.reduce((sum, v) => sum + v, 0) / tiers.length;
  }

  // Only unresolved future picks are real draft capital right now -- this
  // season's picks have already become the players sitting on rosters, so
  // counting them here would double-count that value.
  const futureSeasons = Array.from(
    new Set(
      (fcValues ?? [])
        .filter((v) => v.is_pick && v.pick_season != null && v.pick_season > currentSeasonNum)
        .map((v) => v.pick_season as number)
    )
  ).sort((a, b) => a - b);

  // traded_picks rows already reflect final current ownership (Sleeper's API
  // gives current state, not a trade history), so a direct lookup is enough
  // -- no need to chase multi-hop chains.
  const pickOwnerOverride = new Map<string, number>();
  for (const tp of tradedPicks ?? []) {
    pickOwnerOverride.set(`${tp.season}:${tp.round}:${tp.original_roster_id}`, tp.new_owner_roster_id);
  }

  const rosterIds = teams.map((t) => t.roster_id);

  const picksByRoster = new Map<number, PowerRankingPick[]>();
  for (const rid of rosterIds) picksByRoster.set(rid, []);
  for (const season of futureSeasons) {
    for (let round = 1; round <= rounds; round++) {
      const val = pickValue(season, round);
      for (const originalRoster of rosterIds) {
        const owner = pickOwnerOverride.get(`${season}:${round}:${originalRoster}`) ?? originalRoster;
        picksByRoster.get(owner)?.push({ season: String(season), round, value: val });
      }
    }
  }

  interface RosterPlayer extends PowerRankingPlayer {
    slot: string;
  }
  const playersByRoster = new Map<number, RosterPlayer[]>();
  for (const rid of rosterIds) playersByRoster.set(rid, []);
  for (const rp of rosterPlayers ?? []) {
    const list = playersByRoster.get(rp.roster_id);
    if (!list) continue;
    list.push({
      player_id: rp.player_id,
      name: playerName.get(rp.player_id) ?? rp.player_id,
      position: playerPos.get(rp.player_id) ?? null,
      value: valueBySleeperId.get(rp.player_id) ?? 0,
      slot: rp.slot,
    });
  }

  interface RawScore {
    roster_id: number;
    star: number;
    core: number;
    depth: number;
    picks: number;
    starGroup: PowerRankingPlayer[];
    coreGroup: PowerRankingPlayer[];
    depthGroup: PowerRankingPlayer[];
    pickGroup: PowerRankingPick[];
  }

  const raw: RawScore[] = rosterIds.map((rid) => {
    const all = (playersByRoster.get(rid) ?? []).slice().sort((a, b) => b.value - a.value);
    const picks = (picksByRoster.get(rid) ?? []).slice().sort((a, b) => b.value - a.value);
    const starGroup = all.slice(0, 4);
    const starIds = new Set(starGroup.map((p) => p.player_id));
    // Core = the starting lineup MINUS whoever already counted toward Star
    // Power -- otherwise a team's studs get credited twice (once for being
    // elite, again for anchoring the lineup) and Core stops meaning
    // anything distinct from Star Power.
    const coreGroup = all.filter((p) => p.slot === "starter" && !starIds.has(p.player_id));
    const depthPlayers = all.filter((p) => p.slot !== "starter");

    return {
      roster_id: rid,
      // Star Power: heavy decay over just the top 3-4 -- the elite tier
      // should read as "how good are this team's best players," not get
      // diluted by the rest of the roster.
      star: decayWeightedAvg(
        starGroup.map((p) => p.value),
        0.6
      ),
      // Core: mild decay over the rest of the starting lineup -- every
      // starting slot matters, but the best of the non-star starters still
      // counts for more than the worst.
      core: decayWeightedAvg(
        coreGroup.map((p) => p.value),
        0.92
      ),
      // Depth: steeper decay -- a great QB3 stash matters a lot more than
      // the 19th man on the roster.
      depth: decayWeightedAvg(
        depthPlayers.map((p) => p.value),
        0.78
      ),
      picks: decayWeightedAvg(
        picks.map((p) => p.value),
        0.85
      ),
      starGroup,
      coreGroup,
      depthGroup: depthPlayers,
      pickGroup: picks,
    };
  });

  const range = (sel: (r: RawScore) => number) => {
    const vals = raw.map(sel);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  };
  const starRange = range((r) => r.star);
  const coreRange = range((r) => r.core);
  const depthRange = range((r) => r.depth);
  const picksRange = range((r) => r.picks);

  // Star Power carries the most weight by design (rewards elite talent),
  // Core next (the rest of a real starting lineup), then Depth and Picks --
  // close to each other, Picks just a shade lighter since it's unrealized
  // value.
  const WEIGHTS = { star: 0.45, core: 0.28, depth: 0.15, picks: 0.12 };

  const teamByRoster = new Map(teams.map((t) => [t.roster_id, t]));

  const rankings: PowerRanking[] = raw.map((r) => {
    const starN = normalize(r.star, starRange.min, starRange.max);
    const coreN = normalize(r.core, coreRange.min, coreRange.max);
    const depthN = normalize(r.depth, depthRange.min, depthRange.max);
    const picksN = normalize(r.picks, picksRange.min, picksRange.max);
    const overall = WEIGHTS.star * starN + WEIGHTS.core * coreN + WEIGHTS.depth * depthN + WEIGHTS.picks * picksN;

    const spread = starN - depthN;
    const profile: RosterProfile = spread > 15 ? "Top Heavy" : spread < -15 ? "Deep" : "Balanced";

    const team = teamByRoster.get(r.roster_id);
    return {
      rank: 0,
      roster_id: r.roster_id,
      manager_id: team?.manager_id ?? null,
      manager_name: team?.manager?.display_name ?? "Unknown",
      team_name: team?.team_name ?? null,
      avatar: team?.manager?.avatar ?? null,
      overall: round1(overall),
      starScore: round1(starN),
      coreScore: round1(coreN),
      depthScore: round1(depthN),
      picksScore: round1(picksN),
      profile,
      starGroup: r.starGroup,
      coreGroup: r.coreGroup,
      depthGroup: r.depthGroup,
      pickGroup: r.pickGroup,
    };
  });

  rankings.sort((a, b) => b.overall - a.overall);
  rankings.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rankings;
}
