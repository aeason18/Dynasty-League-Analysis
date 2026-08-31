"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];

export function PlayerFilters({ initialSearch, initialPosition }: { initialSearch: string; initialPosition: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [, startTransition] = useTransition();

  function pushParams(next: { q?: string; position?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.q !== undefined) {
      if (next.q) params.set("q", next.q);
      else params.delete("q");
    }
    if (next.position !== undefined) {
      if (next.position && next.position !== "ALL") params.set("position", next.position);
      else params.delete("position");
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            pushParams({ q: e.target.value });
          }}
          placeholder="Search players..."
          className="bg-card pl-9"
        />
      </div>
      <Select defaultValue={initialPosition || "ALL"} onValueChange={(v) => v && pushParams({ position: v })}>
        <SelectTrigger className="w-full bg-card sm:w-[140px]">
          <SelectValue placeholder="Position" />
        </SelectTrigger>
        <SelectContent>
          {POSITIONS.map((p) => (
            <SelectItem key={p} value={p}>
              {p === "ALL" ? "All Positions" : p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
