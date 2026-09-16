"use client";

import { useEffect } from "react";
import { useSeasonBadge } from "@/components/season-context";

// Rendered by the league layout (a Server Component) purely to relay its
// server-fetched current season up into SiteHeader via context. Renders
// nothing itself; clears the badge on unmount so it doesn't linger after
// navigating away from a league route.
export function SeasonBadgeSetter({ season }: { season: string | null }) {
  const { setSeason } = useSeasonBadge();

  useEffect(() => {
    setSeason(season);
    return () => setSeason(null);
  }, [season, setSeason]);

  return null;
}
