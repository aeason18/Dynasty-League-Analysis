"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function WinPctChart({ data }: { data: { season: string; win_pct: number; wins: number; losses: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="season"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          domain={[0, 1]}
          tickFormatter={(v) => `${Math.round(v * 100)}%`}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.05)" }}
          contentStyle={{
            background: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            fontSize: 12,
            color: "var(--color-popover-foreground)",
          }}
          formatter={(_value, _name, item) => {
            const p = item.payload as { wins: number; losses: number; win_pct: number };
            return [`${p.wins}-${p.losses} (${Math.round(p.win_pct * 100)}%)`, "Record"];
          }}
        />
        <Bar dataKey="win_pct" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
