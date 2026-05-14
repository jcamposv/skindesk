"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

import type { MapZone } from "./zones";

interface ZoneMapProps {
  /** Type drives palette + viewBox dimensions. */
  variant: "face" | "body";
  /** Background silhouette path (stylised face or body). */
  silhouette: string;
  /** Zones rendered on top — clickable. */
  zones: MapZone[];
  /** Currently-selected zone ids. */
  selected: string[];
  /** Toggle handler. */
  onToggle: (id: string) => void;
  /** Read-only mode disables interaction (used in session detail). */
  readOnly?: boolean;
  className?: string;
}

/**
 * Stylised SVG zone-picker for face and body. Same component handles both —
 * only the viewBox + silhouette path change. Labels are rendered as
 * foreignObject so they get system font and crisp text.
 *
 * Visual language:
 *  - silhouette is rendered as a soft cream fill with a thin sage outline
 *  - zones are subtle dashed outlines, fill on hover, terracotta when selected
 *  - selected zones get a small numeric badge so the form below can mirror order
 */
export function ZoneMap({
  variant,
  silhouette,
  zones,
  selected,
  onToggle,
  readOnly = false,
  className,
}: ZoneMapProps) {
  const uid = useId();
  const viewW = 240;
  const viewH = variant === "face" ? 320 : 430;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#F4EFE8] via-[#ECE3D5] to-[#E2D6C0] p-3 ring-1 ring-[#5C6E6C]/10",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        className="mx-auto block h-auto w-full max-w-[420px] select-none"
        role="img"
        aria-label={
          variant === "face"
            ? "Mapa facial · zonas de tratamiento"
            : "Mapa corporal · zonas de tratamiento"
        }
      >
        <defs>
          <linearGradient
            id={`${uid}-skin`}
            x1="0"
            y1="0"
            x2="0"
            y2={viewH}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#F8E9DC" />
            <stop offset="100%" stopColor="#E8D2BD" />
          </linearGradient>
        </defs>

        {/* Silhouette */}
        <path
          d={silhouette}
          fill={`url(#${uid}-skin)`}
          stroke="#5C6E6C"
          strokeOpacity="0.35"
          strokeWidth="1.4"
        />

        {/* Zone paths */}
        {zones.map((zone) => {
          const isSelected = selected.includes(zone.id);
          return (
            <path
              key={zone.id}
              d={zone.path}
              fill={
                isSelected ? "rgba(187,113,84,0.42)" : "rgba(92,110,108,0.07)"
              }
              stroke={isSelected ? "#BB7154" : "rgba(92,110,108,0.55)"}
              strokeWidth={isSelected ? "1.8" : "1.2"}
              strokeDasharray={isSelected ? "0" : "4 3"}
              vectorEffect="non-scaling-stroke"
              onClick={() => !readOnly && onToggle(zone.id)}
              className={cn(
                "transition-colors",
                !readOnly && "cursor-pointer hover:fill-[#BB7154]/30",
              )}
              role={readOnly ? undefined : "button"}
              aria-label={zone.label}
              aria-pressed={readOnly ? undefined : isSelected}
            />
          );
        })}

        {/* Selected zone numeric badges */}
        {zones
          .filter((z) => selected.includes(z.id))
          .map((zone) => (
            <g key={`badge-${zone.id}`} pointerEvents="none">
              <circle
                cx={zone.labelAt.x}
                cy={zone.labelAt.y}
                r="9"
                fill="#BB7154"
                stroke="#fff"
                strokeWidth="2"
              />
              <text
                x={zone.labelAt.x}
                y={zone.labelAt.y + 3.5}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#fff"
                fontFamily="ui-sans-serif,system-ui,sans-serif"
              >
                {selected.indexOf(zone.id) + 1}
              </text>
            </g>
          ))}
      </svg>

      {/* Zone chip-list below the SVG — also clickable, mirrors selection */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {zones.map((zone) => {
          const isSelected = selected.includes(zone.id);
          return (
            <button
              key={`chip-${zone.id}`}
              type="button"
              onClick={() => !readOnly && onToggle(zone.id)}
              disabled={readOnly}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                isSelected
                  ? "border-[#BB7154] bg-[#F6E0D6] text-[#8C4A30]"
                  : "border-border/60 bg-card/80 text-muted-foreground hover:border-[#BB7154]/40 hover:bg-[#FBEFE7]/60",
                readOnly && "cursor-default",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  isSelected ? "bg-[#BB7154]" : "bg-muted-foreground/40",
                )}
              />
              {zone.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
