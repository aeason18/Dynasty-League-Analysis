import { getTrades, getTradeLeaderboard, getMostLopsidedTrades } from "@/lib/queries/trades";
import { getLeagues } from "@/lib/queries/leagues";
import { getAllFranchiseManagers } from "@/lib/queries/franchise";
import { PageHeader } from "@/components/page-header";
import { SeasonSelect } from "@/components/season-select";
import { ManagerSelect } from "@/components/manager-select";
import { TradeCard } from "@/components/trade-card";
import { TeamBadge } from "@/components/team-badge";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtNumber } from "@/lib/format";
import { ArrowRightLeft, Info } from "lucide-react";

export const revalidate = 300;
export const metadata = { title: "Trades" };

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; manager?: string }>;
}) {
  const { season: seasonParam, manager: managerParam } = await searchParams;
  const [trades, leaderboard, leagues, managers] = await Promise.all([
    getTrades(),
    getTradeLeaderboard(),
    getLeagues(),
    getAllFranchiseManagers(),
  ]);

  const seasons = ["All", ...leagues.map((l) => l.season)];
  const selectedSeason = seasonParam && seasons.includes(seasonParam) ? seasonParam : "All";

  const selectedManager =
    managerParam && managers.some((m) => m.user_id === managerParam) ? managerParam : "All";
  const selectedManagerName = managers.find((m) => m.user_id === selectedManager)?.display_name;

  const filtered = trades
    .filter((t) => selectedSeason === "All" || t.season === selectedSeason)
    .filter((t) => selectedManager === "All" || t.sides.some((s) => s.manager_id === selectedManager));

  const mostLopsided = getMostLopsidedTrades(filtered, 5);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Trades"
        title="Trade Value"
        description="Every trade in league history, valued with FantasyCalc dynasty market values. A traded pick that has since been used in a draft shows the actual player it became."
        actions={
          <>
            <ManagerSelect
              managers={managers}
              current={selectedManager}
              allLabel="All Managers"
              placeholder="All Managers"
            />
            <SeasonSelect seasons={seasons} current={selectedSeason} allLabel="All Seasons" />
          </>
        }
      />

      <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
        <span>
          Values reflect today&apos;s FantasyCalc dynasty market, not the value at the time each trade was made — a
          player who has since broken out or declined will look different in hindsight than they did on trade day.
          Unresolved future picks are valued at FantasyCalc&apos;s round estimate since no player has been drafted yet.
        </span>
      </div>

      {leaderboard.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Trade Value Leaderboard</h2>
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead className="text-right">Trades</TableHead>
                  <TableHead className="text-right">Net Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((row, i) => (
                  <TableRow key={row.manager_id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <TeamBadge name={row.manager_name} avatar={row.avatar} size="sm" />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {row.trades}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm font-semibold tabular-nums ${
                        row.netValue >= 0 ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {row.netValue >= 0 ? "+" : ""}
                      {fmtNumber(row.netValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Net value = value received minus value given up, per trade, summed across every trade a manager has
            made. Self-relative to each side — not split against the other side(s) of the deal, so a smaller piece
            of a multi-team trade isn&apos;t penalized just for being smaller.
          </p>
        </section>
      )}

      {mostLopsided.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Most Lopsided Trades</h2>
          <p className="-mt-2 text-sm text-muted-foreground">
            The biggest net-value gap between sides, by today&apos;s market — where one side ended up clearly ahead of
            what they put in relative to the other side(s).
          </p>
          <div className="flex flex-col gap-4">
            {mostLopsided.map((trade) => (
              <TradeCard key={trade.transaction_id} trade={trade} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          {selectedManagerName ? `${selectedManagerName}'s Trades` : "All Trades"}
          {selectedSeason !== "All" ? ` · ${selectedSeason}` : ""}
        </h2>
        {filtered.length > 0 ? (
          <div className="flex flex-col gap-4">
            {filtered.map((trade) => (
              <TradeCard key={trade.transaction_id} trade={trade} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ArrowRightLeft}
            title="No trades found"
            description="No trades match the current filters."
          />
        )}
      </section>
    </div>
  );
}
