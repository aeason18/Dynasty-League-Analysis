"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ManagerSelect({
  managers,
  current,
  allLabel,
  placeholder = "Select franchise",
}: {
  managers: { user_id: string; display_name: string }[];
  current: string;
  /** When set, an extra option with value "All" is shown with this label. */
  allLabel?: string;
  placeholder?: string;
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

  function label(value: string | null) {
    if (value === "All" && allLabel) return allLabel;
    return managers.find((m) => m.user_id === value)?.display_name ?? placeholder;
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="w-full bg-card sm:w-[200px]">
        <SelectValue placeholder={placeholder}>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value="All">{allLabel}</SelectItem>}
        {managers.map((m) => (
          <SelectItem key={m.user_id} value={m.user_id}>
            {m.display_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
