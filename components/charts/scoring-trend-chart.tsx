"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeasonTrend } from "@/lib/queries/dashboard";

export function ScoringTrendChart({ data }: { data: SeasonTrend[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="scoringFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          formatter={(value, name) => [
            typeof value === "number" ? value.toFixed(1) : String(value),
            name === "avg_points" ? "Avg points/game" : String(name),
          ]}
          labelFormatter={(label) => `${label} season`}
        />
        <Area
          type="monotone"
          dataKey="avg_points"
          stroke="var(--color-primary)"
          strokeWidth={2}
          fill="url(#scoringFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
