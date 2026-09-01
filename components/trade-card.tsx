import { TeamBadge } from "@/components/team-badge";
import { Badge } from "@/components/ui/badge";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowRightLeft } from "lucide-react";
import type { Trade } from "@/lib/queries/trades";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function TradeCard({ trade }: { trade: Trade }) {
  const maxNet = Math.max(...trade.sides.map((s) => s.netValue));

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ArrowRightLeft className="h-3.5 w-3.5" />
          {formatDate(trade.created_at)}
        </span>
        <span>{trade.season} Season</span>
      </div>

      <div className={cn("grid gap-4", trade.sides.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        {trade.sides.map((side) => {
          const isTopValue = side.netValue === maxNet && trade.sides.length > 1 && maxNet > 0;
          return (
            <div key={side.roster_id} className="flex flex-col gap-3 rounded-xl bg-background/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <TeamBadge
                  name={side.team_name ?? side.manager_name ?? "Unknown"}
                  subtitle={side.manager_name ?? undefined}
                  avatar={side.avatar}
                  size="sm"
                />
                {isTopValue && (
                  <Badge variant="secondary" className="bg-primary/20 text-primary">
                    Value winner
                  </Badge>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Received
                </span>
                {side.received.map((asset, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-foreground">
                      {asset.label}
                      {asset.detail && <span className="text-muted-foreground"> → {asset.detail}</span>}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {asset.value != null ? fmtNumber(asset.value) : "—"}
                    </span>
                  </div>
                ))}
              </div>

              {side.sent.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-border/40 pt-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Gave up
                  </span>
                  {side.sent.map((asset, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                      <span className="min-w-0 truncate">
                        {asset.label}
                        {asset.detail && <span> → {asset.detail}</span>}
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums">
                        {asset.value != null ? fmtNumber(asset.value) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
                <span className="text-muted-foreground">Net value</span>
                <span
                  className={cn(
                    "font-mono font-semibold tabular-nums",
                    side.netValue > 0 && "text-primary",
                    side.netValue < 0 && "text-destructive",
                    side.netValue === 0 && "text-foreground"
                  )}
                >
                  {side.netValue > 0 ? "+" : ""}
                  {fmtNumber(side.netValue)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
