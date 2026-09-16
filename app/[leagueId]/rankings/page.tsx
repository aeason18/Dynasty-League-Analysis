import { resolveLeagueGroupId } from "@/lib/queries/leagues";
import { getPowerRankings } from "@/lib/queries/rankings";
import { PageHeader } from "@/components/page-header";
import { TeamBadge } from "@/components/team-badge";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import type { RosterProfile } from "@/lib/queries/rankings";

export const revalidate = 300;
export const metadata = { title: "Rankings" };

const PROFILE_STYLE: Record<RosterProfile, string> = {
  "Top Heavy": "bg-pop/15 text-pop",
  Balanced: "bg-primary/15 text-primary",
  Deep: "bg-accent/20 text-accent",
};

export default async function RankingsPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const leagueGroupId = (await resolveLeagueGroupId(leagueId))!;
  const rankings = await getPowerRankings(leagueGroupId);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        eyebrow="Rankings"
        title="Power Rankings"
        description="Every current roster, scored on a weighted model: star power carries the most weight, then the starting lineup, then bench depth and draft capital -- roster totals alone don't decide it."
      />

      {rankings.length === 0 ? (
        <EmptyState icon={Trophy} title="No roster data yet" description="Power rankings need current roster data to compute." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead className="text-right">Star</TableHead>
                  <TableHead className="text-right">Starters</TableHead>
                  <TableHead className="text-right">Depth</TableHead>
                  <TableHead className="text-right">Picks</TableHead>
                  <TableHead className="text-right">Overall</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.map((r) => (
                  <TableRow key={r.roster_id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        {r.rank === 1 && <span className="h-1 w-1 shrink-0 rounded-full bg-pop" aria-hidden />}
                        {r.rank}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TeamBadge
                        name={r.team_name ?? r.manager_name}
                        subtitle={r.topPlayers.map((p) => p.name).slice(0, 2).join(" · ") || undefined}
                        avatar={r.avatar}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("border-0", PROFILE_STYLE[r.profile])}>
                        {r.profile}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {r.starScore.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {r.starterScore.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {r.depthScore.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {r.picksScore.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-base font-semibold tabular-nums text-primary">
                      {r.overall.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            Star = top 3-4 players by dynasty market value, heavily weighted (~45%). Starters = the players filling
            the starting lineup (~28%). Depth = the rest of the bench and taxi squad, with diminishing weight
            further down the roster (~15%). Picks = currently owned future draft capital, valued the same way
            (~12%). Every column is scored relative to the rest of the league, so a 94.7 means elite for this
            league specifically, not an absolute number. Values come from FantasyCalc&apos;s dynasty market.
          </p>
        </>
      )}
    </div>
  );
}
