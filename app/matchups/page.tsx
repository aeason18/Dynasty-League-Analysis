import { getLeagues } from "@/lib/queries/leagues";
import { getSeasonMatchups, getHeadToHead, listManagersWithGames } from "@/lib/queries/matchups";
import { getLeagueOverview } from "@/lib/queries/dashboard";
import { PageHeader } from "@/components/page-header";
import { SeasonSelect } from "@/components/season-select";
import { MatchupRow } from "@/components/matchup-row";
import { HeadToHeadSelect } from "@/components/head-to-head-select";
import { EmptyState } from "@/components/empty-state";
import { fmtPoints } from "@/lib/format";
import { Swords } from "lucide-react";

export const revalidate = 300;
export const metadata = { title: "Matchups" };

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; managerA?: string; managerB?: string }>;
}) {
  const { season: seasonParam, managerA, managerB } = await searchParams;
  const [leagues, overview, managers] = await Promise.all([
    getLeagues(),
    getLeagueOverview(),
    listManagersWithGames(),
  ]);

  const seasons = leagues.map((l) => l.season);
  const selectedSeason = seasonParam && seasons.includes(seasonParam) ? seasonParam : overview.currentSeason ?? seasons.at(-1)!;
  const matchups = await getSeasonMatchups(selectedSeason);

  const byWeek = new Map<number, typeof matchups>();
  for (const m of matchups) {
    const list = byWeek.get(m.week) ?? [];
    list.push(m);
    byWeek.set(m.week, list);
  }
  const weeks = Array.from(byWeek.keys()).sort((a, b) => a - b);

  const resolvedA = managerA ?? managers[0]?.id;
  const resolvedB = managerB ?? managers[1]?.id;
  const h2h = resolvedA && resolvedB && resolvedA !== resolvedB ? await getHeadToHead(resolvedA, resolvedB) : null;
  const nameA = managers.find((m) => m.id === resolvedA)?.name;
  const nameB = managers.find((m) => m.id === resolvedB)?.name;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Matchups"
        title="Season Matchups"
        description="Every scored matchup in league history, week by week."
        actions={<SeasonSelect seasons={seasons} current={selectedSeason} />}
      />

      {weeks.length > 0 ? (
        <div className="flex flex-col gap-6">
          {weeks.map((week) => (
            <div key={week} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Week {week}
                {byWeek.get(week)?.[0]?.is_playoff ? " · Playoffs" : ""}
              </h3>
              <div className="flex flex-col gap-2">
                {byWeek.get(week)!.map((g) => (
                  <MatchupRow key={`${g.league_id}-${g.week}-${g.matchup_id}`} game={g} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Swords}
          title={`No matchups played yet in ${selectedSeason}`}
          description="Check back once the season kicks off."
        />
      )}

      <section className="flex flex-col gap-4 border-t border-border/60 pt-8">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Head-to-Head Explorer</h2>
        <HeadToHeadSelect managers={managers} managerA={resolvedA} managerB={resolvedB} />

        {h2h ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex items-center justify-center gap-6 text-center">
              <div>
                <p className="text-2xl font-semibold tabular-nums">{h2h.a_wins}</p>
                <p className="text-xs text-muted-foreground">{nameA}</p>
              </div>
              <span className="text-muted-foreground">vs</span>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{h2h.b_wins}</p>
                <p className="text-xs text-muted-foreground">{nameB}</p>
              </div>
              {h2h.ties > 0 && (
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{h2h.ties}</p>
                  <p className="text-xs text-muted-foreground">Ties</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {h2h.games.map((g, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {g.season} · Wk {g.week}
                  </span>
                  <span className="font-mono tabular-nums">
                    {fmtPoints(g.a_points)} – {fmtPoints(g.b_points)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title="No head-to-head history" description="These two managers haven't played each other yet." />
        )}
      </section>
    </div>
  );
}
