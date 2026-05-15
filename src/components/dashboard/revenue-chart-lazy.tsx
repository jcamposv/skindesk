"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

import type { RevenueChartProps } from "./revenue-chart";

/**
 * Lazy entry for `RevenueChart`. recharts ships a sizeable bundle
 * (~120 kB min+gzip), so we defer it until the dashboard hydrates
 * client-side. `ssr: false` because recharts measures DOM to size the
 * ResponsiveContainer — server-rendered HTML would re-flow once
 * hydration kicks in, causing a visible jump.
 */
const RevenueChartImpl = dynamic(
  () =>
    import("./revenue-chart").then((m) => ({ default: m.RevenueChart })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[220px] w-full rounded-xl" />,
  },
);

export function RevenueChartLazy(props: RevenueChartProps) {
  return <RevenueChartImpl {...props} />;
}
