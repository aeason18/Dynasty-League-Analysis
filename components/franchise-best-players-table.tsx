"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtPoints } from "@/lib/format";
import type { PlayerTeamPoints } from "@/lib/types";

type SortKey = "total_points" | "games_played" | "ppg";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "total_points", label: "Total Points", align: "right" },
  { key: "games_played", label: "Games", align: "right" },
  { key: "ppg", label: "PPG", align: "right" },
];

export function FranchiseBestPlayersTable({ players }: { players: PlayerTeamPoints[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("total_points");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const list = [...players];
    list.sort((a, b) => {
      const diff = Number(a[sortKey]) - Number(b[sortKey]);
      return direction === "asc" ? diff : -diff;
    });
    return list;
  }, [players, sortKey, direction]);

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setDirection("desc");
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">#</TableHead>
            <TableHead>Player</TableHead>
            {COLUMNS.map((col) => (
              <TableHead key={col.key} className={col.align === "right" ? "text-right" : undefined}>
                <button
                  type="button"
                  onClick={() => onSort(col.key)}
                  className={cn(
                    "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                    sortKey === col.key && "text-foreground"
                  )}
                >
                  {col.label}
                  {sortKey === col.key ? (
                    direction === "desc" ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUp className="h-3 w-3" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-40" />
                  )}
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((p, i) => (
            <TableRow key={p.player_id}>
              <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="font-medium">
                {p.player_name}
                {p.player_position && <span className="ml-2 text-xs text-muted-foreground">{p.player_position}</span>}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">
                {fmtPoints(Number(p.total_points))}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                {p.games_played}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                {fmtPoints(Number(p.ppg))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
