import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPlayer, getPlayerTeamSplits, getPlayerGameLog } from "@/lib/queries/players";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { PlayerPointsChart } from "@/components/charts/player-points-chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtPoints } from "@/lib/format";
import { Target, Gauge, Repeat, TrendingUp } from "lucide-react";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayer(id);
  return { title: player?.full_name ?? "Player" };
}

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  const [teamSplits, gameLog] = await Promise.all([getPlayerTeamSplits(id), getPlayerGameLog(id)]);

  // Bye/injury/inactive weeks (did_play === false) are shown in the log
  // below for a complete history, but shouldn't count toward games-played
  // or PPG — same rule as the player_league_totals/player_team_points
  // views this page's other numbers come from.
  const playedGames = gameLog.filter((g) => g.did_play !== false);
  const totalPoints = playedGames.reduce((sum, g) => sum + g.points, 0);
  const totalGames = playedGames.length;
  const ppg = totalGames ? totalPoints / totalGames : 0;
  const bestGame = gameLog.length ? [...gameLog].sort((a, b) => b.points - a.points)[0] : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/players"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Players
        </Link>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {player.full_name ?? player.player_id}
            </h1>
            {player.position && <Badge>{player.position}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {[player.team, player.college, player.status].filter(Boolean).join(" · ") || "No additional bio data from Sleeper"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Points" value={fmtPoints(totalPoints)} icon={Target} />
        <StatCard label="Games Played" value={String(totalGames)} icon={Repeat} />
        <StatCard label="PPG" value={fmtPoints(ppg)} icon={Gauge} accent="accent" />
        <StatCard
          label="Best Game"
          value={bestGame ? `${fmtPoints(bestGame.points)} pts` : "—"}
          sublabel={bestGame ? `${bestGame.season} Wk ${bestGame.week}` : undefined}
          icon={TrendingUp}
        />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Scoring History</h2>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          {gameLog.length > 0 ? (
            <PlayerPointsChart data={gameLog} />
          ) : (
            <EmptyState title="No game log yet" description="This player hasn't scored fantasy points in this league yet." />
          )}
        </div>
      </section>

      {teamSplits.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Points by Franchise</h2>
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Manager</TableHead>
                  <TableHead className="text-right">Total Points</TableHead>
                  <TableHead className="text-right">Games</TableHead>
                  <TableHead className="text-right">PPG</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamSplits.map((t) => (
                  <TableRow key={t.manager_id}>
                    <TableCell className="font-medium">{t.manager_name}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {fmtPoints(Number(t.total_points))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {t.games_played}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {fmtPoints(Number(t.ppg))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {gameLog.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Game Log</h2>
          <div className="max-h-[480px] overflow-y-auto overflow-x-auto rounded-2xl border border-border/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Season</TableHead>
                  <TableHead>Week</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...gameLog].reverse().map((g, i) => (
                  <TableRow key={`${g.season}-${g.week}-${i}`} className={g.did_play === false ? "opacity-50" : undefined}>
                    <TableCell>{g.season}</TableCell>
                    <TableCell className="text-muted-foreground">{g.week}</TableCell>
                    <TableCell className="text-muted-foreground">{g.team_name ?? g.manager_name ?? "—"}</TableCell>
                    <TableCell>
                      {g.did_play === false ? (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Did not play
                        </Badge>
                      ) : (
                        <Badge variant={g.is_starter ? "default" : "outline"} className="text-[10px]">
                          {g.is_starter ? "Starter" : "Bench"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {fmtPoints(g.points)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
