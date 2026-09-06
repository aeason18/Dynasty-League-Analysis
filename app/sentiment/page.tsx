import Link from "next/link";
import { Newspaper, Search } from "lucide-react";
import { searchNflPlayers } from "@/lib/queries/sentiment";
import { PageHeader } from "@/components/page-header";
import { SentimentSearch } from "@/components/sentiment-search";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Sentiment" };

export default async function SentimentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = q.trim() ? await searchNflPlayers(q) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Sentiment"
        title="Player Sentiment"
        description="Search any active NFL player to see how recent football news is trending for them — pulled from real news coverage and scored for tone, not just mention count."
      />

      <SentimentSearch initialSearch={q} />

      {q.trim() && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((p) => (
            <Link
              key={p.player_id}
              href={`/sentiment/${p.player_id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 transition-colors hover:border-border hover:bg-white/5"
            >
              <span className="font-medium text-foreground">{p.full_name}</span>
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="text-muted-foreground">
                  {p.position}
                </Badge>
                <span className="text-sm text-muted-foreground">{p.team ?? "FA"}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {q.trim() && results.length === 0 && (
        <EmptyState
          icon={Search}
          title="No matching player"
          description="Only active NFL skill-position players (QB/RB/WR/TE/K) can be searched here."
        />
      )}

      {!q.trim() && (
        <EmptyState
          icon={Newspaper}
          title="Search for a player"
          description="Type a name above to see their current sentiment score, based on recent football news coverage."
        />
      )}
    </div>
  );
}
