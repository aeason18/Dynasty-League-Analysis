"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useSeasonBadge } from "@/components/season-context";

// Sub-paths relative to the current league segment ("" = the league's own
// dashboard at /<leagueId>).
const NAV_ITEMS = [
  { path: "", label: "Dashboard" },
  { path: "franchise", label: "Franchise" },
  { path: "players", label: "Players" },
  { path: "matchups", label: "Matchups" },
  { path: "records", label: "Records" },
  { path: "trades", label: "Trades" },
];

function NavLinks({ leagueId, onNavigate, className }: { leagueId: string; onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn("flex items-stretch gap-0", className)}>
      {NAV_ITEMS.map((item) => {
        const href = item.path ? `/${leagueId}/${item.path}` : `/${leagueId}`;
        const active = item.path ? pathname.startsWith(href) : pathname === href;
        return (
          <Link
            key={item.path}
            href={href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-widest transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 shrink-0",
                active
                  ? "bg-primary"
                  : "border border-muted-foreground/60 bg-transparent group-hover:border-foreground/60"
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { season } = useSeasonBadge();
  // The onboarding root ("/") has no league in scope yet, so it gets a
  // brand-mark-only header with no nav — every other route is nested under
  // /<leagueId>/..., where the first path segment is that league's id.
  const leagueId = pathname.split("/").filter(Boolean)[0] ?? null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="flex items-stretch justify-between">
        <Link
          href="/"
          className="flex items-center px-6 font-heading text-lg font-black uppercase tracking-tight text-foreground"
        >
          Dynasty<span className="text-primary">://</span>Archive
        </Link>

        {leagueId && (
          <>
            <div className="hidden items-stretch md:flex">
              <NavLinks leagueId={leagueId} />
              {season && (
                <>
                  <div aria-hidden className="w-px self-stretch bg-border" />
                  <div className="flex items-center bg-primary px-5 font-mono text-xs font-bold uppercase tracking-widest text-primary-foreground">
                    {season} Season
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 px-4 md:hidden">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label="Open navigation menu" />
                  }
                >
                  <Menu className="h-5 w-5" />
                </SheetTrigger>
                <SheetContent side="right" className="border-border/60 p-0">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="flex flex-col gap-1 p-4 pt-14">
                    <NavLinks leagueId={leagueId} className="flex-col items-stretch gap-1" onNavigate={() => setOpen(false)} />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
