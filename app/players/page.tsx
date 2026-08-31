import Link from "next/link";
import { listPlayers } from "@/lib/queries/players";
import { PageHeader } from "@/components/page-header";
import { PlayerFilters } from "@/components/player-filters";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtPoints } from "@/lib/format";
import { Users } from "lucide-react";

export const revalidate = 300;
export const metadata = { title: "Players" };

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; position?: string }>;
}) {
  const { q = "", position = "ALL" } = await searchParams;
  const players = await listPlayers({ search: q, position });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Players"
        title="Player Database"
        description="Every player who has appeared on a roster in this league's history, ranked by total fantasy points scored."
      />

      <PlayerFilters initialSearch={q} initialPosition={position} />

      {players.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Pos</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Total Points</TableHead>
                <TableHead className="text-right">Games</TableHead>
                <TableHead className="text-right">PPG</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((p, i) => (
                <TableRow key={p.player_id} className="cursor-pointer">
                  <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <Link href={`/players/${p.player_id}`} className="font-medium hover:text-primary">
                      {p.full_name ?? p.player_id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {p.position && (
                      <Badge variant="outline" className="text-muted-foreground">
                        {p.position}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.team ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {fmtPoints(Number(p.total_points))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                    {p.games_played}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                    {fmtPoints(Number(p.ppg))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No players found"
          description="Try a different search term or position filter."
        />
      )}
    </div>
  );
}
