import { createReadClient } from "@/lib/supabase/server";
import type { Manager, Matchup, TeamSeason } from "@/lib/types";

export interface Game {
  league_id: string;
  season: string;
  week: number;
  matchup_id: number | null;
  is_playoff: boolean;
  playoff_round: number | null;
  roster_id: number;
  manager_id: string | null;
  manager_name: string | null;
  team_name: string | null;
  avatar: string | null;
  points: number;
  opp_roster_id: number | null;
  opp_manager_id: string | null;
  opp_manager_name: string | null;
  opp_team_name: string | null;
  opp_points: number | null;
  result: "W" | "L" | "T" | null;
  margin: number | null;
}

/**
 * Every played matchup, unpacked into one row per team with its opponent
 * resolved (two Sleeper matchup rows sharing league_id+week+matchup_id).
 * Powers Matchups, Records, and Franchise pages. The dataset is small
 * (~400 rows across the league's history) so we do the pairing/derivation
 * in memory rather than in SQL.
 */
export async function getAllGames(): Promise<Game[]> {
  const db = createReadClient();

  const [{ data: matchups, error: mErr }, { data: teamSeasons, error: tErr }, { data: leagues, error: lErr }] =
    await Promise.all([
      db.from("matchups").select("*"),
      db.from("team_seasons").select("*, manager:managers(*)"),
      db.from("leagues").select("league_id, season"),
    ]);
  if (mErr) throw mErr;
  if (tErr) throw tErr;
  if (lErr) throw lErr;

  const seasonByLeague = new Map((leagues ?? []).map((l) => [l.league_id, l.season as string]));
  const teamByKey = new Map(
    ((teamSeasons ?? []) as unknown as (TeamSeason & { manager: Manager | null })[]).map((t) => [
      `${t.league_id}:${t.roster_id}`,
      t,
    ])
  );

  const groups = new Map<string, Matchup[]>();
  for (const m of (matchups ?? []) as Matchup[]) {
    // Sleeper sets matchup_id to null once a roster has no real opponent left
    // that week (bracket placement already locked in, bye in a consolation
    // round, or — as in this league from 2024 onward — a week the league
    // stopped using for real games at all, e.g. week 18). These rows are a
    // score with no head-to-head opponent, so they aren't a counted game.
    // This is what makes rule changes self-updating: whatever weeks Sleeper
    // actually paired that season are exactly the weeks that count, with no
    // hardcoded per-season week list to maintain.
    if (m.matchup_id == null) continue;
    const key = `${m.league_id}:${m.week}:${m.matchup_id}`;
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }

  const games: Game[] = [];
  for (const list of groups.values()) {
    for (const m of list) {
      const opp = list.find((o) => o.roster_id !== m.roster_id) ?? null;
      const team = teamByKey.get(`${m.league_id}:${m.roster_id}`);
      const oppTeam = opp ? teamByKey.get(`${opp.league_id}:${opp.roster_id}`) : null;

      let result: Game["result"] = null;
      if (opp) {
        if (m.points > opp.points) result = "W";
        else if (m.points < opp.points) result = "L";
        else result = "T";
      }

      games.push({
        league_id: m.league_id,
        season: seasonByLeague.get(m.league_id) ?? "",
        week: m.week,
        matchup_id: m.matchup_id,
        is_playoff: m.is_playoff,
        playoff_round: m.playoff_round,
        roster_id: m.roster_id,
        manager_id: team?.manager_id ?? null,
        manager_name: team?.manager?.display_name ?? null,
        team_name: team?.team_name ?? null,
        avatar: team?.manager?.avatar ?? null,
        points: Number(m.points),
        opp_roster_id: opp?.roster_id ?? null,
        opp_manager_id: oppTeam?.manager_id ?? null,
        opp_manager_name: oppTeam?.manager?.display_name ?? null,
        opp_team_name: oppTeam?.team_name ?? null,
        opp_points: opp ? Number(opp.points) : null,
        result,
        margin: opp ? Number(m.points) - Number(opp.points) : null,
      });
    }
  }

  games.sort((a, b) => (a.season === b.season ? a.week - b.week : a.season.localeCompare(b.season)));
  return games;
}
