import { getLeagues } from "@/lib/queries/leagues";
import { getStandingsForSeason } from "@/lib/queries/standings";
import { getLeagueOverview, getScoringTrends } from "@/lib/queries/dashboard";
import { getLeagueRecords } from "@/lib/queries/records";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StandingsTable } from "@/components/standings-table";
import { SeasonSelect } from "@/components/season-select";
import { ScoringTrendChart } from "@/components/charts/scoring-trend-chart";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNumber, fmtPoints } from "@/lib/format";
import { Trophy, Users, Swords, TrendingUp, Flame, Zap } from "lucide-react";
import Link from "next/link";

export const revalidate = 300;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ season: seasonParam }, leagues, overview, trends, records] = await Promise.all([
    searchParams,
    getLeagues(),
    getLeagueOverview(),
    getScoringTrends(),
    getLeagueRecords(),
  ]);

  const seasons = leagues.map((l) => l.season);
  const selectedSeason = seasonParam && seasons.includes(seasonParam) ? seasonParam : overview.currentSeason ?? seasons.at(-1)!;
  const league = leagues.find((l) => l.season === selectedSeason)!;
  const standings = await getStandingsForSeason(league.league_id);
  const seasonHasGames = standings.some((r) => r.wins + r.losses + r.ties > 0);

  const topScore = records.highestScores[0];
  const topBlowout = records.biggestBlowouts[0];
  const topPerformance = records.bestPerformances[0];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="League Overview"
        title={league.name}
        description={`Dynasty league history since ${seasons[0]}. ${overview.seasons} seasons tracked, ${overview.managers} managers, ${fmtNumber(overview.totalGames)} games played.`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Seasons Tracked" value={String(overview.seasons)} icon={Trophy} />
        <StatCard label="Managers" value={String(overview.managers)} icon={Users} />
        <StatCard label="Games Played" value={fmtNumber(overview.totalGames)} icon={Swords} />
        <StatCard
          label="Avg Points / Game"
          value={fmtPoints(overview.avgPointsPerGame, 1)}
          icon={TrendingUp}
          accent="accent"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-border/60 bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Scoring Trends by Season</CardTitle>
          </CardHeader>
          <CardContent>
            {trends.length > 0 ? (
              <ScoringTrendChart data={trends} />
            ) : (
              <EmptyState icon={TrendingUp} title="No scoring data yet" description="Trends will appear once games have been played." />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold">League Records at a Glance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {topScore && (
              <RecordRow
                icon={Flame}
                label="Highest single-game score"
                value={`${fmtPoints(topScore.points)} pts`}
                detail={`${topScore.team_name ?? topScore.manager_name} · ${topScore.season} Wk ${topScore.week}`}
              />
            )}
            {topBlowout && (
              <RecordRow
                icon={Zap}
                label="Biggest blowout"
                value={`+${fmtPoints(Math.abs(topBlowout.margin ?? 0))} pts`}
                detail={`${topBlowout.team_name ?? topBlowout.manager_name} · ${topBlowout.season} Wk ${topBlowout.week}`}
              />
            )}
            {topPerformance && (
              <RecordRow
                icon={Trophy}
                label="Best player performance"
                value={`${fmtPoints(topPerformance.points)} pts`}
                detail={`${topPerformance.player_name} · ${topPerformance.season} Wk ${topPerformance.week}`}
              />
            )}
            <Link
              href="/records"
              className="mt-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              View all league records →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Standings</h2>
          <SeasonSelect seasons={seasons} current={selectedSeason} />
        </div>
        {standings.length > 0 ? (
          <>
            <StandingsTable rows={standings} />
            {!seasonHasGames && (
              <p className="text-xs text-muted-foreground">
                The {selectedSeason} season hasn&apos;t started yet — standings will update once games are played.
              </p>
            )}
          </>
        ) : (
          <EmptyState icon={Swords} title="No standings available" description="This season has no roster data." />
        )}
      </div>
    </div>
  );
}

function RecordRow({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </div>
    </div>
  );
}
