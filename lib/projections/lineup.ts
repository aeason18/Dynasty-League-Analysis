// Rather than trust each roster's current starter/bench flags (unreliable
// this early in a season, before managers have set real lineups), this
// assumes a rational manager starts their best players and computes the
// highest-scoring legal lineup from the full roster pool — the same
// "optimal points" convention fantasy sites use for season projections.

export interface ProjectedRosterPlayer {
  player_id: string;
  position: string;
  projected_ppg: number;
}

export interface LineupSlot {
  slot: string;
  player: ProjectedRosterPlayer;
}

export interface OptimalLineup {
  slots: LineupSlot[];
  total: number;
}

const FLEX_ELIGIBLE = new Set(["RB", "WR", "TE"]);

export function pickOptimalLineup(players: ProjectedRosterPlayer[], rosterPositions: string[]): OptimalLineup {
  const requiredCounts = new Map<string, number>();
  let flexSlots = 0;
  for (const slot of rosterPositions) {
    if (slot === "BN" || slot === "IR" || slot === "TAXI") continue;
    if (slot === "FLEX") {
      flexSlots++;
      continue;
    }
    requiredCounts.set(slot, (requiredCounts.get(slot) ?? 0) + 1);
  }

  const remaining = [...players].sort((a, b) => b.projected_ppg - a.projected_ppg);
  const used = new Set<string>();
  const slots: LineupSlot[] = [];

  for (const [position, count] of requiredCounts) {
    const atPosition = remaining.filter((p) => p.position === position && !used.has(p.player_id));
    for (const p of atPosition.slice(0, count)) {
      used.add(p.player_id);
      slots.push({ slot: position, player: p });
    }
  }

  const flexPool = remaining.filter((p) => FLEX_ELIGIBLE.has(p.position) && !used.has(p.player_id));
  for (const p of flexPool.slice(0, flexSlots)) {
    used.add(p.player_id);
    slots.push({ slot: "FLEX", player: p });
  }

  return { slots, total: slots.reduce((sum, s) => sum + s.player.projected_ppg, 0) };
}

export function optimalLineupTotal(players: ProjectedRosterPlayer[], rosterPositions: string[]): number {
  return pickOptimalLineup(players, rosterPositions).total;
}
