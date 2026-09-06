"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const ORDINALS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };
function ordinal(n: number): string {
  return ORDINALS[n] ?? `${n}th`;
}

export function StandingDistributionChart({
  distribution,
  playoffTeams,
}: {
  distribution: Record<string, number>;
  playoffTeams: number;
}) {
  const numStandings = Object.keys(distribution).length;
  const data = Array.from({ length: numStandings }, (_, i) => {
    const standing = i + 1;
    return { standing, label: ordinal(standing), probability: (distribution[String(standing)] ?? 0) * 100 };
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={36}
          tickFormatter={(v) => `${v}%`}
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
          formatter={(value) => [`${(value as number).toFixed(1)}%`, "of simulations"]}
        />
        <Bar dataKey="probability" radius={[6, 6, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.standing} fill={d.standing <= playoffTeams ? "var(--color-primary)" : "var(--color-muted-foreground)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
