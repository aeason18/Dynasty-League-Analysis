import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex flex-col gap-1.5">
        {eyebrow && (
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            <span className="h-1 w-1 shrink-0 rounded-full bg-pop" aria-hidden />
            {eyebrow}
          </span>
        )}
        <h1 className="font-heading text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
