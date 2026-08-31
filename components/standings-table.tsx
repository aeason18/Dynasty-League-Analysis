import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TeamBadge } from "@/components/team-badge";
import { fmtPct, fmtPoints } from "@/lib/format";
import type { StandingsRow } from "@/lib/queries/standings";
import { Crown } from "lucide-react";

export function StandingsTable({ rows }: { rows: StandingsRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">#</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">W-L-T</TableHead>
            <TableHead className="text-right">Pct</TableHead>
            <TableHead className="text-right">PF</TableHead>
            <TableHead className="text-right">PA</TableHead>
            <TableHead className="text-right">Diff</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.league_id}-${row.roster_id}`}>
              <TableCell className="font-mono text-xs text-muted-foreground">{row.rank}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <TeamBadge
                    name={row.team_name ?? row.manager?.display_name ?? `Team ${row.roster_id}`}
                    subtitle={row.manager?.display_name}
                    avatar={row.manager?.avatar}
                  />
                  {row.playoff_result === "champion" && (
                    <Badge variant="secondary" className="gap-1 bg-accent/20 text-accent">
                      <Crown className="h-3 w-3" /> Champion
                    </Badge>
                  )}
                  {row.playoff_result === "runner_up" && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Runner-up
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">
                {row.wins}-{row.losses}
                {row.ties ? `-${row.ties}` : ""}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                {fmtPct(row.wins, row.losses, row.ties)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">
                {fmtPoints(Number(row.fpts_for))}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                {fmtPoints(Number(row.fpts_against))}
              </TableCell>
              <TableCell
                className={`text-right font-mono text-sm tabular-nums ${
                  row.point_diff >= 0 ? "text-primary" : "text-destructive"
                }`}
              >
                {row.point_diff >= 0 ? "+" : ""}
                {fmtPoints(row.point_diff)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
