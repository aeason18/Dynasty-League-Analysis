import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Gauge, Newspaper, Smile, Frown, Meh } from "lucide-react";
import { getNflPlayer, getSentimentHistory, getLatestSentiment } from "@/lib/queries/sentiment";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { SentimentAnalyzeButton } from "@/components/sentiment-analyze-button";
import { SentimentTrendChart } from "@/components/charts/sentiment-trend-chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SentimentLabel } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const player = await getNflPlayer(playerId);
  return { title: player ? `${player.full_name} Sentiment` : "Sentiment" };
}

const LABEL_COPY: Record<SentimentLabel, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  no_data: "No data yet",
};

function labelColor(label: SentimentLabel) {
  if (label === "positive") return "text-primary";
  if (label === "negative") return "text-destructive";
  return "text-muted-foreground";
}

export default async function SentimentDetailPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const player = await getNflPlayer(playerId);
  if (!player) notFound();

  const [history, latest] = await Promise.all([getSentimentHistory(playerId), getLatestSentiment(playerId)]);
  const { snapshot, articles } = latest;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/sentiment"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Sentiment
        </Link>
        <PageHeader
          eyebrow="Sentiment"
          title={player.full_name}
          description={[player.position, player.team ?? "Free agent"].join(" · ")}
          actions={
            <SentimentAnalyzeButton
              playerId={playerId}
              label={snapshot ? "Refresh analysis" : "Analyze sentiment"}
            />
          }
        />
      </div>

      {!snapshot ? (
        <EmptyState
          icon={Newspaper}
          title="No sentiment analysis yet"
          description="Click Analyze sentiment to pull recent news coverage and score it. This usually takes a few seconds."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Sentiment"
              value={LABEL_COPY[snapshot.label]}
              sublabel={snapshot.score !== null ? `score ${snapshot.score.toFixed(2)}` : undefined}
              icon={snapshot.label === "positive" ? Smile : snapshot.label === "negative" ? Frown : Meh}
              accent={snapshot.label === "positive" ? "primary" : "neutral"}
              className={cn(snapshot.label === "negative" && "border-destructive/30")}
            />
            <StatCard label="Articles Analyzed" value={String(snapshot.article_count)} icon={Newspaper} />
            <StatCard
              label="Coverage Window"
              value={`${snapshot.window_days}d`}
              sublabel="trailing, refreshed weekly"
              icon={Gauge}
            />
            <StatCard
              label="Last Updated"
              value={new Date(snapshot.computed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              sublabel={new Date(snapshot.computed_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              icon={Newspaper}
              accent="neutral"
            />
          </div>

          {snapshot.summary && (
            <p className={cn("text-sm leading-relaxed", labelColor(snapshot.label))}>{snapshot.summary}</p>
          )}

          {history.filter((s) => s.score !== null).length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="font-heading text-lg font-semibold tracking-tight">Sentiment Over Time</h2>
              <div className="rounded-2xl border border-border/60 bg-card p-4">
                <SentimentTrendChart data={history} />
              </div>
            </section>
          )}

          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-lg font-semibold tracking-tight">Recent Coverage</h2>
            {articles.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Article</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead className="text-right">Sentiment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {articles.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="max-w-sm align-top whitespace-normal">
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="font-medium hover:text-primary"
                          >
                            {a.title}
                          </a>
                          {a.reason && <p className="mt-0.5 text-xs text-muted-foreground">{a.reason}</p>}
                        </TableCell>
                        <TableCell className="align-top text-muted-foreground">{a.source ?? "—"}</TableCell>
                        <TableCell className="align-top text-muted-foreground">
                          {a.published_at ? new Date(a.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <Badge
                            variant={a.sentiment_label === "positive" ? "default" : "outline"}
                            className={cn(
                              "text-[10px]",
                              a.sentiment_label === "negative" && "border-destructive/40 text-destructive"
                            )}
                          >
                            {a.sentiment_label} {a.sentiment_score.toFixed(2)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                title="No qualifying coverage found"
                description="Recent articles either didn't substantively feature this player or weren't football-related enough to score."
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
