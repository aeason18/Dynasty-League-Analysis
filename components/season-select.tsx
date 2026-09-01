"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SeasonSelect({
  seasons,
  current,
  allLabel,
}: {
  seasons: string[];
  current: string;
  /** Label for the literal season value "All", if present in `seasons`. */
  allLabel?: string;
}) {
  const formatLabel = (s: string) => (s === "All" && allLabel ? allLabel : `${s} Season`);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(season: string | null) {
    if (!season) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("season", season);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="w-[140px] bg-card">
        <SelectValue placeholder="Season" />
      </SelectTrigger>
      <SelectContent>
        {seasons.map((s) => (
          <SelectItem key={s} value={s}>
            {formatLabel(s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
