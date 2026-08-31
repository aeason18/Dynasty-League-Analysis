"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PlayerGameLog } from "@/lib/queries/players";

export function PlayerPointsChart({ data }: { data: PlayerGameLog[] }) {
  const chartData = data.map((g) => ({ ...g, label: `${g.season} W${g.week}` }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={32}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ stroke: "var(--color-border)" }}
          contentStyle={{
            background: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            fontSize: 12,
            color: "var(--color-popover-foreground)",
          }}
          formatter={(value) => [typeof value === "number" ? value.toFixed(1) : value, "Points"]}
        />
        <Line
          type="monotone"
          dataKey="points"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          dot={{ r: 2, fill: "var(--color-chart-1)" }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
