"use server";

import { createReadClient } from "@/lib/supabase/server";
import { sleeper } from "@/lib/sleeper/client";
import { resolveLeagueGroupId } from "@/lib/queries/leagues";

const GITHUB_OWNER = "aeason18";
const GITHUB_REPO = "Dynasty-League-Analysis";

async function currentLeagueIdForGroup(leagueGroupId: string, fallback: string): Promise<string> {
  const db = createReadClient();
  const { data } = await db
    .from("leagues")
    .select("league_id")
    .eq("league_group_id", leagueGroupId)
    .eq("is_current", true)
    .maybeSingle();
  return data?.league_id ?? fallback;
}

export type OnboardResult =
  | { status: "known"; redirectTo: string }
  | { status: "started" }
  | { status: "invalid"; error: string };

/**
 * Entry point for the onboarding form. Fast path: a league_id we've already
 * ingested (whether onboarded by this visitor or anyone else) resolves and
 * redirects immediately with no ingestion — a plain Supabase read, same
 * cost as viewing any other page. Only a genuinely new league triggers the
 * GitHub Actions sync workflow.
 */
export async function startOnboarding(leagueIdRaw: string): Promise<OnboardResult> {
  const leagueId = leagueIdRaw.trim();
  if (!/^\d{5,25}$/.test(leagueId)) {
    return { status: "invalid", error: "That doesn't look like a Sleeper league ID — it should be a long number." };
  }

  const leagueGroupId = await resolveLeagueGroupId(leagueId);
  if (leagueGroupId) {
    return { status: "known", redirectTo: `/${await currentLeagueIdForGroup(leagueGroupId, leagueId)}` };
  }

  // Fail fast on typos/garbage before spending a workflow run on them.
  try {
    await sleeper.getLeague(leagueId);
  } catch {
    return { status: "invalid", error: "We couldn't find a Sleeper league with that ID. Double-check it and try again." };
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return { status: "invalid", error: "New-league setup isn't configured on this deployment yet." };
  }

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/sync.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { league_id: leagueId } }),
    }
  );
  if (!res.ok) {
    return { status: "invalid", error: "Couldn't start setup for that league right now — try again in a bit." };
  }

  return { status: "started" };
}

/**
 * Polled by /importing/<leagueId> every few seconds. Returns the URL to
 * redirect to once ingestion has landed a row for this exact league_id, or
 * null while still waiting.
 */
export async function checkLeagueReady(leagueId: string): Promise<string | null> {
  const leagueGroupId = await resolveLeagueGroupId(leagueId);
  if (!leagueGroupId) return null;
  return `/${await currentLeagueIdForGroup(leagueGroupId, leagueId)}`;
}
