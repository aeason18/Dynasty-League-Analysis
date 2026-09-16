import { resolveLeagueGroupId } from "@/lib/queries/leagues";
import { getPowerRankings } from "@/lib/queries/rankings";
import { PageHeader } from "@/components/page-header";
import { PowerRankingsTable } from "@/components/power-rankings-table";
import { EmptyState } from "@/components/empty-state";
import { Trophy } from "lucide-react";

export const revalidate = 300;
export const metadata = { title: "Rankings" };

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
          <p className="-mb-4 text-xs text-muted-foreground">Click a team to see its full value breakdown.</p>
          <PowerRankingsTable rankings={rankings} />

          <p className="text-xs text-muted-foreground">
            Star Power = top 3-4 players by dynasty market value, heavily weighted (~45%). Starters = the players filling
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
