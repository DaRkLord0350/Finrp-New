"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface KPIChartProps {
  data: {
    name: string;
    value: number;
  }[];
}

export function KPIChart({
  data,
}: KPIChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey="name" />

          <YAxis />

          <Tooltip />

          <Line
            type="monotone"
            dataKey="value"
            strokeWidth={3}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}