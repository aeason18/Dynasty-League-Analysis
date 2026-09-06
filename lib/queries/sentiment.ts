import { createReadClient } from "@/lib/supabase/server";
import type { NflPlayerIndexRow, PlayerSentimentArticle, PlayerSentimentSnapshot } from "@/lib/types";

export async function searchNflPlayers(q: string): Promise<NflPlayerIndexRow[]> {
  if (!q.trim()) return [];
  const db = createReadClient();
  const { data, error } = await db
    .from("nfl_player_index")
    .select("player_id, full_name, position, team")
    .ilike("full_name", `%${q.trim()}%`)
    .order("full_name")
    .limit(15);
  if (error) throw error;
  return (data ?? []) as NflPlayerIndexRow[];
}

export async function getNflPlayer(playerId: string): Promise<NflPlayerIndexRow | null> {
  const db = createReadClient();
  const { data, error } = await db
    .from("nfl_player_index")
    .select("player_id, full_name, position, team")
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw error;
  return data as NflPlayerIndexRow | null;
}

export async function getSentimentHistory(playerId: string): Promise<PlayerSentimentSnapshot[]> {
  const db = createReadClient();
  const { data, error } = await db
    .from("player_sentiment_snapshots")
    .select("*")
    .eq("player_id", playerId)
    .order("computed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlayerSentimentSnapshot[];
}

export interface LatestSentiment {
  snapshot: PlayerSentimentSnapshot | null;
  articles: PlayerSentimentArticle[];
}

export async function getLatestSentiment(playerId: string): Promise<LatestSentiment> {
  const db = createReadClient();
  const { data: snapshot, error: snapshotErr } = await db
    .from("player_sentiment_snapshots")
    .select("*")
    .eq("player_id", playerId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapshotErr) throw snapshotErr;
  if (!snapshot) return { snapshot: null, articles: [] };

  const { data: articles, error: articlesErr } = await db
    .from("player_sentiment_articles")
    .select("*")
    .eq("snapshot_id", (snapshot as PlayerSentimentSnapshot).id)
    .order("sentiment_score", { ascending: false });
  if (articlesErr) throw articlesErr;

  return { snapshot: snapshot as PlayerSentimentSnapshot, articles: (articles ?? []) as PlayerSentimentArticle[] };
}
