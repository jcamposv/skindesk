"use client";

import { memo, useId, useState } from "react";
import { Trash2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ALTERATION_CODES,
  type AlterationCode,
  type MapaFacialPin,
} from "@/types/evaluacion";
import { cn } from "@/lib/utils";

import { FACE_VIEWBOX, FACIAL_ZONES } from "./facial-zones";

// SVG viewBox: photo is 1000x1000 centered, with 320px gutters on each side
// for labels + connector lines. The picture is anchored at (PHOTO_X, 0).
const VIEW_W = 1640;
const VIEW_H = 1000;
const PHOTO_X = 320;
const PHOTO_W = 1000;

/** Visible pin radius in photo viewBox units (0–1000). */
const PIN_RADIUS = 22;
/** Invisible square hit-area side. */
const PIN_HIT_RADIUS = 38;

interface FacialMapProps {
  value: MapaFacialPin[];
  onChange?: (next: MapaFacialPin[]) => void;
  mode: "edit" | "view";
  className?: string;
}

/**
 * Photo-based facial map with anatomical zone overlay.
 *
 * Single SVG: foto + zonas + pins + labels + líneas conectoras. Zonas y pins
 * viven en el "photo space" (0..1000) trasladado por PHOTO_X. Labels sit en
 * el "world space" (0..1640) usando coords pre-calculadas.
 *
 * Edit mode: select an alteration code, click a face zone to drop a pin.
 * View mode: render-only, no interaction.
 */
