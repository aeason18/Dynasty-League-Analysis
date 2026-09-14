import type {
  SleeperUser,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperRoster,
  SleeperMatchup,
  SleeperBracketMatch,
  SleeperDraft,
  SleeperDraftPick,
  SleeperTradedPick,
  SleeperTransaction,
  SleeperPlayer,
  SleeperNflState,
  SleeperPlayerWeekStats,
} from "./types";

const BASE_URL = "https://api.sleeper.app/v1";

// Sleeper occasionally 502s on an otherwise-valid request (seen in practice
// on /draft/:id/picks, which killed an entire weekly sync run over one
// transient blip). Retry transient statuses a couple of times with backoff
// before giving up — a real 4xx (bad league/draft id) still fails fast.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`);
    if (res.ok) return (await res.json()) as T;

    lastError = new Error(`Sleeper API request failed: ${path} (${res.status})`);
    if (!RETRYABLE_STATUSES.has(res.status) || attempt === MAX_ATTEMPTS) {
      throw lastError;
    }
    await sleep(500 * attempt);
  }
  throw lastError;
}

export const sleeper = {
  getUser: (userId: string) => get<SleeperUser>(`/user/${userId}`),

  getUserLeagues: (userId: string, season: string) =>
    get<SleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`),

  getLeague: (leagueId: string) => get<SleeperLeague>(`/league/${leagueId}`),

  getLeagueUsers: (leagueId: string) =>
    get<SleeperLeagueUser[]>(`/league/${leagueId}/users`),

  getRosters: (leagueId: string) =>
    get<SleeperRoster[]>(`/league/${leagueId}/rosters`),

  getMatchups: (leagueId: string, week: number) =>
    get<SleeperMatchup[] | null>(`/league/${leagueId}/matchups/${week}`),

  getWinnersBracket: (leagueId: string) =>
    get<SleeperBracketMatch[]>(`/league/${leagueId}/winners_bracket`),

  getLosersBracket: (leagueId: string) =>
    get<SleeperBracketMatch[]>(`/league/${leagueId}/losers_bracket`),

  getDrafts: (leagueId: string) =>
    get<SleeperDraft[]>(`/league/${leagueId}/drafts`),

  getDraftPicks: (draftId: string) =>
    get<SleeperDraftPick[]>(`/draft/${draftId}/picks`),

  getTradedPicks: (leagueId: string) =>
    get<SleeperTradedPick[]>(`/league/${leagueId}/traded_picks`),

  getTransactions: (leagueId: string, week: number) =>
    get<SleeperTransaction[] | null>(`/league/${leagueId}/transactions/${week}`),

  getAllPlayers: () => get<Record<string, SleeperPlayer>>(`/players/nfl`),

  getNflState: () => get<SleeperNflState>(`/state/nfl`),

  // Every NFL player's real stat line for one week (thousands of entries,
  // not scoped to any league) — used for `gp` (did they actually play),
  // which a fantasy matchup response doesn't tell you on its own.
  getWeekStats: (season: string, week: number) =>
    get<Record<string, SleeperPlayerWeekStats>>(`/stats/nfl/regular/${season}/${week}`),
};
