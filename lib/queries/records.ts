import { createReadClient } from "@/lib/supabase/server";
import { getAllGames, type Game } from "@/lib/queries/games";
import type { MatchupPlayer, TeamSeason } from "@/lib/types";

type TeamSeasonWithManager = TeamSeason & { manager: { display_name: string } | null };
type MatchupPlayerWithPlayer = MatchupPlayer & {
  player: { full_name: string | null; position: string | null } | null;
};

function dedupeMatchups(games: Game[]): Game[] {
  const seen = new Set<string>();
  const out: Game[] = [];
  for (const g of games) {
    const key = `${g.league_id}:${g.week}:${g.matchup_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Orient so the winner is always the primary team (reads as "Team A
    // def. Team B by N"). Falls back to a stable roster_id ordering for
    // ties, where there's no winner to prefer.
    const shouldFlip = g.result === "L" || (g.result === "T" && g.opp_roster_id != null && g.roster_id > g.opp_roster_id);
    if (g.opp_roster_id != null && shouldFlip) {
      out.push({
        ...g,
        roster_id: g.opp_roster_id,
        manager_id: g.opp_manager_id,
        manager_name: g.opp_manager_name,
        team_name: g.opp_team_name,
        points: g.opp_points ?? g.points,
        opp_roster_id: g.roster_id,
        opp_manager_id: g.manager_id,
        opp_manager_name: g.manager_name,
        opp_team_name: g.team_name,
        opp_points: g.points,
        result: g.result === "W" ? "L" : g.result === "L" ? "W" : g.result,
        margin: g.margin != null ? -g.margin : null,
      });
    } else {
      out.push(g);
    }
  }
  return out;
}

export interface StreakRecord {
  manager_id: string;
  manager_name: string;
  avatar: string | null;
  length: number;
  type: "W" | "L";
  start_season: string;
  start_week: number;
  end_season: string;
  end_week: number;
}

export interface PlayerPerformance {
  player_id: string;
  player_name: string | null;
  position: string | null;
  points: number;
  season: string;
  week: number;
  manager_name: string | null;
  team_name: string | null;
}

export async function getLeagueRecords() {
  const games = await getAllGames();
  const uniqueMatchups = dedupeMatchups(games);
  const decided = games.filter((g) => g.opp_points != null);

  // Single-week games only, for every list on the Records page. A merged
  // multi-week round's combined total isn't a fair comparison against a
  // single week's output — it would always dominate the top of every
  // points-based list (highest/lowest score, biggest blowout, highest
  // combined shootout) simply because it's summing two weeks, not because
  // it was actually a bigger single-week performance. It still counts
  // everywhere a game *result* matters rather than its raw point total:
  // win/loss, streaks, head-to-head.
  const singleWeekGames = games.filter((g) => !g.weekLabel.includes("-"));
  const singleWeekMatchups = uniqueMatchups.filter((g) => !g.weekLabel.includes("-"));

  const highestScores = [...singleWeekGames].sort((a, b) => b.points - a.points).slice(0, 10);
  const lowestScores = [...singleWeekGames].sort((a, b) => a.points - b.points).slice(0, 10);

  const biggestBlowouts = [...singleWeekMatchups]
    .filter((g) => g.margin != null)
    .sort((a, b) => Math.abs(b.margin!) - Math.abs(a.margin!))
    .slice(0, 10);

  const closestGames = [...singleWeekMatchups]
    .filter((g) => g.margin != null && g.result !== "T")
    .sort((a, b) => Math.abs(a.margin!) - Math.abs(b.margin!))
    .slice(0, 10);

  const highestCombined = [...singleWeekMatchups]
    .filter((g) => g.opp_points != null)
    .sort((a, b) => b.points + b.opp_points! - (a.points + a.opp_points!))
    .slice(0, 10);

  // Longest win / loss streaks per manager, chronological.
  const byManager = new Map<string, Game[]>();
  for (const g of decided) {
    if (!g.manager_id) continue;
    const list = byManager.get(g.manager_id) ?? [];
    list.push(g);
    byManager.set(g.manager_id, list);
  }

  const streaks: StreakRecord[] = [];
  for (const [managerId, list] of byManager) {
    list.sort((a, b) => (a.season === b.season ? a.week - b.week : a.season.localeCompare(b.season)));
    let currentType: "W" | "L" | null = null;
    let length = 0;
    let start: Game | null = null;
    let prev: Game | null = null;

    const flush = () => {
      if (currentType && length > 0 && start && prev) {
        streaks.push({
          manager_id: managerId,
          manager_name: start.manager_name ?? "Unknown",
          avatar: start.avatar,
          length,
          type: currentType,
          start_season: start.season,
          start_week: start.week,
          end_season: prev.season,
          end_week: prev.week,
        });
      }
    };

    for (const g of list) {
      const t = g.result === "T" ? null : (g.result as "W" | "L");
      if (t && t === currentType) {
        length++;
        prev = g;
      } else {
        flush();
        currentType = t;
        length = t ? 1 : 0;
        start = g;
        prev = g;
      }
    }
    flush();
  }
  streaks.sort((a, b) => b.length - a.length);
  const longestWinStreaks = streaks.filter((s) => s.type === "W").slice(0, 5);
  const longestLossStreaks = streaks.filter((s) => s.type === "L").slice(0, 5);

  // Best individual player single-game performances.
  const db = createReadClient();
  const { data: matchupPlayers, error } = await db
    .from("matchup_players")
    .select("*, player:players(full_name, position)")
    .order("points", { ascending: false })
    .limit(200);
  if (error) throw error;

  const { data: leagues } = await db.from("leagues").select("league_id, season");
  const { data: teamSeasons } = await db.from("team_seasons").select("*, manager:managers(display_name)");
  const seasonByLeague = new Map((leagues ?? []).map((l) => [l.league_id, l.season as string]));
  const teamByKey = new Map(
    ((teamSeasons ?? []) as unknown as TeamSeasonWithManager[]).map((t) => [
      `${t.league_id}:${t.roster_id}`,
      t,
    ])
  );

  const bestPerformances: PlayerPerformance[] = ((matchupPlayers ?? []) as unknown as MatchupPlayerWithPlayer[])
    .slice(0, 10)
    .map((mp) => {
      const team = teamByKey.get(`${mp.league_id}:${mp.roster_id}`);
      return {
        player_id: mp.player_id,
        player_name: mp.player?.full_name ?? mp.player_id,
        position: mp.player?.position ?? null,
        points: Number(mp.points),
        season: seasonByLeague.get(mp.league_id) ?? "",
        week: mp.week,
        manager_name: team?.manager?.display_name ?? null,
        team_name: team?.team_name ?? null,
      };
    });

  return {
    highestScores,
    lowestScores,
    biggestBlowouts,
    closestGames,
    highestCombined,
    longestWinStreaks,
    longestLossStreaks,
    bestPerformances,
  };
}
