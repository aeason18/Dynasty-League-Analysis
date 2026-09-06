import { generateText, Output, RetryError } from "ai";
import { GatewayRateLimitError } from "@ai-sdk/gateway";
import { z } from "zod";
import type { NflPlayerIndexRow } from "@/lib/types";
import type { CandidateArticle } from "@/lib/sentiment/exa";

// A free-tier (not topped-up) AI Gateway account is rate-limited independently
// of its credit balance — used to give callers a clear "try again later"
// instead of a raw 500 when that happens.
export function isGatewayRateLimitError(err: unknown): boolean {
  if (GatewayRateLimitError.isInstance(err)) return true;
  if (RetryError.isInstance(err)) return err.errors.some((e) => GatewayRateLimitError.isInstance(e));
  return false;
}

// Free-tier accessible on Vercel AI Gateway without topping up (claude-haiku-4.5
// requires a funded account). Cheap and plenty capable for this classification
// task; bump to a newer model here if the account is later topped up.
const MODEL = "openai/gpt-4o-mini";

const AssessmentSchema = z.object({
  index: z.number().int().describe("0-based index of the article this assessment is for, matching the input list order"),
  isAboutPlayer: z
    .boolean()
    .describe(
      "true only if the article substantively covers this specific NFL player — their performance, health, role, or outlook. false if the player is only mentioned in passing, the article is mainly about someone else, or it's about a different person who happens to share the name."
    ),
  sentiment: z.enum(["positive", "neutral", "negative"]).describe("sentiment toward the player's near-term fantasy football value; ignore if isAboutPlayer is false"),
  sentimentScore: z.number().min(-1).max(1).describe("-1 very negative to 1 very positive, 0 neutral; ignore if isAboutPlayer is false"),
  reason: z.string().describe("one short sentence justifying the isAboutPlayer and sentiment calls"),
});

export interface ArticleAssessment {
  index: number;
  isAboutPlayer: boolean;
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
  reason: string;
}

export interface ClassifyResult {
  assessments: ArticleAssessment[];
  overallSummary: string;
}

function buildPrompt(player: NflPlayerIndexRow, articles: CandidateArticle[]): string {
  const header = `Player: ${player.full_name}\nPosition: ${player.position}\nTeam: ${player.team ?? "Unknown"}\n\nAssess each article below for whether it is genuinely about this player, and if so, its sentiment toward their fantasy football outlook.`;
  const list = articles
    .map(
      (a, i) =>
        `[${i}] Title: ${a.title}\nSource: ${a.source ?? "unknown"}\nPublished: ${a.publishedAt ?? "unknown"}\nExcerpt: ${a.text}`
    )
    .join("\n\n");
  return `${header}\n\n${list}`;
}

export async function classifyArticles(player: NflPlayerIndexRow, articles: CandidateArticle[]): Promise<ClassifyResult> {
  if (articles.length === 0) {
    return { assessments: [], overallSummary: "No recent coverage found." };
  }

  const { output } = await generateText({
    model: MODEL,
    maxRetries: 1, // fail fast on a persistent rate limit instead of burning the caller's time on exponential backoff
    system:
      "You are a sports-news analyst for a fantasy football app. You judge, strictly, whether news articles are actually about a specific NFL player (not a brief mention or a different person), and score the sentiment of the ones that are.",
    prompt: buildPrompt(player, articles),
    output: Output.object({
      schema: z.object({
        assessments: z.array(AssessmentSchema).length(articles.length),
        overallSummary: z
          .string()
          .describe("one to two sentence summary of the current sentiment picture for this player, written for a fantasy manager"),
      }),
    }),
  });

  return output;
}
