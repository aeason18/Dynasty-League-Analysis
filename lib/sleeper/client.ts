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
} from "./types";

const BASE_URL = "https://api.sleeper.app/v1";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Sleeper API request failed: ${path} (${res.status})`);
  }
  return (await res.json()) as T;
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
};
