"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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
    <nav className={cn("flex items-center gap-1", className)}>
      {NAV_ITEMS.map((item) => {
        const href = item.path ? `/${leagueId}/${item.path}` : `/${leagueId}`;
        const active = item.path ? pathname.startsWith(href) : pathname === href;
        return (
          <Link
            key={item.path}
            href={href}
            onClick={onNavigate}
            className={cn(
              "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
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
  // The onboarding root ("/") has no league in scope yet, so it gets a
  // brand-mark-only header with no nav — every other route is nested under
  // /<leagueId>/..., where the first path segment is that league's id.
  const leagueId = pathname.split("/").filter(Boolean)[0] ?? null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Trophy className="h-4.5 w-4.5" strokeWidth={2.25} />
          </span>
          <span className="font-heading text-sm font-semibold tracking-tight text-foreground">
            Fantasy League Archive
          </span>
        </Link>

        {leagueId && (
          <>
            <NavLinks leagueId={leagueId} className="hidden md:flex" />

            <div className="flex items-center gap-2 md:hidden">
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
