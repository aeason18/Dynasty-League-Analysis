import Exa from "exa-js";
import type { NflPlayerIndexRow } from "@/lib/types";

export interface CandidateArticle {
  url: string;
  title: string;
  source: string | null;
  publishedAt: string | null;
  text: string;
}

function hostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function findPlayerArticles(
  player: NflPlayerIndexRow,
  windowDays: number
): Promise<CandidateArticle[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error("Missing EXA_API_KEY");
  const exa = new Exa(apiKey);

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const query = [player.full_name, player.team, "NFL", "fantasy football"].filter(Boolean).join(" ");

  const { results } = await exa.search(query, {
    type: "auto",
    category: "news",
    numResults: 12,
    startPublishedDate: since.toISOString(),
    contents: { text: { maxCharacters: 1500 }, filterEmptyResults: true },
  });

  return results.map((r) => ({
    url: r.url,
    title: r.title ?? r.url,
    source: hostname(r.url),
    publishedAt: r.publishedDate ?? null,
    text: r.text,
  }));
}
