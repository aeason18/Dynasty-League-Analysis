"use client";

import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TeamBadge } from "@/components/team-badge";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PowerRanking, PowerRankingPlayer, RosterProfile } from "@/lib/queries/rankings";

const PROFILE_STYLE: Record<RosterProfile, string> = {
  "Top Heavy": "bg-pop/15 text-pop",
  Balanced: "bg-primary/15 text-primary",
  Deep: "bg-accent/20 text-accent",
};

function valueLabel(v: number): string {
  return v > 0 ? fmtNumber(Math.round(v)) : "—";
}

function PlayerList({ players }: { players: PowerRankingPlayer[] }) {
  if (players.length === 0) {
    return <p className="text-xs text-muted-foreground">None</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {players.map((p) => (
        <li key={p.player_id} className="flex items-baseline justify-between gap-3 text-xs">
          <span className="truncate text-foreground">
            {p.name}
            {p.position && <span className="ml-1 text-muted-foreground">{p.position}</span>}
          </span>
          <span className="shrink-0 font-mono tabular-nums text-muted-foreground">{valueLabel(p.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function RankingDetail({ r }: { r: PowerRanking }) {
  const gap = Math.abs(r.starScore - r.depthScore);
  const profileNote =
    r.profile === "Top Heavy"
      ? `Star Power (${r.starScore.toFixed(1)}) clears Depth (${r.depthScore.toFixed(1)}) by ${gap.toFixed(1)} pts — this roster's value is concentrated at the top.`
      : r.profile === "Deep"
        ? `Depth (${r.depthScore.toFixed(1)}) clears Star Power (${r.starScore.toFixed(1)}) by ${gap.toFixed(1)} pts — more value spread across the bench than at the top.`
        : `Star Power (${r.starScore.toFixed(1)}) and Depth (${r.depthScore.toFixed(1)}) are within ${gap.toFixed(1)} pts of each other — no strong lean either way.`;

  return (
    <div className="flex flex-col gap-4 border-t border-border/60 bg-background/40 p-5">
      <p className="text-xs text-muted-foreground">{profileNote}</p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Star Power</span>
            <span className="font-mono text-xs tabular-nums text-primary">{r.starScore.toFixed(1)}</span>
          </div>
          <PlayerList players={r.starGroup} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Starters</span>
            <span className="font-mono text-xs tabular-nums text-primary">{r.starterScore.toFixed(1)}</span>
          </div>
          <PlayerList players={r.starterGroup} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Depth</span>
            <span className="font-mono text-xs tabular-nums text-primary">{r.depthScore.toFixed(1)}</span>
          </div>
          <PlayerList players={r.depthGroup} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Picks</span>
            <span className="font-mono text-xs tabular-nums text-primary">{r.picksScore.toFixed(1)}</span>
          </div>
          {r.pickGroup.length === 0 ? (
            <p className="text-xs text-muted-foreground">None owned</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {r.pickGroup.map((p, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-foreground">
                    {p.season} Round {p.round}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">{valueLabel(p.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function PowerRankingsTable({ rankings }: { rankings: PowerRanking[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(rosterId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rosterId)) next.delete(rosterId);
      else next.add(rosterId);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
      <div className="min-w-[720px]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">#</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Profile</TableHead>
              <TableHead className="text-right">Star Power</TableHead>
              <TableHead className="text-right">Starters</TableHead>
              <TableHead className="text-right">Depth</TableHead>
              <TableHead className="text-right">Picks</TableHead>
              <TableHead className="text-right">Overall</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rankings.map((r) => {
              const isOpen = expanded.has(r.roster_id);
              return (
                <Fragment key={r.roster_id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => toggle(r.roster_id)}
                    aria-expanded={isOpen}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        {r.rank === 1 && <span className="h-1 w-1 shrink-0 rounded-full bg-pop" aria-hidden />}
                        {r.rank}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TeamBadge
                        name={r.team_name ?? r.manager_name}
                        subtitle={r.starGroup.map((p) => p.name).slice(0, 2).join(" · ") || undefined}
                        avatar={r.avatar}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("border-0", PROFILE_STYLE[r.profile])}>
                        {r.profile}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {r.starScore.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {r.starterScore.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {r.depthScore.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                      {r.picksScore.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-base font-semibold tabular-nums text-primary">
                      {r.overall.toFixed(1)}
                    </TableCell>
                    <TableCell>
                      <ChevronDown
                        className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                      />
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={9} className="p-0">
                        <RankingDetail r={r} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
