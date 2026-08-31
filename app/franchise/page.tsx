import {
  getManagerByUserId,
  getAllFranchiseManagers,
  getFranchiseCareerStats,
  getFranchiseSeasons,
  getFranchiseBestPlayers,
  getFranchiseGames,
  getFranchiseHeadToHead,
} from "@/lib/queries/franchise";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { TeamBadge } from "@/components/team-badge";
import { EmptyState } from "@/components/empty-state";
import { ManagerSelect } from "@/components/manager-select";
import { FranchiseBestPlayersTable } from "@/components/franchise-best-players-table";
import { WinPctChart } from "@/components/charts/win-pct-chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtPct, fmtPoints, fmtRecord } from "@/lib/format";
import { Trophy, Target, TrendingDown, Crown, Flame, Snowflake } from "lucide-react";
import { notFound } from "next/navigation";

export const revalidate = 300;
export const metadata = { title: "Franchise" };

export default async function FranchisePage({
  searchParams,
}: {
  searchParams: Promise<{ manager?: string }>;
}) {
  const defaultUserId = process.env.SLEEPER_USER_ID;
  if (!defaultUserId) throw new Error("SLEEPER_USER_ID not configured");

  const [{ manager: managerParam }, allManagers] = await Promise.all([
    searchParams,
    getAllFranchiseManagers(),
  ]);

  const selectedId =
    managerParam && allManagers.some((m) => m.user_id === managerParam) ? managerParam : defaultUserId;

  const manager = await getManagerByUserId(selectedId);
  if (!manager) notFound();

  const [career, seasons, bestPlayers, games, headToHead] = await Promise.all([
    getFranchiseCareerStats(manager.user_id),
    getFranchiseSeasons(manager.user_id),
    getFranchiseBestPlayers(manager.user_id),
    getFranchiseGames(manager.user_id),
    getFranchiseHeadToHead(manager.user_id),
  ]);

  const decided = games.filter((g) => g.result);
  const championships = seasons.filter((s) => s.playoff_result === "champion").length;

  const winPctBySeason = seasons.map((s) => ({
    season: s.season,
    win_pct: s.wins + s.losses + s.ties > 0 ? (s.wins + s.ties * 0.5) / (s.wins + s.losses + s.ties) : 0,
    wins: s.wins,
    losses: s.losses,
  }));

  const bestGame = decided.length ? [...decided].sort((a, b) => b.points - a.points)[0] : null;
  const worstGame = decided.length ? [...decided].sort((a, b) => a.points - b.points)[0] : null;
  const biggestWin = decided.filter((g) => g.result === "W" && g.margin != null).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0))[0];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Franchise"
        title={seasons.at(-1)?.team_name ?? manager.display_name}
        description={`Managed by ${manager.display_name} · ${seasons.length} seasons in the league`}
        actions={<ManagerSelect managers={allManagers} current={manager.user_id} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="All-Time Record"
          value={career ? fmtRecord(career.wins, career.losses, career.ties) : "0-0"}
          sublabel={career ? `${fmtPct(career.wins, career.losses, career.ties)} win pct` : undefined}
          icon={Trophy}
        />
        <StatCard label="Championships" value={String(championships)} icon={Crown} accent="accent" />
        <StatCard
          label="Points For"
          value={career ? fmtPoints(Number(career.fpts_for), 0) : "0"}
          icon={Target}
        />
        <StatCard
          label="Points Against"
          value={career ? fmtPoints(Number(career.fpts_against), 0) : "0"}
          icon={TrendingDown}
        />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Win % by Season</h2>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          {winPctBySeason.length > 0 ? (
            <WinPctChart data={winPctBySeason} />
          ) : (
            <EmptyState title="No season data yet" />
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Season History</h2>
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Season</TableHead>
                <TableHead>Team Name</TableHead>
                <TableHead className="text-right">Record</TableHead>
                <TableHead className="text-right">PF</TableHead>
                <TableHead className="text-right">PA</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seasons.map((s) => (
                <TableRow key={s.league_id}>
                  <TableCell className="font-medium">{s.season}</TableCell>
                  <TableCell className="text-muted-foreground">{s.team_name ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {fmtRecord(s.wins, s.losses, s.ties)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {fmtPoints(Number(s.fpts_for))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                    {fmtPoints(Number(s.fpts_against))}
                  </TableCell>
                  <TableCell>
                    {s.playoff_result === "champion" && (
                      <Badge variant="secondary" className="gap-1 bg-accent/20 text-accent">
                        <Crown className="h-3 w-3" /> Champion
                      </Badge>
                    )}
                    {s.playoff_result === "runner_up" && <Badge variant="outline">Runner-up</Badge>}
                    {!s.playoff_result && (s.wins > 0 || s.losses > 0) && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                    {!s.playoff_result && s.wins === 0 && s.losses === 0 && (
                      <span className="text-xs text-muted-foreground">In progress</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Franchise Best Players</h2>
        <p className="-mt-2 text-sm text-muted-foreground">
          Total fantasy points scored while rostered on this franchise.
        </p>
        {bestPlayers.length > 0 ? (
          <FranchiseBestPlayersTable players={bestPlayers} />
        ) : (
          <EmptyState title="No player scoring data yet" />
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Franchise Records</h2>
          <div className="flex flex-col gap-3">
            {bestGame && (
              <FranchiseRecordCard
                icon={Flame}
                label="Best single-game score"
                value={`${fmtPoints(bestGame.points)} pts`}
                detail={`${bestGame.season} Wk ${bestGame.weekLabel} vs ${bestGame.opp_manager_name ?? "—"}`}
              />
            )}
            {worstGame && (
              <FranchiseRecordCard
                icon={Snowflake}
                label="Worst single-game score"
                value={`${fmtPoints(worstGame.points)} pts`}
                detail={`${worstGame.season} Wk ${worstGame.weekLabel} vs ${worstGame.opp_manager_name ?? "—"}`}
              />
            )}
            {biggestWin && (
              <FranchiseRecordCard
                icon={Trophy}
                label="Biggest margin of victory"
                value={`+${fmtPoints(biggestWin.margin ?? 0)} pts`}
                detail={`${biggestWin.season} Wk ${biggestWin.weekLabel} vs ${biggestWin.opp_manager_name ?? "—"}`}
              />
            )}
            {decided.length === 0 && <EmptyState title="No games played yet" />}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Head-to-Head</h2>
          {headToHead.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Opponent</TableHead>
                    <TableHead className="text-right">Record</TableHead>
                    <TableHead className="text-right">Avg Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headToHead.map((h) => (
                    <TableRow key={h.opponent_id}>
                      <TableCell>
                        <TeamBadge name={h.opponent_name} size="sm" />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {fmtRecord(h.wins, h.losses, h.ties)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm tabular-nums ${
                          h.points_for - h.points_against >= 0 ? "text-primary" : "text-destructive"
                        }`}
                      >
                        {h.points_for - h.points_against >= 0 ? "+" : ""}
                        {fmtPoints((h.points_for - h.points_against) / h.games, 1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="No head-to-head history yet" />
          )}
        </section>
      </div>
    </div>
  );
}

function FranchiseRecordCard({
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
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </div>
    </div>
  );
}