function FacialMapImpl({ value, onChange, mode, className }: FacialMapProps) {
  const [activeCode, setActiveCode] = useState<AlterationCode | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const uid = useId();

  const isEdit = mode === "edit";
  const editingPin = value.find((p) => p.id === editingPinId);

  function getPhotoCoords(
    e: React.MouseEvent<SVGSVGElement>,
  ): { x: number; y: number } | null {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    // Translate world coords back into photo coords (0..1000).
    const x = local.x - PHOTO_X;
    const y = local.y;
    if (x < 0 || x > PHOTO_W || y < 0 || y > FACE_VIEWBOX) return null;
    return { x: Math.round(x), y: Math.round(y) };
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!isEdit || !activeCode || !onChange) return;
    const coords = getPhotoCoords(e);
    if (!coords) return;
    const next: MapaFacialPin = {
      id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x: coords.x,
      y: coords.y,
      code: activeCode,
    };
    onChange([...value, next]);
  }

  function handlePinClick(e: React.MouseEvent, pinId: string) {
    e.stopPropagation();
    if (!isEdit) return;
    setEditingPinId(pinId === editingPinId ? null : pinId);
  }

  function updatePinNote(pinId: string, note: string) {
    if (!onChange) return;
    onChange(value.map((p) => (p.id === pinId ? { ...p, note } : p)));
  }

  function deletePin(pinId: string) {
    if (!onChange) return;
    onChange(value.filter((p) => p.id !== pinId));
    setEditingPinId(null);
  }

  return (
    <div className={cn("grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]", className)}>
      {/* === Photo + zones + labels (single SVG) ======================= */}
      <div>
        <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#F4EFE8] via-[#ECE3D5] to-[#DFD3C2] p-2 shadow-sm ring-1 ring-border/30">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
            className={cn(
              "block h-auto w-full select-none",
              isEdit && activeCode ? "cursor-crosshair" : "cursor-default",
            )}
            onClick={handleSvgClick}
            role="img"
            aria-label="Mapa facial · vista frontal con zonas anatómicas"
          >
            <defs>
              {/* Soft vignette over the photo */}
              <radialGradient
                id={`${uid}-vignette`}
                cx="50%"
                cy="48%"
                r="60%"
              >
                <stop offset="70%" stopColor="#000" stopOpacity="0" />
                <stop offset="100%" stopColor="#000" stopOpacity="0.16" />
              </radialGradient>
              {/* Mask so the photo is rounded */}
              <clipPath id={`${uid}-photo-clip`}>
                <rect
                  x={PHOTO_X}
                  y="0"
                  width={PHOTO_W}
                  height={FACE_VIEWBOX}
                  rx="20"
                  ry="20"
                />
              </clipPath>
            </defs>

            {/* Photo */}
            <g clipPath={`url(#${uid}-photo-clip)`}>
              <image
                href="/evaluaciones/face-base.png"
                x={PHOTO_X}
                y="0"
                width={PHOTO_W}
                height={FACE_VIEWBOX}
                preserveAspectRatio="xMidYMid slice"
              />
              <rect
                x={PHOTO_X}
                y="0"
                width={PHOTO_W}
                height={FACE_VIEWBOX}
                fill={`url(#${uid}-vignette)`}
              />
            </g>

            {/* Zones (in photo space, translated by PHOTO_X) */}
            <g transform={`translate(${PHOTO_X} 0)`}>
              {FACIAL_ZONES.map((zone) => {
                const isHovered = hoveredZone === zone.id;
                const isCodeActive = isEdit && activeCode != null;
                return (
                  <path
                    key={zone.id}
                    d={zone.path}
                    fill={
                      isHovered
                        ? "rgba(187,113,84,0.22)"
                        : isCodeActive
                          ? "rgba(92,110,108,0.05)"
                          : "transparent"
                    }
                    stroke={
                      isHovered
                        ? "#BB7154"
                        : isCodeActive
                          ? "rgba(92,110,108,0.55)"
                          : "transparent"
                    }
                    strokeWidth={isHovered ? "3" : "1.4"}
                    strokeDasharray={isHovered ? "0" : "8 6"}
                    vectorEffect="non-scaling-stroke"
                    onMouseEnter={() => isEdit && setHoveredZone(zone.id)}
                    onMouseLeave={() => isEdit && setHoveredZone(null)}
                    pointerEvents={isEdit ? "all" : "none"}
                    style={{ transition: "fill 120ms, stroke 120ms" }}
                  />
                );
              })}
            </g>

            {/* Connector lines (world space) */}
            {FACIAL_ZONES.map((zone) => {
              const isHovered = hoveredZone === zone.id;
              const anchor = {
                x: zone.anchor.x + PHOTO_X,
                y: zone.anchor.y,
              };
              const labelEnd = labelLineEnd(zone);
              return (
                <line
                  key={`line-${zone.id}`}
                  x1={labelEnd.x}
                  y1={labelEnd.y}
                  x2={anchor.x}
                  y2={anchor.y}
                  stroke={isHovered ? "#BB7154" : "#94908A"}
                  strokeWidth={isHovered ? "2.4" : "1.4"}
                  strokeDasharray={isHovered ? "0" : "5 4"}
                  vectorEffect="non-scaling-stroke"
                  opacity={isHovered ? "0.95" : "0.55"}
                  pointerEvents="none"
                  style={{ transition: "stroke 120ms, opacity 120ms" }}
                />
              );
            })}

            {/* Existing pins (in photo space) */}
            <g transform={`translate(${PHOTO_X} 0)`}>
              {value.map((pin) => {
                const isEditing = pin.id === editingPinId;
                return (
                  <g
                    key={pin.id}
                    onClick={(e) => handlePinClick(e, pin.id)}
                    className={isEdit ? "cursor-pointer" : "cursor-default"}
                  >
                    <rect
                      x={pin.x - PIN_HIT_RADIUS}
                      y={pin.y - PIN_HIT_RADIUS}
                      width={PIN_HIT_RADIUS * 2}
                      height={PIN_HIT_RADIUS * 2}
                      fill="transparent"
                      pointerEvents={isEdit ? "all" : "none"}
                    />
                    <circle
                      cx={pin.x}
                      cy={pin.y}
                      r={PIN_RADIUS + 8}
                      fill="#BB7154"
                      fillOpacity="0.22"
                      pointerEvents="none"
                    />
                    <circle
                      cx={pin.x}
                      cy={pin.y}
                      r={PIN_RADIUS}
                      fill="#BB7154"
                      fillOpacity={isEditing ? "1" : "0.95"}
                      stroke="#fff"
                      strokeWidth="3"
                      pointerEvents="none"
                    />
                    <text
                      x={pin.x}
                      y={pin.y + 7}
                      textAnchor="middle"
                      fontSize="20"
                      fontWeight="700"
                      fill="#fff"
                      pointerEvents="none"
                      fontFamily="ui-sans-serif,system-ui,sans-serif"
                    >
                      {pin.code}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Labels (world space) */}
            {FACIAL_ZONES.map((zone) => {
              const isHovered = hoveredZone === zone.id;
              return (
                <ZoneLabel
                  key={`lbl-${zone.id}`}
                  zone={zone}
                  isHovered={isHovered}
                  onHoverChange={(h) =>
                    isEdit && setHoveredZone(h ? zone.id : null)
                  }
                />
              );
            })}
          </svg>
        </div>

        <p className="mt-3 text-center text-sm font-medium text-foreground/80">
          {isEdit && activeCode ? (
            <>
              Toca una zona para anotar
              <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-[#BB7154] px-2 py-0.5 text-xs font-bold text-white">
                {activeCode}
              </span>
            </>
          ) : isEdit ? (
            "Seleccioná un código clínico → toca la zona indicada"
          ) : (
            "Mapa de alteraciones de la sesión"
          )}
        </p>
      </div>

      {/* === Right column ============================================= */}
      <div>
        {isEdit && editingPin ? (
          <PinEditor
            pin={editingPin}
            onClose={() => setEditingPinId(null)}
            onChangeNote={(note) => updatePinNote(editingPin.id, note)}
            onDelete={() => deletePin(editingPin.id)}
          />
        ) : (
          <Legend
            mode={mode}
            value={value}
            activeCode={activeCode}
            onSelectCode={(c) => setActiveCode(c)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Memoized export. The map is heavy (foreignObject labels per zone, pin
 * SVGs, IntersectionObserver-style hover), and lives inside RHF-driven
 * forms that re-render on every keystroke. Only `value` (pins) and `mode`
 * change render output; `onChange` callback identity is stable enough for
 * default shallow comparison.
 */
export const FacialMap = memo(FacialMapImpl);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute where the connector line ends at the inner edge of the label. */
function labelLineEnd(zone: (typeof FACIAL_ZONES)[number]): {
  x: number;
  y: number;
} {
  // Label `foreignObject` has its top-left at (labelX, labelY) in world space,
  // is 200 wide × 44 tall. The visible pill is anchored to the inner edge:
  // - left-side label → pill sits at `justify-end`, so right edge at labelX+188
  // - right-side label → pill sits at `justify-start`, so left edge at labelX+12
  // We add a small gap so the connector doesn't visually overlap the pill.
  const labelX = (zone.placement.x / 100) * VIEW_W;
  const labelY = (zone.placement.y / 100) * VIEW_H + 22; // bias to label vertical center
  const offset = zone.placement.side === "left" ? 196 : 4;
  return { x: labelX + offset, y: labelY };
}

// ─── Zone label component (rendered as SVG <foreignObject>) ─────────────────

interface ZoneLabelProps {
  zone: (typeof FACIAL_ZONES)[number];
  isHovered: boolean;
  onHoverChange: (h: boolean) => void;
}

function ZoneLabel({ zone, isHovered, onHoverChange }: ZoneLabelProps) {
  // Label sits in world coords. We use `<foreignObject>` so the pill is
  // crisp HTML text that respects the system font, instead of <svg><text>.
  const x = (zone.placement.x / 100) * VIEW_W;
  const y = (zone.placement.y / 100) * VIEW_H;
  const isLeft = zone.placement.side === "left";

  return (
    <foreignObject
      x={isLeft ? x : x}
      y={y}
      width="200"
      height="44"
      style={{ overflow: "visible" }}
    >
      <div
        // foreignObject HTML must use plain HTML attrs (xmlns is fine to omit
        // in modern browsers); Tailwind classes work as expected.
        className={cn(
          "flex h-full items-center",
          isLeft ? "justify-end pr-3" : "justify-start pl-3",
        )}
      >
        <button
          type="button"
          onMouseEnter={() => onHoverChange(true)}
          onMouseLeave={() => onHoverChange(false)}
          onFocus={() => onHoverChange(true)}
          onBlur={() => onHoverChange(false)}
          className={cn(
            "pointer-events-auto inline-flex items-center rounded-full border bg-card/95 px-3 py-1 text-[12.5px] font-medium leading-none tracking-tight shadow-sm backdrop-blur transition-all",
            isHovered
              ? "border-[#BB7154] bg-[#FBEFE7] text-[#8C4A30] scale-[1.04] shadow-md"
              : "border-border/60 text-foreground/75 hover:border-foreground/30",
          )}
        >
          {zone.label}
        </button>
      </div>
    </foreignObject>
  );
}

// ─── Right column: legend ──────────────────────────────────────────────────

interface LegendProps {
  mode: "edit" | "view";
  value: MapaFacialPin[];
  activeCode: AlterationCode | null;
  onSelectCode: (code: AlterationCode | null) => void;
}

function Legend({ mode, value, activeCode, onSelectCode }: LegendProps) {
  const isEdit = mode === "edit";
  const usedCodes = new Set(value.map((p) => p.code));

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/80">
          {isEdit ? "Selecciona un código" : "Códigos en el mapa"}
        </p>
        {isEdit && activeCode ? (
          <button
            type="button"
            onClick={() => onSelectCode(null)}
            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs font-semibold text-foreground/75 transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            <XIcon className="size-3" /> Soltar
          </button>
        ) : null}
      </header>

      <div
        role="radiogroup"
        aria-label="Códigos de alteraciones"
        className="grid grid-cols-1 gap-1"
      >
        {ALTERATION_CODES.map(({ code, label }) => {
          const isActive = activeCode === code;
          const used = usedCodes.has(code);
          const dimmed = mode === "view" && !used;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={!isEdit}
              onClick={() => isEdit && onSelectCode(isActive ? null : code)}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                dimmed && "opacity-40",
                isEdit && "hover:bg-[#F4F1EC]/60",
                isActive && "bg-[#F4F1EC]",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white",
                  used || isActive ? "bg-[#BB7154]" : "bg-[#5C6E6C]",
                )}
              >
                {code}
              </span>
              <span
                className={cn(
                  "min-w-0 truncate text-sm",
                  isActive ? "font-semibold text-foreground" : "font-medium text-foreground/80",
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Pin editor (note + delete) ────────────────────────────────────────────

interface PinEditorProps {
  pin: MapaFacialPin;
  onClose: () => void;
  onChangeNote: (note: string) => void;
  onDelete: () => void;
}

function PinEditor({ pin, onClose, onChangeNote, onDelete }: PinEditorProps) {
  const label =
    ALTERATION_CODES.find((c) => c.code === pin.code)?.label ?? pin.code;

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-[#BB7154] text-sm font-bold text-white">
            {pin.code}
          </span>
          <div>
            <p className="text-[15px] font-semibold leading-tight text-foreground">{label}</p>
            <p className="text-xs font-medium text-foreground/70 tabular-nums">
              ({pin.x}, {pin.y})
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Cerrar editor"
        >
          <XIcon className="size-4" />
        </button>
      </header>

      <label className="text-sm font-semibold text-foreground/85">
        Nota clínica (opcional)
      </label>
      <textarea
        value={pin.note ?? ""}
        onChange={(e) => onChangeNote(e.target.value)}
        rows={3}
        placeholder="Detalles, severidad, observaciones…"
        className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />

      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2Icon className="size-3.5" />
          Eliminar pin
        </Button>
      </div>
    </div>
  );
}
