// Server-only client for the dynasty-ppg-api Modal deployment (see
// ml_api/ at the repo root). Never call this from a Client Component —
// MODAL_PROXY_KEY/MODAL_PROXY_SECRET must stay off the browser bundle.
const SUPPORTED_POSITIONS = ["QB", "RB", "WR", "TE"] as const;
type SupportedPosition = (typeof SUPPORTED_POSITIONS)[number];

export interface PpgProjectionInput {
  position: SupportedPosition;
  season_ppg: number;
  season_games_played: number;
  season_total_points: number;
  years_exp: number;
}

export interface PpgProjection {
  predicted_next_season_ppg: number;
}

export function isSupportedPosition(position: string | null): position is SupportedPosition {
  return SUPPORTED_POSITIONS.includes(position as SupportedPosition);
}

// Returns null on any failure (unsupported position, API down, missing env
// vars) rather than throwing — this is a supplementary projection, not
// something that should ever break the player detail page.
export async function getProjectedNextSeasonPpg(input: PpgProjectionInput): Promise<PpgProjection | null> {
  const url = process.env.ML_API_URL;
  const key = process.env.MODAL_PROXY_KEY;
  const secret = process.env.MODAL_PROXY_SECRET;
  if (!url || !key || !secret) return null;

  try {
    const res = await fetch(`${url}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Modal-Key": key,
        "Modal-Secret": secret,
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as PpgProjection;
  } catch {
    return null;
  }
}
