import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { CornerFrame } from "@/components/corner-frame";

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent = "primary",
  framed = false,
  className,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon?: LucideIcon;
  accent?: "primary" | "accent" | "neutral";
  /** Corner-bracket accent — reserve for the one standout card per grid. */
  framed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-border",
        className
      )}
    >
      {framed && <CornerFrame />}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
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
              accent === "neutral" && "bg-secondary/40 text-muted-foreground"
            )}
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={2.25} />
          </span>
        )}
      </div>
    </div>
  );
}
