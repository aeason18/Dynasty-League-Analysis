"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RecordsFilters({ seasons, initialSince }: { seasons: string[]; initialSince: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function setSince(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") params.set("since", value);
    else params.delete("since");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <Select defaultValue={initialSince || "ALL"} onValueChange={(v) => v && setSince(v)}>
      <SelectTrigger className="w-full bg-card sm:w-[160px]">
        <SelectValue placeholder="Since" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">All-time</SelectItem>
        {[...seasons].reverse().map((s) => (
          <SelectItem key={s} value={s}>
            Since {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
