"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ManagerSelect({
  managers,
  current,
}: {
  managers: { user_id: string; display_name: string }[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(managerId: string | null) {
    if (!managerId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("manager", managerId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="w-full bg-card sm:w-[200px]">
        <SelectValue placeholder="Select franchise">
          {(value: string | null) => managers.find((m) => m.user_id === value)?.display_name ?? "Select franchise"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {managers.map((m) => (
          <SelectItem key={m.user_id} value={m.user_id}>
            {m.display_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
