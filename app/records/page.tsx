import { getLeagueRecords } from "@/lib/queries/records";
import { PageHeader } from "@/components/page-header";
import { TeamBadge } from "@/components/team-badge";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtPoints } from "@/lib/format";
import type { Game } from "@/lib/queries/games";
import type { PlayerPerformance, StreakRecord } from "@/lib/queries/records";

export const revalidate = 300;
export const metadata = { title: "Records" };

export default async function RecordsPage() {
  const records = await getLeagueRecords();
  const hasAnyData = records.highestScores.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Records"
        title="League Records"
        description="Every notable record in this dynasty's history, computed from real game and player data."
      />

      {!hasAnyData ? (
        <EmptyState title="No records yet" description="Records will populate once games have been played." />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RecordCard title="Highest Single-Game Scores">
            {records.highestScores.map((g, i) => (
              <GameRecordRow key={i} rank={i + 1} game={g} valueLabel={`${fmtPoints(g.points)} pts`} />
            ))}
          </RecordCard>

          <RecordCard title="Lowest Single-Game Scores">
            {records.lowestScores.map((g, i) => (
              <GameRecordRow key={i} rank={i + 1} game={g} valueLabel={`${fmtPoints(g.points)} pts`} />
            ))}
          </RecordCard>

          <RecordCard title="Biggest Blowouts">
            {records.biggestBlowouts.map((g, i) => (
              <GameRecordRow
                key={i}
                rank={i + 1}
                game={g}
                valueLabel={`+${fmtPoints(Math.abs(g.margin ?? 0))} pts`}
                showOpponent
              />
            ))}
          </RecordCard>

          <RecordCard title="Closest Games">
            {records.closestGames.map((g, i) => (
              <GameRecordRow
                key={i}
                rank={i + 1}
                game={g}
                valueLabel={`${fmtPoints(Math.abs(g.margin ?? 0))} pt margin`}
                showOpponent
              />
            ))}
          </RecordCard>

          <RecordCard title="Highest Combined Score (Shootouts)">
            {records.highestCombined.map((g, i) => (
              <GameRecordRow
                key={i}
                rank={i + 1}
                game={g}
                valueLabel={`${fmtPoints(g.points + (g.opp_points ?? 0))} combined pts`}
                showOpponent
              />
            ))}
          </RecordCard>

          <RecordCard title="Best Individual Player Performances">
            {records.bestPerformances.map((p, i) => (
              <PlayerRecordRow key={i} rank={i + 1} performance={p} />
            ))}
          </RecordCard>

          <RecordCard title="Longest Winning Streaks">
            {records.longestWinStreaks.length > 0 ? (
              records.longestWinStreaks.map((s, i) => <StreakRow key={i} rank={i + 1} streak={s} />)
            ) : (
              <p className="py-4 text-sm text-muted-foreground">No streaks recorded yet.</p>
            )}
          </RecordCard>

          <RecordCard title="Longest Losing Streaks">
            {records.longestLossStreaks.length > 0 ? (
              records.longestLossStreaks.map((s, i) => <StreakRow key={i} rank={i + 1} streak={s} />)
            ) : (
              <p className="py-4 text-sm text-muted-foreground">No streaks recorded yet.</p>
            )}
          </RecordCard>
        </div>
      )}
    </div>
  );
}

function RecordCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/60 bg-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border/50">{children}</CardContent>
    </Card>
  );
}

function GameRecordRow({
  rank,
  game,
  valueLabel,
  showOpponent = false,
}: {
  rank: number;
  game: Game;
  valueLabel: string;
  showOpponent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-4 shrink-0 font-mono text-xs text-muted-foreground">{rank}</span>
        <TeamBadge
          name={game.team_name ?? game.manager_name ?? "Unknown"}
          subtitle={
            showOpponent
              ? `${game.season} Wk ${game.weekLabel} vs ${game.opp_team_name ?? game.opp_manager_name ?? "—"}`
              : `${game.season} Wk ${game.weekLabel}`
          }
          avatar={game.avatar}
          size="sm"
        />
      </div>
      <span className="shrink-0 font-mono text-sm font-medium tabular-nums">{valueLabel}</span>
    </div>
  );
}

function PlayerRecordRow({ rank, performance }: { rank: number; performance: PlayerPerformance }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-4 shrink-0 font-mono text-xs text-muted-foreground">{rank}</span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground">
            {performance.player_name}
            {performance.position && <span className="ml-1.5 text-xs text-muted-foreground">{performance.position}</span>}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {performance.season} Wk {performance.week} · {performance.team_name ?? performance.manager_name ?? "—"}
          </span>
        </div>
      </div>
      <span className="shrink-0 font-mono text-sm font-medium tabular-nums">{fmtPoints(performance.points)} pts</span>
    </div>
  );
}

function StreakRow({ rank, streak }: { rank: number; streak: StreakRecord }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-4 shrink-0 font-mono text-xs text-muted-foreground">{rank}</span>
        <TeamBadge
          name={streak.manager_name}
          subtitle={`${streak.start_season} Wk ${streak.start_week} – ${streak.end_season} Wk ${streak.end_week}`}
          avatar={streak.avatar}
          size="sm"
        />
      </div>
      <span className="shrink-0 font-mono text-sm font-medium tabular-nums">{streak.length} games</span>
    </div>
  );
}
