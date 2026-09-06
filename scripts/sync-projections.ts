import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { sleeper } from "../lib/sleeper/client";
import { fitPositionRegressions, predictPpg, type TrainingExample } from "../lib/projections/regression";
import { optimalLineupTotal, type ProjectedRosterPlayer } from "../lib/projections/lineup";
import { simulateSeason, type SimGame, type SimTeam } from "../lib/projections/simulate";

const db = createAdminClient();
const NUM_SIMULATIONS = 10_000;
const PROJECTABLE_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);

interface LeagueRow {
  league_id: string;
  season: string;
  status: string;
  is_current: boolean;
  roster_positions: string[];
  settings: Record<string, unknown>;
  playoff_week_start: number | null;
}

// Supabase/PostgREST caps unpaginated selects at 1000 rows — one season of
// matchup_players (~8 rosters x ~18 weeks x ~23 players) comfortably
// exceeds that, so this must page through explicitly or it silently drops
// most of the league (found via testing: several long-tenured starters
// were missing prior-season data entirely because of this).
async function fetchAllMatchupPlayerPoints(leagueId: string): Promise<{ player_id: string; points: number; is_starter: boolean }[]> {
  const PAGE = 1000;
  const rows: { player_id: string; points: number; is_starter: boolean }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("matchup_players")
      .select("player_id, points, is_starter")
      .eq("league_id", leagueId)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`matchup_players fetch failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

// PPG is computed from STARTER weeks only, not every roster-week. A
// player's bench weeks (byes, committee timeshares, buried on a deep
// bench) drag down an all-appearances average well below what they
// actually produce when a manager plays them — and a team's real score
// only ever comes from its starters, so that's the quantity worth
// projecting. Confirmed via testing: switching to starter-only PPG closed
// most of a ~35-point gap between this model's projected team totals and
// this league's actual historical team-week average.
async function seasonPpgByPlayer(leagueId: string): Promise<Map<string, { ppg: number; games: number; position: string }>> {
  const data = await fetchAllMatchupPlayerPoints(leagueId);

  const totals = new Map<string, { sum: number; games: number }>();
  for (const row of data ?? []) {
    if (!row.is_starter) continue;
    const cur = totals.get(row.player_id) ?? { sum: 0, games: 0 };
    cur.sum += Number(row.points);
    cur.games += 1;
    totals.set(row.player_id, cur);
  }

  const playerIds = [...totals.keys()];
  const positionById = new Map<string, string>();
  const CHUNK = 500;
  for (let i = 0; i < playerIds.length; i += CHUNK) {
    const { data: players, error: pErr } = await db
      .from("players")
      .select("player_id, position")
      .in("player_id", playerIds.slice(i, i + CHUNK));
    if (pErr) throw new Error(`players fetch failed: ${pErr.message}`);
    for (const p of players ?? []) positionById.set(p.player_id, p.position);
  }

  const result = new Map<string, { ppg: number; games: number; position: string }>();
  for (const [playerId, { sum, games }] of totals) {
    const position = positionById.get(playerId);
    if (!position || !PROJECTABLE_POSITIONS.has(position)) continue;
    result.set(playerId, { ppg: sum / games, games, position });
  }
  return result;
}

async function main() {
  const { data: leagueRows, error: leagueErr } = await db
    .from("leagues")
    .select("league_id, season, status, is_current, roster_positions, settings, playoff_week_start")
    .order("season");
  if (leagueErr) throw new Error(`leagues fetch failed: ${leagueErr.message}`);

  const leagues = (leagueRows ?? []) as LeagueRow[];
  const currentLeague = leagues.find((l) => l.is_current);
  if (!currentLeague) throw new Error("No current league found");

  // ---- 1. Build training examples from every consecutive pair of completed seasons ----
  console.log("Building training set from season-over-season player scoring...");
  const seasonPpgCache = new Map<string, Map<string, { ppg: number; games: number; position: string }>>();
  async function getSeasonPpg(leagueId: string) {
    if (!seasonPpgCache.has(leagueId)) seasonPpgCache.set(leagueId, await seasonPpgByPlayer(leagueId));
    return seasonPpgCache.get(leagueId)!;
  }

  // A prior-season PPG computed over only a handful of starts (injury,
  // committee timeshare, late-season call-up) is a much noisier estimate of
  // true ability than one over most of a season — feeding both in as if
  // equally reliable measurably biases the fitted slope toward zero
  // (regression dilution/attenuation, confirmed on real data). Starter
  // counts run lower than roster-week counts, so the floor here is lower
  // than a "played in N games" threshold would be. This only gates which
  // seasons count as *training* examples; every rostered player still gets
  // a final projection below.
  const MIN_PRIOR_GAMES_FOR_TRAINING = 4;

  const trainingExamples: TrainingExample[] = [];
  for (let i = 0; i < leagues.length - 1; i++) {
    const seasonA = leagues[i];
    const seasonB = leagues[i + 1];
    if (seasonA.status !== "complete" || seasonB.status !== "complete") continue;

    const ppgA = await getSeasonPpg(seasonA.league_id);
    const ppgB = await getSeasonPpg(seasonB.league_id);
    for (const [playerId, a] of ppgA) {
      if (a.games < MIN_PRIOR_GAMES_FOR_TRAINING) continue;
      const b = ppgB.get(playerId);
      if (!b) continue; // player didn't play in the following season
      trainingExamples.push({ position: a.position, priorPpg: a.ppg, priorGames: a.games, nextPpg: b.ppg });
    }
  }
  console.log(`  ${trainingExamples.length} training examples across ${leagues.length} seasons`);

  const models = fitPositionRegressions(trainingExamples);
  for (const model of models.values()) {
    console.log(`  ${model.position}: n=${model.n} r2=${model.r2.toFixed(3)} ppg_coef=${model.coefPpg.toFixed(3)} games_coef=${model.coefGames.toFixed(3)}`);
  }

  // ---- 2. Project every player currently on a roster in the current league ----
  const priorLeague = [...leagues].reverse().find((l) => l.status === "complete" && Number(l.season) < Number(currentLeague.season));
  const priorPpg = priorLeague ? await getSeasonPpg(priorLeague.league_id) : new Map();

  const { data: rosterPlayerRows, error: rpErr } = await db
    .from("roster_players")
    .select("roster_id, player_id")
    .eq("league_id", currentLeague.league_id);
  if (rpErr) throw new Error(`roster_players fetch failed: ${rpErr.message}`);

  const rosteredPlayerIds = [...new Set((rosterPlayerRows ?? []).map((r) => r.player_id))];
  const positionByPlayerId = new Map<string, string>();
  {
    const CHUNK = 500;
    for (let i = 0; i < rosteredPlayerIds.length; i += CHUNK) {
      const { data: players, error } = await db.from("players").select("player_id, position").in("player_id", rosteredPlayerIds.slice(i, i + CHUNK));
      if (error) throw new Error(`players fetch failed: ${error.message}`);
      for (const p of players ?? []) if (p.position) positionByPlayerId.set(p.player_id, p.position);
    }
  }

  type Projection = { player_id: string; position: string; projected_ppg: number; basis: "regression" | "position_average"; prior_season_ppg: number | null; prior_season_games: number | null };
  const projections = new Map<string, Projection>();

  for (const playerId of rosteredPlayerIds) {
    const position = positionByPlayerId.get(playerId);
    if (!position || !PROJECTABLE_POSITIONS.has(position)) continue;

    const prior = priorPpg.get(playerId);
    const model = models.get(position);
    if (prior && model) {
      projections.set(playerId, {
        player_id: playerId,
        position,
        projected_ppg: predictPpg(model, prior.ppg, prior.games),
        basis: "regression",
        prior_season_ppg: prior.ppg,
        prior_season_games: prior.games,
      });
    }
  }

  // Rookies / players with no prior-season history: fall back to this run's
  // own position average among players that DID get a regression projection.
  const positionAverages = new Map<string, number>();
  for (const position of PROJECTABLE_POSITIONS) {
    const values = [...projections.values()].filter((p) => p.position === position).map((p) => p.projected_ppg);
    if (values.length > 0) positionAverages.set(position, values.reduce((s, v) => s + v, 0) / values.length);
  }
  for (const playerId of rosteredPlayerIds) {
    if (projections.has(playerId)) continue;
    const position = positionByPlayerId.get(playerId);
    if (!position || !PROJECTABLE_POSITIONS.has(position)) continue;
    projections.set(playerId, {
      player_id: playerId,
      position,
      projected_ppg: positionAverages.get(position) ?? 0,
      basis: "position_average",
      prior_season_ppg: null,
      prior_season_games: null,
    });
  }

  console.log(`Projecting ${projections.size} rostered players for ${currentLeague.season}...`);
  const projectionRows = [...projections.values()].map((p) => ({ ...p, season: currentLeague.season, projected_ppg: Number(p.projected_ppg.toFixed(2)) }));
  for (let i = 0; i < projectionRows.length; i += 500) {
    const { error } = await db.from("player_projections").upsert(projectionRows.slice(i, i + 500), { onConflict: "player_id,season" });
    if (error) throw new Error(`upsert player_projections failed: ${error.message}`);
  }

  // ---- 3. Compute each team's projected weekly score (optimal lineup) ----
  const rosterIds = [...new Set((rosterPlayerRows ?? []).map((r) => r.roster_id))];
  const playersByRoster = new Map<number, ProjectedRosterPlayer[]>();
  for (const row of rosterPlayerRows ?? []) {
    const projection = projections.get(row.player_id);
    if (!projection) continue;
    if (!playersByRoster.has(row.roster_id)) playersByRoster.set(row.roster_id, []);
    playersByRoster.get(row.roster_id)!.push({ player_id: row.player_id, position: projection.position, projected_ppg: projection.projected_ppg });
  }

  const projectedMeanByRoster = new Map<number, number>();
  for (const rosterId of rosterIds) {
    const players = playersByRoster.get(rosterId) ?? [];
    projectedMeanByRoster.set(rosterId, optimalLineupTotal(players, currentLeague.roster_positions));
  }

  // ---- 4. Pooled week-to-week scoring variance from this league's own history ----
  const completeLeagueIds = leagues.filter((l) => l.status === "complete").map((l) => l.league_id);
  let stddev = 20; // sane fallback if there's no history at all yet
  if (completeLeagueIds.length > 0) {
    const { data: pastMatchups, error } = await db.from("matchups").select("points").in("league_id", completeLeagueIds).eq("is_playoff", false);
    if (error) throw new Error(`matchups fetch failed: ${error.message}`);
    const points = (pastMatchups ?? []).map((m) => Number(m.points)).filter((p) => p > 0);
    if (points.length > 1) {
      const mean = points.reduce((s, p) => s + p, 0) / points.length;
      const variance = points.reduce((s, p) => s + (p - mean) ** 2, 0) / (points.length - 1);
      stddev = Math.sqrt(variance);
    }
  }
  console.log(`Pooled weekly score stddev: ${stddev.toFixed(2)}`);

  // ---- 5. Actual record so far this season (simulation starts from here) ----
  const { data: teamSeasonRows, error: tsErr } = await db
    .from("team_seasons")
    .select("roster_id, wins, fpts_for")
    .eq("league_id", currentLeague.league_id);
  if (tsErr) throw new Error(`team_seasons fetch failed: ${tsErr.message}`);
  const actualByRoster = new Map((teamSeasonRows ?? []).map((r) => [r.roster_id, { wins: r.wins, fpts_for: Number(r.fpts_for) }]));

  const teams: SimTeam[] = rosterIds.map((rosterId) => ({
    roster_id: rosterId,
    projected_mean: projectedMeanByRoster.get(rosterId) ?? 0,
    actual_wins: actualByRoster.get(rosterId)?.wins ?? 0,
    actual_points_for: actualByRoster.get(rosterId)?.fpts_for ?? 0,
  }));

  // ---- 6. Remaining schedule (Sleeper publishes the full season upfront, ----
  //          but scripts/ingest.ts deliberately only persists completed
  //          weeks — so fetch the schedule for unplayed weeks directly).
  const nflState = await sleeper.getNflState();
  const playoffWeekStart = currentLeague.playoff_week_start ?? 15;
  const games: SimGame[] = [];
  for (let week = Math.max(1, nflState.week); week < playoffWeekStart; week++) {
    const matchups = await sleeper.getMatchups(currentLeague.league_id, week);
    if (!matchups || matchups.length === 0) continue;
    const byMatchupId = new Map<number, number[]>();
    for (const m of matchups) {
      if (m.matchup_id == null) continue; // no real opponent that week
      if (!byMatchupId.has(m.matchup_id)) byMatchupId.set(m.matchup_id, []);
      byMatchupId.get(m.matchup_id)!.push(m.roster_id);
    }
    for (const [matchupId, ids] of byMatchupId) {
      if (ids.length !== 2) continue;
      games.push({ week, matchup_id: matchupId, rosterA: ids[0], rosterB: ids[1] });
    }
  }
  console.log(`Simulating ${games.length} remaining games across ${NUM_SIMULATIONS} season simulations...`);

  const playoffTeams = Number((currentLeague.settings as { playoff_teams?: number })?.playoff_teams ?? 4);
  const { teams: simResults, matchupWinProbability } = simulateSeason(teams, games, stddev, playoffTeams, NUM_SIMULATIONS);

  // ---- 7. Write results ----
  const teamProjectionRows = simResults.map((r) => ({
    league_id: currentLeague.league_id,
    roster_id: r.roster_id,
    season: currentLeague.season,
    projected_lineup_ppg: Number((projectedMeanByRoster.get(r.roster_id) ?? 0).toFixed(2)),
    mean_wins: Number(r.mean_wins.toFixed(2)),
    median_wins: Math.round(r.median_wins),
    playoff_probability: Number(r.playoff_probability.toFixed(4)),
    avg_final_standing: Number(r.avg_final_standing.toFixed(2)),
    standing_distribution: r.standing_distribution,
    simulations: NUM_SIMULATIONS,
  }));
  const { error: teamProjErr } = await db.from("team_season_projections").upsert(teamProjectionRows, { onConflict: "league_id,roster_id" });
  if (teamProjErr) throw new Error(`upsert team_season_projections failed: ${teamProjErr.message}`);

  await db.from("matchup_predictions").delete().eq("league_id", currentLeague.league_id).lt("week", nflState.week);

  const matchupRows = games.flatMap((game) => {
    const rosterAWin = matchupWinProbability.get(`${game.week}:${game.rosterA}`) ?? 0.5;
    const rosterBWin = matchupWinProbability.get(`${game.week}:${game.rosterB}`) ?? 0.5;
    return [
      {
        league_id: currentLeague.league_id,
        week: game.week,
        roster_id: game.rosterA,
        opponent_roster_id: game.rosterB,
        matchup_id: game.matchup_id,
        win_probability: Number(rosterAWin.toFixed(4)),
        projected_points: Number((projectedMeanByRoster.get(game.rosterA) ?? 0).toFixed(2)),
        opponent_projected_points: Number((projectedMeanByRoster.get(game.rosterB) ?? 0).toFixed(2)),
      },
      {
        league_id: currentLeague.league_id,
        week: game.week,
        roster_id: game.rosterB,
        opponent_roster_id: game.rosterA,
        matchup_id: game.matchup_id,
        win_probability: Number(rosterBWin.toFixed(4)),
        projected_points: Number((projectedMeanByRoster.get(game.rosterB) ?? 0).toFixed(2)),
        opponent_projected_points: Number((projectedMeanByRoster.get(game.rosterA) ?? 0).toFixed(2)),
      },
    ];
  });
  for (let i = 0; i < matchupRows.length; i += 500) {
    const { error } = await db.from("matchup_predictions").upsert(matchupRows.slice(i, i + 500), { onConflict: "league_id,week,roster_id" });
    if (error) throw new Error(`upsert matchup_predictions failed: ${error.message}`);
  }

  console.log(`Done. Wrote ${teamProjectionRows.length} team projections and ${matchupRows.length} matchup predictions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
