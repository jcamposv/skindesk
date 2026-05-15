"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

interface TreatmentSlice {
  name: string;
  value: number;
}

export interface TreatmentsDonutProps {
  data: readonly TreatmentSlice[];
  /** Big number rendered in the donut hole — typically the sum of slices. */
  total: number;
  /** Caption under the total. Default: "tratamientos". */
  totalLabel?: string;
}

// Brand palette ordered by descending visual weight so the largest slice
// gets the most prominent colour. Reused here and in the legend below so
// chart and labels stay in sync.
const SLICE_COLORS = ["#5C6E6C", "#A6B7AA", "#D2A96A", "#C58F8A"] as const;

/**
 * Donut chart with a centred big number — used for "treatments mix" where
 * the headline is the total and each slice tells you the breakdown. The
 * legend renders to the right of the donut and uses the same colour
 * mapping by index.
 */
export function TreatmentsDonut({
  data,
  total,
  totalLabel = "tratamientos",
}: TreatmentsDonutProps) {
  const sum = data.reduce((acc, d) => acc + d.value, 0) || 1;

  // `@container` + `@md` lets the layout react to the CARD's own width
  // (not the viewport's). The card sits in a grid that changes column
  // count at lg, so a viewport-based breakpoint would always lag behind.
  // Stacked under ~28rem of card width, side-by-side above that.
  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-5 @md:flex-row @md:items-center @md:gap-6">
        <div className="relative size-[140px] shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={[...data]}
                dataKey="value"
                nameKey="name"
                innerRadius={46}
                outerRadius={66}
                paddingAngle={2}
                startAngle={90}
                endAngle={450}
                stroke="none"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground/75">
              Total
            </p>
            <p className="text-2xl font-semibold leading-none tabular-nums">
              {total}
            </p>
            <p className="mt-0.5 text-xs font-medium text-foreground/75">
              {totalLabel}
            </p>
          </div>
        </div>
        <ul className="flex w-full min-w-0 flex-1 flex-col gap-2.5 text-sm">
          {data.map((slice, i) => (
            <li
              key={slice.name}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length],
                  }}
                  aria-hidden
                />
                <span className="min-w-0 truncate text-xs">{slice.name}</span>
              </span>
              <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                {Math.round((slice.value / sum) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
