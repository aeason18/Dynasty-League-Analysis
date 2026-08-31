"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SeasonSelect({ seasons, current }: { seasons: string[]; current: string }) {
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
            {s} Season
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
