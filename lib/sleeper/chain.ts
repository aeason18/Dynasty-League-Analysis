import { sleeper } from "./client";
import type { SleeperLeague } from "./types";

/**
 * Walks a Sleeper dynasty league's history backward via previous_league_id
 * starting from the current league. This is the only reliable way to
 * identify "this" dynasty league across seasons when a user may belong to
 * multiple unrelated leagues in a given year.
 *
 * Returns leagues ordered oldest -> newest.
 */
export async function resolveLeagueChain(
  currentLeagueId: string
): Promise<SleeperLeague[]> {
  const chain: SleeperLeague[] = [];
  let leagueId: string | null = currentLeagueId;

  while (leagueId) {
    const league: SleeperLeague = await sleeper.getLeague(leagueId);
    chain.push(league);
    leagueId = league.previous_league_id;
  }

  return chain.reverse();
}
