"use client";

import { memo, useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Zone definition for the photo-based picker — mirrors the
 * evaluaciones facial-zones shape so the data flows naturally between the
 * two surfaces.
 *
 *  - `path` is an SVG path in **photo-space** (viewBox 0..PHOTO_W × 0..PHOTO_H).
 *  - `anchor` is where the connector line touches the body/face (photo-space).
 *  - `placement.x|y` is in **percent of the world viewBox** so labels can
 *    float in the side gutters outside the photo.
 */
export interface PhotoZone {
  id: string;
  label: string;
  path: string;
  anchor: { x: number; y: number };
  placement: { x: number; y: number; side: "left" | "right" };
}

interface PhotoZonePickerProps {
  /** Public path to the JPG/PNG that backs the photo. */
  photoSrc: string;
  /** Accessible alt text. */
  photoAlt: string;
  /**
   * Aspect ratio of the source photo (width ÷ height). The face photo is
   * square (1.0); the body photo is portrait (~0.667). This lets one picker
   * back both surfaces without per-variant geometry.
   */
  photoAspect: number;
  zones: PhotoZone[];
  selected: string[];
  onToggle: (id: string) => void;
  /** Read-only render (used in the history sheet). */
  readOnly?: boolean;
  /** Photo can sit on a soft background (face) or be cut-out with a
   *  transparent PNG (body). Transparent photos look better on a neutral
   *  card background so the silhouette reads cleanly. */
  surface?: "soft" | "plain";
  className?: string;
}

// World geometry — only the gutters and photo width are constants; photo
// height (and therefore world height) follow the source aspect ratio.
const VIEW_W = 1640;
const PHOTO_W = 1000;
const PHOTO_X = 320;

function PhotoZonePickerImpl({
  photoSrc,
  photoAlt,
  photoAspect,
  zones,
  selected,
  onToggle,
  readOnly = false,
  surface = "soft",
  className,
}: PhotoZonePickerProps) {
  const uid = useId();
  const photoH = Math.round(PHOTO_W / photoAspect);
  const viewH = photoH;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl p-2 shadow-sm ring-1 ring-border/30",
        surface === "soft"
          ? "bg-gradient-to-br from-[#F4EFE8] via-[#ECE3D5] to-[#DFD3C2]"
          : "bg-[#FBF9F4]",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${viewH}`}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full select-none"
        role="img"
        aria-label={photoAlt}
      >
        <defs>
          <radialGradient id={`${uid}-vignette`} cx="50%" cy="48%" r="60%">
            <stop offset="70%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.16" />
          </radialGradient>
          <clipPath id={`${uid}-photo-clip`}>
            <rect x={PHOTO_X} y="0" width={PHOTO_W} height={photoH} rx="20" ry="20" />
          </clipPath>
        </defs>

        {/* Photo background */}
        <g clipPath={`url(#${uid}-photo-clip)`}>
          <image
            href={photoSrc}
            x={PHOTO_X}
            y="0"
            width={PHOTO_W}
            height={photoH}
            preserveAspectRatio="xMidYMid slice"
          />
          {surface === "soft" ? (
            <rect
              x={PHOTO_X}
              y="0"
              width={PHOTO_W}
              height={photoH}
              fill={`url(#${uid}-vignette)`}
            />
          ) : null}
        </g>

        {/* Zone hit areas — photo space, translated by PHOTO_X */}
        <g transform={`translate(${PHOTO_X} 0)`}>
          {zones.map((zone) => {
            const isSelected = selected.includes(zone.id);
            return (
              <path
                key={zone.id}
                d={zone.path}
                fill={
                  isSelected
                    ? "rgba(187,113,84,0.32)"
                    : "rgba(92,110,108,0.08)"
                }
                stroke={isSelected ? "#BB7154" : "rgba(255,255,255,0.85)"}
                strokeWidth={isSelected ? "3" : "1.8"}
                strokeDasharray={isSelected ? "0" : "10 6"}
                vectorEffect="non-scaling-stroke"
                onClick={() => !readOnly && onToggle(zone.id)}
                onMouseEnter={(e) => {
                  if (readOnly || isSelected) return;
                  e.currentTarget.setAttribute("fill", "rgba(187,113,84,0.18)");
                }}
                onMouseLeave={(e) => {
                  if (readOnly || isSelected) return;
                  e.currentTarget.setAttribute("fill", "rgba(92,110,108,0.08)");
                }}
                className={cn(
                  "transition-colors",
                  !readOnly && "cursor-pointer",
                )}
                role={readOnly ? undefined : "button"}
                aria-label={zone.label}
                aria-pressed={readOnly ? undefined : isSelected}
                style={{ transition: "fill 120ms, stroke 120ms" }}
              />
            );
          })}
        </g>

        {/* Connector lines (world space) */}
        {zones.map((zone) => {
          const isSelected = selected.includes(zone.id);
          const anchor = { x: zone.anchor.x + PHOTO_X, y: zone.anchor.y };
          const labelEnd = labelLineEnd(zone, viewH);
          return (
            <line
              key={`line-${zone.id}`}
              x1={labelEnd.x}
              y1={labelEnd.y}
              x2={anchor.x}
              y2={anchor.y}
              stroke={isSelected ? "#BB7154" : "#94908A"}
              strokeWidth={isSelected ? "2.4" : "1.4"}
              strokeDasharray={isSelected ? "0" : "5 4"}
              vectorEffect="non-scaling-stroke"
              opacity={isSelected ? "0.95" : "0.6"}
              pointerEvents="none"
              style={{ transition: "stroke 120ms, opacity 120ms" }}
            />
          );
        })}

        {/* Numeric badges on selected zones (photo space) */}
        <g transform={`translate(${PHOTO_X} 0)`} pointerEvents="none">
          {zones
            .filter((z) => selected.includes(z.id))
            .map((zone) => (
              <g key={`badge-${zone.id}`}>
                <circle
                  cx={zone.anchor.x}
                  cy={zone.anchor.y}
                  r="26"
                  fill="#BB7154"
                  fillOpacity="0.22"
                />
                <circle
                  cx={zone.anchor.x}
                  cy={zone.anchor.y}
                  r="20"
                  fill="#BB7154"
                  stroke="#fff"
                  strokeWidth="3"
                />
                <text
                  x={zone.anchor.x}
                  y={zone.anchor.y + 7}
                  textAnchor="middle"
                  fontSize="20"
                  fontWeight="700"
                  fill="#fff"
                  fontFamily="ui-sans-serif,system-ui,sans-serif"
                >
                  {selected.indexOf(zone.id) + 1}
                </text>
              </g>
            ))}
        </g>

        {/* Labels (world space) */}
        {zones.map((zone) => {
          const isSelected = selected.includes(zone.id);
          return (
            <ZoneLabel
              key={`lbl-${zone.id}`}
              zone={zone}
              viewH={viewH}
              isSelected={isSelected}
              readOnly={readOnly}
              onClick={() => !readOnly && onToggle(zone.id)}
            />
          );
        })}
      </svg>

      {/* Chip mirror below — clickable, mirrors selection. Helps when SVG
          hit-targets feel small on touch. */}
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
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
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

// Stable identity matters for the parent step forms — they re-render on
// every chip toggle elsewhere, but the heavy SVG only needs to redraw when
// `selected` actually changes. memo + default shallow compare is enough
// since `zones` and the rest of the props are module-level constants.
export const PhotoZonePicker = memo(PhotoZonePickerImpl);

// ─── Helpers ────────────────────────────────────────────────────────────────

function labelLineEnd(zone: PhotoZone, viewH: number): { x: number; y: number } {
  // Label foreignObject has its top-left at (labelX, labelY), 200×44.
  //   left side  → pill flush right, so right edge at labelX + 188
  //   right side → pill flush left, so left edge at labelX + 12
  // Add a small gap so connector doesn't visually overlap the pill.
  const labelX = (zone.placement.x / 100) * VIEW_W;
  const labelY = (zone.placement.y / 100) * viewH + 22;
  const offset = zone.placement.side === "left" ? 196 : 4;
  return { x: labelX + offset, y: labelY };
}

interface ZoneLabelProps {
  zone: PhotoZone;
  viewH: number;
  isSelected: boolean;
  readOnly: boolean;
  onClick: () => void;
}

function ZoneLabel({ zone, viewH, isSelected, readOnly, onClick }: ZoneLabelProps) {
  const x = (zone.placement.x / 100) * VIEW_W;
  const y = (zone.placement.y / 100) * viewH;
  const isLeft = zone.placement.side === "left";

  return (
    <foreignObject x={x} y={y} width="200" height="44" style={{ overflow: "visible" }}>
      <div
        className={cn(
          "flex h-full items-center",
          isLeft ? "justify-end pr-3" : "justify-start pl-3",
        )}
      >
        <button
          type="button"
          onClick={onClick}
          disabled={readOnly}
          className={cn(
            "pointer-events-auto inline-flex items-center rounded-full border bg-card/95 px-3 py-1 text-[12.5px] font-medium leading-none tracking-tight shadow-sm backdrop-blur transition-all",
            isSelected
              ? "border-[#BB7154] bg-[#FBEFE7] text-[#8C4A30] scale-[1.04] shadow-md"
              : "border-border/60 text-foreground/75 hover:border-foreground/30",
            readOnly && "cursor-default",
          )}
        >
          {zone.label}
        </button>
      </div>
    </foreignObject>
  );
}
