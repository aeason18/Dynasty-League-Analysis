import { TeamBadge } from "@/components/team-badge";
import { fmtPoints } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Game } from "@/lib/queries/games";

export function MatchupRow({ game }: { game: Game }) {
  const aWon = game.result === "W";
  const bWon = game.result === "L";
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-background/40 px-4 py-3">
      <div className="flex w-24 shrink-0 flex-col text-xs text-muted-foreground">
        <span>Week {game.weekLabel}</span>
        {game.is_playoff && <span className="text-accent">Playoffs</span>}
      </div>
      <div className="flex flex-1 items-center justify-between gap-4">
        <TeamBadge
          name={game.team_name ?? game.manager_name ?? "Unknown"}
          subtitle={game.manager_name ?? undefined}
          avatar={game.avatar}
          className={cn("flex-1", aWon && "opacity-100")}
        />
        <div className="flex items-center gap-2 font-mono text-sm tabular-nums">
          <span className={cn(aWon ? "font-semibold text-primary" : "text-foreground")}>
            {fmtPoints(game.points)}
          </span>
          <span className="text-muted-foreground">–</span>
          <span className={cn(bWon ? "font-semibold text-primary" : "text-muted-foreground")}>
            {game.opp_points != null ? fmtPoints(game.opp_points) : "—"}
          </span>
        </div>
        <TeamBadge
          name={game.opp_team_name ?? game.opp_manager_name ?? "Unknown"}
          subtitle={game.opp_manager_name ?? undefined}
          className="flex-1"
        />
      </div>
    </div>
  );
}
