"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PlayerSentimentSnapshot } from "@/lib/types";

export function SentimentTrendChart({ data }: { data: PlayerSentimentSnapshot[] }) {
  const chartData = data
    .filter((s) => s.score !== null)
    .map((s) => ({
      label: new Date(s.computed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: s.score,
      articleCount: s.article_count,
    }));

  return (
    <ResponsiveContainer width="100%" height={220}>
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
          domain={[-1, 1]}
          tickLine={false}
          axisLine={false}
          width={32}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
        />
        <ReferenceLine y={0} stroke="var(--color-border)" />
        <Tooltip
          cursor={{ stroke: "var(--color-border)" }}
          contentStyle={{
            background: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            fontSize: 12,
            color: "var(--color-popover-foreground)",
          }}
          formatter={(value, name, item) => [
            `${typeof value === "number" ? value.toFixed(2) : value} (${item.payload.articleCount} articles)`,
            "Sentiment",
          ]}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-chart-1)" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
