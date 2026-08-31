import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-card/40 px-6 py-16 text-center",
        className
      )}
    >
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-muted-foreground">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}
