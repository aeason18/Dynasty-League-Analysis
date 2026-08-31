import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, sleeperAvatarUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TeamBadge({
  name,
  subtitle,
  avatar,
  size = "md",
  className,
}: {
  name: string;
  subtitle?: string;
  avatar?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-11 w-11" : "h-8 w-8";
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar className={cn(dims, "shrink-0 border border-border/60")}>
        <AvatarImage src={sleeperAvatarUrl(avatar ?? null) ?? undefined} alt={name} />
        <AvatarFallback className="bg-secondary text-[10px] font-semibold text-secondary-foreground">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
      </div>
    </div>
  );
}
