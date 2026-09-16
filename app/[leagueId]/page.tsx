import { getLeagues, resolveLeagueGroupId } from "@/lib/queries/leagues";
import { getStandingsForSeason } from "@/lib/queries/standings";
import { getLeagueOverview, getScoringTrends } from "@/lib/queries/dashboard";
import { getLeagueRecords } from "@/lib/queries/records";
import { CornerFrame } from "@/components/corner-frame";
import { SeasonSelect } from "@/components/season-select";
import { ScoringTrendChart } from "@/components/charts/scoring-trend-chart";
import { EmptyState } from "@/components/empty-state";
import { CrystalHero } from "@/components/three/crystal-hero";
import { FragmentSpray } from "@/components/three/fragment-spray";
import { fmtNumber, fmtPoints } from "@/lib/format";
import { TrendingUp, Swords } from "lucide-react";
import Link from "next/link";

export const revalidate = 300;

const ATMOSPHERE_BACKGROUND = [
  "radial-gradient(ellipse 900px 620px at 12% -8%, oklch(1 0 0 / 6%), transparent 62%)",
  "radial-gradient(ellipse 820px 700px at 96% 22%, oklch(1 0 0 / 4%), transparent 65%)",
  "radial-gradient(ellipse 1000px 800px at 45% 115%, oklch(1 0 0 / 4%), transparent 60%)",
].join(", ");

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { leagueId } = await params;
  const leagueGroupId = (await resolveLeagueGroupId(leagueId))!;
  const [{ season: seasonParam }, leagues, overview, trends, records] = await Promise.all([
    searchParams,
    getLeagues(leagueGroupId),
    getLeagueOverview(leagueGroupId),
    getScoringTrends(leagueGroupId),
    getLeagueRecords(leagueGroupId),
  ]);

  const seasons = leagues.map((l) => l.season);
  const selectedSeason = seasonParam && seasons.includes(seasonParam) ? seasonParam : overview.currentSeason ?? seasons.at(-1)!;
  const league = leagues.find((l) => l.season === selectedSeason)!;
  const standings = await getStandingsForSeason(league.league_id);
  const seasonHasGames = standings.some((r) => r.wins + r.losses + r.ties > 0);
  const isCurrentSeason = selectedSeason === overview.currentSeason;

  const topScore = records.highestScores[0];
  const topBlowout = records.biggestBlowouts[0];
  const topPerformance = records.bestPerformances[0];

  return (
    <div
      className="relative flex w-full overflow-x-hidden"
      style={{ backgroundImage: ATMOSPHERE_BACKGROUND }}
    >
      {/* MAIN COLUMN */}
      <div className="min-w-0 flex-1">
        {/* HERO */}
        <div className="relative px-6 pb-[70px] pt-16 sm:px-8">
          <div className="pointer-events-none absolute -right-8 top-0 -z-10 h-[300px] w-[300px] sm:-right-16 sm:h-[650px] sm:w-[650px] md:h-[750px] md:w-[750px] lg:h-[1000px] lg:w-[1000px]">
            <CrystalHero />
          </div>

          <div className="relative z-10">
            <div className="ml-1 font-mono text-xs tracking-[0.14em] text-primary">
              {`DYNASTY ARCHIVE // EST. ${seasons[0]}`}
            </div>
            <h1 className="mt-[18px] max-w-3xl font-heading text-[64px] font-black uppercase leading-[0.86] tracking-tight text-foreground sm:text-[100px] lg:text-[148px]">
              {league.name}
            </h1>
            <div className="ml-1 mt-8 max-w-[460px]">
              <p className="font-mono text-[13px] uppercase leading-[1.75] tracking-[0.015em] text-muted-foreground">
                Dynasty league history since {seasons[0]}. {overview.seasons} seasons tracked, {overview.managers}{" "}
                managers, {fmtNumber(overview.totalGames)} games played.
              </p>
            </div>
          </div>

          {isCurrentSeason && (
            <div className="absolute -bottom-[22px] left-0 z-10 bg-pop px-[26px] py-3.5 text-[13px] font-bold tracking-[0.06em] text-background">
              SEASON {selectedSeason} &middot; {seasonHasGames ? "IN PROGRESS" : "NOT STARTED"}
            </div>
          )}
        </div>

        {/* TELEMETRY STRIP */}
        <div className="mt-24 px-6 sm:px-8">
          <div className="relative border border-foreground/[0.14] bg-foreground/[0.03]">
            <CornerFrame />
            <div className="grid grid-cols-2 sm:grid-cols-4">
              <div className="border-b border-r border-foreground/10 p-7 sm:border-b-0">
                <div className="font-mono text-[clamp(20px,4.2vw,38px)] font-semibold">{pad2(overview.seasons)}</div>
                <div className="mt-2 font-mono text-[11px] tracking-[0.1em] text-foreground">SEASONS</div>
              </div>
              <div className="border-b border-foreground/10 p-7 sm:border-b-0 sm:border-r">
                <div className="font-mono text-[clamp(20px,4.2vw,38px)] font-semibold">{pad2(overview.managers)}</div>
                <div className="mt-2 font-mono text-[11px] tracking-[0.1em] text-foreground">MANAGERS</div>
              </div>
              <div className="border-r border-foreground/10 p-7">
                <div className="font-mono text-[clamp(20px,4.2vw,38px)] font-semibold">{fmtNumber(overview.totalGames)}</div>
                <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] tracking-[0.1em] text-foreground">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-pop" aria-hidden />
                  GAMES PLAYED
                </div>
              </div>
              <div className="bg-primary p-7 text-primary-foreground">
                <div className="font-mono text-[clamp(20px,4.2vw,38px)] font-bold">{fmtPoints(overview.avgPointsPerGame, 1)}</div>
                <div className="mt-2 font-mono text-[11px] tracking-[0.1em]">AVG PTS / GAME</div>
              </div>
            </div>
          </div>
        </div>

        {/* RECORD LOG */}
        <div className="relative mt-[88px] px-6 sm:px-8">
          <div className="absolute -top-[26px] right-6 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground sm:right-8">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pop" aria-hidden />
            {`LOG.${pad2(overview.seasons)} // SYNCED`}
          </div>
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-[34px] font-extrabold uppercase tracking-tight">Record Log</h2>
            <Link
              href={`/${leagueId}/records`}
              className="flex items-center gap-2 font-mono text-xs tracking-[0.06em] text-primary transition-opacity hover:opacity-70"
            >
              <span className="h-1.5 w-1.5 shrink-0 bg-primary" aria-hidden />
              VIEW FULL LOG
            </Link>
          </div>

          <div className="mt-6 border border-foreground/10 bg-foreground/[0.02] p-4">
            <div className="mb-2 font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
              SCORING TRENDS BY SEASON
            </div>
            {trends.length > 0 ? (
              <ScoringTrendChart data={trends} />
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No scoring data yet"
                description="Trends will appear once games have been played."
              />
            )}
          </div>

          <div className="mt-[26px] grid grid-cols-1 gap-[18px] lg:grid-cols-[1.3fr_1fr]">
            {topScore && (
              <div className="relative border border-foreground/[0.14] bg-foreground/[0.03] p-10">
                <CornerFrame />
                <div className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-pop" aria-hidden />
                  HIGHEST SINGLE-GAME SCORE
                </div>
                <div className="mt-3.5 font-mono text-[clamp(40px,15vw,80px)] font-bold leading-none text-primary sm:text-[110px]">
                  {fmtPoints(topScore.points)}
                </div>
                <div className="mt-[18px] flex items-baseline gap-3">
                  <span className="text-base font-semibold">{topScore.team_name ?? topScore.manager_name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {topScore.season} &middot; WK {topScore.weekLabel}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-[18px]">
              {topBlowout && (
                <div className="flex-1 border border-foreground/10 p-6">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-pop" aria-hidden />
                    BIGGEST BLOWOUT
                  </div>
                  <div className="mt-2.5 font-mono text-[42px] font-semibold">
                    +{fmtPoints(Math.abs(topBlowout.margin ?? 0))}
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2.5">
                    <span className="text-[13px] font-semibold">{topBlowout.team_name ?? topBlowout.manager_name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {topBlowout.season} &middot; WK {topBlowout.weekLabel}
                    </span>
                  </div>
                </div>
              )}
              {topPerformance && (
                <div className="flex-1 border border-foreground/10 p-6">
                  <div className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
                    BEST PLAYER PERFORMANCE
                  </div>
                  <div className="mt-2.5 font-mono text-[42px] font-semibold">{fmtPoints(topPerformance.points)}</div>
                  <div className="mt-2.5 flex items-baseline gap-2.5">
                    <span className="text-[13px] font-semibold">{topPerformance.player_name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {topPerformance.season} &middot; WK {topPerformance.week}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STANDINGS */}
        <div className="relative mt-[84px] px-6 pb-[88px] sm:px-8">
          <div className="relative flex h-32 items-end overflow-hidden sm:h-40 lg:h-56">
            <FragmentSpray />
            <div className="relative z-10 flex w-full items-baseline justify-between pb-2">
              <h2 className="font-heading text-[34px] font-extrabold uppercase tracking-tight">
                Standings{" "}
                <span className="font-sans text-xl font-normal normal-case text-muted-foreground">
                  &mdash; {selectedSeason}
                </span>
              </h2>
              <SeasonSelect seasons={seasons} current={selectedSeason} />
            </div>
          </div>

          {standings.length > 0 ? (
            <>
              <div className="relative z-10 mt-[22px]">
                <div className="grid grid-cols-[24px_1fr_54px_54px_54px] gap-x-2 border-b border-foreground/[0.16] px-1.5 py-3 font-mono text-[11px] tracking-[0.1em] text-muted-foreground sm:grid-cols-[40px_1fr_92px_92px_92px] sm:gap-x-0">
                  <div>#</div>
                  <div>TEAM</div>
                  <div className="text-right">W-L-T</div>
                  <div className="text-right">PF</div>
                  <div className="text-right">PA</div>
                </div>
                {standings.map((row, i) => (
                  <div
                    key={`${row.league_id}-${row.roster_id}`}
                    className="grid grid-cols-[24px_1fr_54px_54px_54px] items-center gap-x-2 border-b border-foreground/10 px-1.5 py-3.5 sm:grid-cols-[40px_1fr_92px_92px_92px] sm:gap-x-0"
                  >
                    <div className="flex items-center gap-1.5 font-mono text-sm text-primary">
                      {i === 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pop" aria-hidden />}
                      {row.rank}
                    </div>
                    <div className="text-sm font-medium">
                      {row.team_name ?? row.manager?.display_name ?? `Team ${row.roster_id}`}
                    </div>
                    <div className="text-right font-mono text-[13px] tabular-nums">
                      {row.wins}-{row.losses}
                      {row.ties ? `-${row.ties}` : ""}
                    </div>
                    <div className="text-right font-mono text-[13px] tabular-nums">{fmtPoints(Number(row.fpts_for))}</div>
                    <div className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                      {fmtPoints(Number(row.fpts_against))}
                    </div>
                  </div>
                ))}
              </div>
              {!seasonHasGames && (
                <p className="relative z-10 mt-3 text-xs text-muted-foreground">
                  The {selectedSeason} season hasn&apos;t started yet — standings will update once games are played.
                </p>
              )}
            </>
          ) : (
            <div className="relative z-10">
              <EmptyState icon={Swords} title="No standings available" description="This season has no roster data." />
            </div>
          )}
        </div>
      </div>

      {/* RIGHT RAIL */}
      <div className="hidden w-16 shrink-0 flex-col items-center justify-between border-l border-foreground/10 bg-secondary py-6 lg:flex">
        <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-pop" aria-hidden />
        <div className="flex flex-col items-center gap-[22px]">
          <span
            className="font-mono text-[13px] font-semibold tracking-[0.32em] text-foreground/65"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            ARCHIVE
          </span>
          <div className="flex flex-col items-center gap-2.5 font-mono text-[11px] text-foreground/85">
            <span className="text-pop">{pad2(overview.seasons)}</span>
            <span>{pad2(overview.managers)}</span>
            <span>{fmtNumber(overview.totalGames)}</span>
          </div>
        </div>
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full border border-foreground/25"
          style={{ borderTopColor: "var(--color-primary)" }}
          aria-hidden
        />
      </div>
    </div>
  );
}
