import { cn } from "@/lib/utils";

const CORNERS = [
  "left-0 top-0 border-l border-t",
  "right-0 top-0 border-r border-t",
  "left-0 bottom-0 border-l border-b",
  "right-0 bottom-0 border-r border-b",
] as const;

/**
 * A sparing accent: small bracket marks at the corners of a panel. Requires a
 * `relative` (or otherwise positioned) parent. Reserved for the one or two
 * most important panels on a page, not applied to every card.
 */
export function CornerFrame({ size = 10, className }: { size?: number; className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
      {CORNERS.map((pos) => (
        <span key={pos} className={cn("absolute border-primary", pos)} style={{ width: size, height: size }} />
      ))}
    </div>
  );
}
