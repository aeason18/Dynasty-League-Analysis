"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface SeasonContextValue {
  season: string | null;
  setSeason: (season: string | null) => void;
}

const SeasonContext = createContext<SeasonContextValue | null>(null);

// Lets a league route's server layout (which knows the current season)
// hand it up to SiteHeader, which is rendered as a sibling of {children}
// in the root layout and so can't read route params or fetch it itself.
export function SeasonProvider({ children }: { children: ReactNode }) {
  const [season, setSeason] = useState<string | null>(null);
  return <SeasonContext.Provider value={{ season, setSeason }}>{children}</SeasonContext.Provider>;
}

export function useSeasonBadge() {
  const ctx = useContext(SeasonContext);
  if (!ctx) throw new Error("useSeasonBadge must be used within a SeasonProvider");
  return ctx;
}
