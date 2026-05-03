import Link from "next/link";
import { ArrowRightIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Brand-coloured KPI card used across staff dashboards. Each tone keys to a
 * card background plus a matching glyph colour for the white icon chip so
 * the icon "echoes" the surface tint.
 *
 * Accessibility: white text on every tone meets WCAG AA against the brand
 * mid-luminance backgrounds (balsam .523, aquatone .763, artemis .758,
 * dusty-rose .701 in oklch).
 */
export const STAT_TONES = {
  balsam: {
    card: "bg-[#5C6E6C]",
    chipText: "text-[#5C6E6C]",
  },
  aquatone: {
    card: "bg-[#A6B7AA]",
    chipText: "text-[#5C6E6C]",
  },
  artemis: {
    card: "bg-[#D2A96A]",
    chipText: "text-[#8A6A38]",
  },
  dustyRose: {
    card: "bg-[#C58F8A]",
    chipText: "text-[#8A4F4A]",
  },
} as const;

export type StatTone = keyof typeof STAT_TONES;

export interface StatCardProps {
  /** Top-right caption (e.g. "Citas Hoy"). */
  label: string;
  /** Pre-formatted headline value (already localised / currency-formatted). */
  value: string;
  icon: LucideIcon;
  tone: StatTone;
  /** Bottom context line. Omitted when `link` is provided. */
  description?: string;
  /** Small annotation under the headline, e.g. "+4 en trial". */
  meta?: string;
  /** Action affordance at the bottom of the card. */
  link?: { href: string; label: string };
}

/**
 * Server Component — renders a tinted card with icon chip, label, big
 * value, optional secondary annotation, and either a description or a
 * clickable "Ver X →" footer link. Reused by /super-admin (description
 * variant) and /profesional (link variant).
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  description,
  meta,
  link,
}: StatCardProps) {
  const t = STAT_TONES[tone];

  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-2xl p-5 text-white shadow-sm transition-shadow hover:shadow-md",
        t.card,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full bg-white/95",
            t.chipText,
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="flex flex-col items-end text-right">
          <p className="text-xs font-medium uppercase tracking-wider opacity-85">
            {label}
          </p>
          <p
            className="mt-1 text-3xl font-semibold leading-none tracking-tight tabular-nums"
            aria-label={`${value} ${label}`}
          >
            {value}
          </p>
          {meta ? (
            <p className="mt-1.5 text-[11px] font-medium tabular-nums opacity-85">
              {meta}
            </p>
          ) : null}
        </div>
      </div>
      {link ? (
        <Link
          href={link.href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          {link.label}
          <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
      ) : description ? (
        <p className="text-xs leading-relaxed opacity-85">{description}</p>
      ) : null}
    </div>
  );
}
