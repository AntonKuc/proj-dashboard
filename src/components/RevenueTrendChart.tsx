"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export type TrendPoint = { month: string; Выручка: number; "Валовая прибыль": number };

const numberFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export default function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => numberFormatter.format(v as number)}
          width={70}
        />
        <Tooltip formatter={(v: number) => numberFormatter.format(v)} />
        <Legend />
        <Line type="monotone" dataKey="Выручка" stroke="#3b6fe0" strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="Валовая прибыль"
          stroke="#22a06b"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
