"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RevenuePoint {
  month: string;
  amount: number;
}

export interface RevenueChartProps {
  data: readonly RevenuePoint[];
  /** Currency-formatted prefix used on the Y axis ticks. Defaults to "$". */
  currencySymbol?: string;
}

/**
 * Monthly revenue area chart in balsam green with a soft gradient fill.
 * Client component because recharts measures the DOM to size itself; a
 * `ResponsiveContainer` keeps it fluid in any grid cell.
 */
export function RevenueChart({
  data,
  currencySymbol = "$",
}: RevenueChartProps) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer>
        <AreaChart
          data={[...data]}
          margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5C6E6C" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#5C6E6C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#EFECE5"
            strokeDasharray="3 4"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#6B6B6B" }}
            dy={4}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#6B6B6B" }}
            tickFormatter={(value) =>
              `${currencySymbol}${Math.round(Number(value) / 1000)}k`
            }
            width={48}
          />
          <Tooltip
            cursor={{ stroke: "#A6B7AA", strokeWidth: 1, strokeDasharray: "3 4" }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #EFECE5",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              fontSize: 12,
              padding: "8px 12px",
            }}
            formatter={(value) => [
              `${currencySymbol}${Number(value).toLocaleString("en-US")}`,
              "Ingresos",
            ]}
            labelStyle={{ color: "#6B6B6B", marginBottom: 2 }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#5C6E6C"
            strokeWidth={2.5}
            fill="url(#revenueFill)"
            dot={{ r: 4, fill: "#5C6E6C", stroke: "#fff", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "#5C6E6C", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
