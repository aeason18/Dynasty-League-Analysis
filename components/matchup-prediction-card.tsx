import { TeamBadge } from "@/components/team-badge";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { fmtPoints } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MatchupPredictionRow } from "@/lib/queries/projections";

function Side({
  name,
  manager,
  winProbability,
  projectedPoints,
  favored,
}: {
  name: string;
  manager: string | null;
  winProbability: number;
  projectedPoints: number;
  favored: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <TeamBadge name={name} subtitle={manager ?? undefined} />
      <div className="flex items-baseline justify-between">
        <span className={cn("font-heading text-xl font-semibold tabular-nums", favored ? "text-primary" : "text-foreground")}>
          {(winProbability * 100).toFixed(0)}%
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{fmtPoints(projectedPoints)} proj.</span>
      </div>
      <Progress value={winProbability * 100}>
        <ProgressTrack>
          <ProgressIndicator className={favored ? "bg-primary" : "bg-muted-foreground/50"} />
        </ProgressTrack>
      </Progress>
    </div>
  );
}

export function MatchupPredictionCard({ prediction }: { prediction: MatchupPredictionRow }) {
  const homeFavored = prediction.win_probability >= 0.5;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:gap-6">
      <Side
        name={prediction.team_name ?? `Team ${prediction.roster_id}`}
        manager={prediction.manager_name}
        winProbability={prediction.win_probability}
        projectedPoints={prediction.projected_points}
        favored={homeFavored}
      />
      <span className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">vs</span>
      <Side
        name={prediction.opponent_team_name ?? `Team ${prediction.opponent_roster_id}`}
        manager={prediction.opponent_manager_name}
        winProbability={1 - prediction.win_probability}
        projectedPoints={prediction.opponent_projected_points}
        favored={!homeFavored}
      />
    </div>
  );
}
