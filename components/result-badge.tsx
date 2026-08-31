import { cn } from "@/lib/utils";

export function ResultBadge({ result, className }: { result: "W" | "L" | "T" | null; className?: string }) {
  if (!result) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
        result === "W" && "bg-primary/20 text-primary",
        result === "L" && "bg-destructive/15 text-destructive",
        result === "T" && "bg-white/10 text-muted-foreground",
        className
      )}
    >
      {result}
    </span>
  );
}
