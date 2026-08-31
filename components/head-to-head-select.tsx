"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function HeadToHeadSelect({
  managers,
  managerA,
  managerB,
}: {
  managers: { id: string; name: string }[];
  managerA?: string;
  managerB?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: "managerA" | "managerB", value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <Select value={managerA} onValueChange={(v) => update("managerA", v)}>
        <SelectTrigger className="w-full bg-card sm:w-[200px]">
          <SelectValue placeholder="Select manager">
            {(value: string | null) => managers.find((m) => m.id === value)?.name ?? "Select manager"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {managers.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs font-semibold text-muted-foreground">VS</span>
      <Select value={managerB} onValueChange={(v) => update("managerB", v)}>
        <SelectTrigger className="w-full bg-card sm:w-[200px]">
          <SelectValue placeholder="Select opponent">
            {(value: string | null) => managers.find((m) => m.id === value)?.name ?? "Select opponent"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {managers.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
