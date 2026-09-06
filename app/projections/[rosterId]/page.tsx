import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import {
  getTeamProjectionDetail,
  getTeamRosterBreakdown,
  getTeamSchedule,
} from "@/lib/queries/projections";
import { getCurrentLeague } from "@/lib/queries/leagues";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { TeamBadge } from "@/components/team-badge";
import { StandingDistributionChart } from "@/components/charts/standing-distribution-chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { fmtPoints, fmtRecord } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RosterProjectionEntry } from "@/lib/queries/projections";

export async function generateMetadata({ params }: { params: Promise<{ rosterId: string }> }) {
  const { rosterId } = await params;
  const team = await getTeamProjectionDetail(Number(rosterId));
  return { title: team ? `${team.team_name ?? "Team"} Projection` : "Team Projection" };
}

function RosterRow({ entry }: { entry: RosterProjectionEntry }) {
  const slotLabel = entry.slot === "FLEX" ? `FLEX · ${entry.position}` : (entry.slot ?? entry.position);
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{slotLabel}</TableCell>
      <TableCell>
        <Link href={`/players/${entry.player_id}`} className="font-medium hover:text-primary">
          {entry.full_name}
        </Link>
      </TableCell>
      <TableCell className="text-right font-mono text-sm tabular-nums">{fmtPoints(entry.projected_ppg)}</TableCell>
      <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
        {entry.prior_season_ppg !== null ? fmtPoints(entry.prior_season_ppg) : "—"}
      </TableCell>
      <TableCell className="text-right">
        {entry.no_history_reason === "new_to_league" && (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            rookie / new
          </Badge>
        )}
        {entry.no_history_reason === "no_snaps" && (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            no snaps last season
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

export default async function TeamProjectionPage({ params }: { params: Promise<{ rosterId: string }> }) {
  const { rosterId } = await params;
  const rosterIdNum = Number(rosterId);
  const [team, roster, schedule, league] = await Promise.all([
    getTeamProjectionDetail(rosterIdNum),
    getTeamRosterBreakdown(rosterIdNum),
    getTeamSchedule(rosterIdNum),
    getCurrentLeague(),
  ]);
  if (!team) notFound();

  const playoffTeams = Number((league?.settings as { playoff_teams?: number } | undefined)?.playoff_teams ?? 4);
  const regularSeasonWeeks = (league?.playoff_week_start ?? 15) - 1;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/projections"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Projections
        </Link>
        <PageHeader
          eyebrow="Projections"
          title={team.team_name ?? `Team ${rosterIdNum}`}
          description={team.manager?.display_name ?? undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Actual Record" value={fmtRecord(team.wins, team.losses, team.ties)} />
        <StatCard
          label="Projected Final"
          value={`${team.median_wins}-${regularSeasonWeeks - team.median_wins}`}
          sublabel="median simulated record"
          accent="primary"
        />
        <StatCard
          label="Playoff Odds"
          value={`${(team.playoff_probability * 100).toFixed(0)}%`}
          sublabel={`top ${playoffTeams} seeds`}
          icon={team.playoff_probability >= 0.5 ? Trophy : undefined}
          accent={team.playoff_probability >= 0.5 ? "primary" : "neutral"}
        />
        <StatCard label="Avg Finish" value={team.avg_final_standing.toFixed(1)} sublabel={`of ${Object.keys(team.standing_distribution).length}`} />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Where This Comes From</h2>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Across {team.simulations.toLocaleString()} simulated seasons, this is how often {team.team_name ?? "this team"} finished in
            each spot. Green bars are playoff finishes (top {playoffTeams}).
          </p>
          <StandingDistributionChart distribution={team.standing_distribution} playoffTeams={playoffTeams} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Projected Starting Lineup</h2>
        <p className="text-sm text-muted-foreground">
          The {roster.starters.length} highest-projected players at each required position — this total ({fmtPoints(team.projected_lineup_ppg)}{" "}
          PPG) is what drives the team&apos;s simulated score every week. This league&apos;s starting format is{" "}
          {(league?.roster_positions ?? []).filter((s) => s !== "BN" && s !== "IR" && s !== "TAXI").join(", ")} — FLEX can be any RB/WR/TE,
          shown here as &quot;FLEX · [position]&quot; so it&apos;s clear when it&apos;s filled by, say, a 3rd WR.
        </p>
        {roster.starters.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Slot</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Proj. PPG</TableHead>
                  <TableHead className="text-right">Prior Season PPG</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.starters.map((entry) => (
                  <RosterRow key={entry.player_id} entry={entry} />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState title="No projected starters" description="Projections haven't been generated for this roster yet." />
        )}
      </section>

      {roster.bench.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-muted-foreground">Bench</h2>
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/60">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Pos</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Proj. PPG</TableHead>
                  <TableHead className="text-right">Prior Season PPG</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.bench.map((entry) => (
                  <RosterRow key={entry.player_id} entry={entry} />
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {schedule.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Remaining Schedule</h2>
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Week</TableHead>
                  <TableHead>Opponent</TableHead>
                  <TableHead className="text-right">Win Prob.</TableHead>
                  <TableHead className="text-right">Proj. Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((g) => (
                  <TableRow key={g.week}>
                    <TableCell className="text-muted-foreground">{g.week}</TableCell>
                    <TableCell>
                      <TeamBadge name={g.opponent_team_name ?? `Team ${g.opponent_roster_id}`} subtitle={g.opponent_manager_name ?? undefined} size="sm" />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-sm tabular-nums",
                        g.win_probability >= 0.5 ? "text-primary" : "text-destructive"
                      )}
                    >
                      {(g.win_probability * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {fmtPoints(g.projected_points)} - {fmtPoints(g.opponent_projected_points)}
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
