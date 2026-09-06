import type { SupabaseClient } from "@supabase/supabase-js";
import { findPlayerArticles } from "@/lib/sentiment/exa";
import { classifyArticles } from "@/lib/sentiment/classify";
import type { NflPlayerIndexRow, PlayerSentimentSnapshot, PlayerSentimentArticle, SentimentLabel } from "@/lib/types";

// How far back a single sentiment read looks. Every computation (on-demand
// or the weekly refresh) re-reads this same trailing window, so the
// resulting score is "current sentiment as of now" rather than cumulative —
// that's what makes the week-over-week snapshots a meaningful trend line.
const WINDOW_DAYS = 14;
const POSITIVE_THRESHOLD = 0.15;
const NEGATIVE_THRESHOLD = -0.15;

export interface ComputedSentiment {
  snapshot: PlayerSentimentSnapshot;
  articles: PlayerSentimentArticle[];
}

export async function computePlayerSentiment(
  db: SupabaseClient,
  player: NflPlayerIndexRow
): Promise<ComputedSentiment> {
  const candidates = await findPlayerArticles(player, WINDOW_DAYS);
  const { assessments, overallSummary } = await classifyArticles(player, candidates);

  const relevant = assessments
    .filter((a) => a.isAboutPlayer && candidates[a.index])
    .map((a) => ({ ...a, article: candidates[a.index] }));

  const positive_count = relevant.filter((a) => a.sentiment === "positive").length;
  const neutral_count = relevant.filter((a) => a.sentiment === "neutral").length;
  const negative_count = relevant.filter((a) => a.sentiment === "negative").length;
  const score = relevant.length > 0 ? relevant.reduce((sum, a) => sum + a.sentimentScore, 0) / relevant.length : null;
  const label: SentimentLabel =
    score === null ? "no_data" : score >= POSITIVE_THRESHOLD ? "positive" : score <= NEGATIVE_THRESHOLD ? "negative" : "neutral";

  const { data: snapshotRow, error: snapshotErr } = await db
    .from("player_sentiment_snapshots")
    .insert({
      player_id: player.player_id,
      window_days: WINDOW_DAYS,
      article_count: relevant.length,
      positive_count,
      neutral_count,
      negative_count,
      score,
      label,
      summary: relevant.length > 0 ? overallSummary : "No recent coverage found that's substantively about this player.",
    })
    .select()
    .single();
  if (snapshotErr) throw new Error(`insert player_sentiment_snapshots failed: ${snapshotErr.message}`);

  let articles: PlayerSentimentArticle[] = [];
  if (relevant.length > 0) {
    const articleRows = relevant.map((a) => ({
      snapshot_id: snapshotRow.id,
      url: a.article.url,
      title: a.article.title,
      source: a.article.source,
      published_at: a.article.publishedAt,
      sentiment_label: a.sentiment,
      sentiment_score: a.sentimentScore,
      reason: a.reason,
    }));
    const { data, error } = await db.from("player_sentiment_articles").insert(articleRows).select();
    if (error) throw new Error(`insert player_sentiment_articles failed: ${error.message}`);
    articles = data as PlayerSentimentArticle[];
  }

  return { snapshot: snapshotRow as PlayerSentimentSnapshot, articles };
}
