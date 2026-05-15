"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

import type { TreatmentsDonutProps } from "./treatments-donut";

/**
 * Lazy entry for `TreatmentsDonut`. Shares the recharts chunk with
 * `RevenueChart` once the dashboard hydrates — same `ssr: false`
 * reasoning (recharts measures the DOM).
 */
const TreatmentsDonutImpl = dynamic(
  () =>
    import("./treatments-donut").then((m) => ({
      default: m.TreatmentsDonut,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="grid place-items-center py-6">
        <Skeleton className="size-44 rounded-full" />
      </div>
    ),
  },
);

export function TreatmentsDonutLazy(props: TreatmentsDonutProps) {
  return <TreatmentsDonutImpl {...props} />;
}
