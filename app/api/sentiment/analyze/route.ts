import { NextResponse } from "next/server";
import { createReadClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computePlayerSentiment } from "@/lib/sentiment/compute";
import { isGatewayRateLimitError } from "@/lib/sentiment/classify";
import type { NflPlayerIndexRow, PlayerSentimentSnapshot } from "@/lib/types";

// This is the one place in app/ that writes to Supabase with the
// service-role key — every other write happens in scripts/ run from
// GitHub Actions (see lib/supabase/admin.ts). It's a deliberate, narrow
// exception so a player with no sentiment history yet can be analyzed the
// first time someone searches for them, instead of waiting for the next
// weekly sync. The two guards below are what make that safe to expose
// publicly: player_id must resolve to a real entry in nfl_player_index (so
// this can never run Exa/LLM calls against arbitrary text), and both a
// per-player cooldown and a global hourly cap bound how often it can fire.
const GLOBAL_HOURLY_CAP = 20;
const PER_PLAYER_COOLDOWN_MINUTES = 30;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const playerId = typeof (body as { playerId?: unknown })?.playerId === "string" ? (body as { playerId: string }).playerId : null;
  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  const readDb = createReadClient();

  const { data: player, error: playerErr } = await readDb
    .from("nfl_player_index")
    .select("player_id, full_name, position, team")
    .eq("player_id", playerId)
    .maybeSingle();
  if (playerErr) return NextResponse.json({ error: playerErr.message }, { status: 500 });
  if (!player) return NextResponse.json({ error: "Unknown player" }, { status: 404 });

  const { data: existing, error: existingErr } = await readDb
    .from("player_sentiment_snapshots")
    .select("*")
    .eq("player_id", playerId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });

  if (existing) {
    const snapshot = existing as PlayerSentimentSnapshot;
    const ageMinutes = (Date.now() - new Date(snapshot.computed_at).getTime()) / 60_000;
    if (ageMinutes < PER_PLAYER_COOLDOWN_MINUTES) {
      const { data: articles } = await readDb.from("player_sentiment_articles").select("*").eq("snapshot_id", snapshot.id);
      return NextResponse.json({ snapshot, articles: articles ?? [], cached: true });
    }
  }

  const { count, error: countErr } = await readDb
    .from("player_sentiment_snapshots")
    .select("id", { count: "exact", head: true })
    .gte("computed_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) >= GLOBAL_HOURLY_CAP) {
    return NextResponse.json({ error: "Too many sentiment analyses right now — try again in a bit." }, { status: 429 });
  }

  const adminDb = createAdminClient();
  try {
    const { snapshot, articles } = await computePlayerSentiment(adminDb, player as NflPlayerIndexRow);
    return NextResponse.json({ snapshot, articles, cached: false });
  } catch (err) {
    if (isGatewayRateLimitError(err)) {
      return NextResponse.json(
        { error: "We've hit our news-analysis limit for now — please try again later." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sentiment analysis failed" }, { status: 500 });
  }
}
