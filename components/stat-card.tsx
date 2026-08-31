import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent = "primary",
  className,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon?: LucideIcon;
  accent?: "primary" | "accent" | "neutral";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-border",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className="font-heading text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
            {value}
          </span>
          {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
        </div>
        {Icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              accent === "primary" && "bg-primary/15 text-primary",
              accent === "accent" && "bg-accent/20 text-accent",
              accent === "neutral" && "bg-white/5 text-muted-foreground"
            )}
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={2.25} />
          </span>
        )}
      </div>
    </div>
  );
}
