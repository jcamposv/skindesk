/**
 * Inline minimal SVG pictograms for clinical concepts that text alone doesn't
 * convey well — acne grades and scar types. Each pictogram is a stylised
 * cross-section / surface representation aligned with cosmetología teaching
 * material (no raster, no emoji).
 *
 * 64×64 viewBox, monochrome stroke + sparing fill in copper accent.
 */

import { cn } from "@/lib/utils";

export type PictogramName =
  // Acné grades (skin surface profile + lesions)
  | "acne-1"
  | "acne-2"
  | "acne-3"
  | "acne-4"
  // Scar types (cross-section)
  | "scar-icepick"
  | "scar-rolling"
  | "scar-boxcar"
  | "scar-keloid";

interface PictogramProps {
  name: PictogramName;
  className?: string;
}

const STROKE = "#7B3D3D";
const STROKE_LIGHT = "#A6735A";
const FILL_BG = "#FBEFE7";
const ACCENT = "#BB7154";
// Solid peach silhouette used for the scar block pictograms — matches the
// dermatology cross-section reference the client signed off on.
const SCAR_PEACH = "#F4CDA0";

export function Pictogram({ name, className }: PictogramProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("block", className)}
      role="img"
      aria-label={name}
    >
      {renderPicto(name)}
    </svg>
  );
}

function renderPicto(name: PictogramName) {
  switch (name) {
    // ─── ACNÉ ────────────────────────────────────────────────────────────
    case "acne-1":
      // Comedones: piel plana + 3 puntos (pequeños)
      return (
        <>
          <rect x="6" y="22" width="52" height="28" rx="6" fill={FILL_BG} stroke={STROKE_LIGHT} strokeWidth="1.5" />
          <circle cx="20" cy="34" r="2" fill={ACCENT} opacity="0.7" />
          <circle cx="34" cy="40" r="1.7" fill={ACCENT} opacity="0.7" />
          <circle cx="46" cy="32" r="2.2" fill={ACCENT} opacity="0.7" />
        </>
      );
    case "acne-2":
      // Pápulas + pústulas: leves bumps en la piel
      return (
        <>
          <rect x="6" y="22" width="52" height="28" rx="6" fill={FILL_BG} stroke={STROKE_LIGHT} strokeWidth="1.5" />
          <path d="M14 32 q4 -6 8 0" fill="none" stroke={STROKE} strokeWidth="1.5" />
          <path d="M28 36 q3 -5 6 0" fill="none" stroke={STROKE} strokeWidth="1.5" />
          <path d="M42 30 q4 -7 8 0" fill="none" stroke={STROKE} strokeWidth="1.5" />
          <circle cx="18" cy="32" r="3" fill={ACCENT} opacity="0.85" />
          <circle cx="46" cy="30" r="2.5" fill={ACCENT} opacity="0.6" />
        </>
      );
    case "acne-3":
      // Lesiones extensas con nódulos
      return (
        <>
          <rect x="6" y="22" width="52" height="28" rx="6" fill={FILL_BG} stroke={STROKE_LIGHT} strokeWidth="1.5" />
          <path d="M12 32 q5 -8 10 0" fill="none" stroke={STROKE} strokeWidth="1.7" />
          <path d="M24 36 q5 -7 10 0" fill="none" stroke={STROKE} strokeWidth="1.7" />
          <path d="M40 32 q5 -9 10 0" fill="none" stroke={STROKE} strokeWidth="1.7" />
          <circle cx="17" cy="32" r="4" fill={ACCENT} />
          <circle cx="29" cy="36" r="3.5" fill={ACCENT} opacity="0.85" />
          <circle cx="45" cy="32" r="4.5" fill={ACCENT} />
        </>
      );
    case "acne-4":
      // Nódulos, quistes, severo
      return (
        <>
          <rect x="6" y="22" width="52" height="28" rx="6" fill={FILL_BG} stroke={STROKE_LIGHT} strokeWidth="1.5" />
          <path d="M10 30 q6 -10 12 0" fill="none" stroke={STROKE} strokeWidth="2" />
          <path d="M22 36 q7 -10 14 0" fill="none" stroke={STROKE} strokeWidth="2" />
          <path d="M40 28 q7 -12 14 0" fill="none" stroke={STROKE} strokeWidth="2" />
          <circle cx="16" cy="30" r="5" fill={ACCENT} />
          <circle cx="29" cy="36" r="4.5" fill={ACCENT} />
          <circle cx="47" cy="28" r="5.5" fill={ACCENT} />
          <circle cx="35" cy="44" r="3" fill={ACCENT} opacity="0.7" />
        </>
      );

    // ─── CICATRICES (perfil de bloque dérmico con corte/elevación) ──────
    // Single-path silhouettes: the skin block is a rounded rect; the top
    // edge dips (icepick / rolling / boxcar) or bulges (keloid) to convey
    // the scar profile in one solid peach shape — no stroke, no overlay.
    case "scar-icepick":
      return (
        <path
          d="M8 14 L24 14 L32 48 L40 14 L56 14 A4 4 0 0 1 60 18 L60 54 A4 4 0 0 1 56 58 L8 58 A4 4 0 0 1 4 54 L4 18 A4 4 0 0 1 8 14 Z"
          fill={SCAR_PEACH}
        />
      );
    case "scar-rolling":
      return (
        <path
          d="M8 14 L22 14 A10 10 0 0 0 42 14 L56 14 A4 4 0 0 1 60 18 L60 54 A4 4 0 0 1 56 58 L8 58 A4 4 0 0 1 4 54 L4 18 A4 4 0 0 1 8 14 Z"
          fill={SCAR_PEACH}
        />
      );
    case "scar-boxcar":
      return (
        <path
          d="M8 14 L20 14 L20 32 L44 32 L44 14 L56 14 A4 4 0 0 1 60 18 L60 54 A4 4 0 0 1 56 58 L8 58 A4 4 0 0 1 4 54 L4 18 A4 4 0 0 1 8 14 Z"
          fill={SCAR_PEACH}
        />
      );
    case "scar-keloid":
      return (
        <path
          d="M8 14 L22 14 A10 10 0 0 1 42 14 L56 14 A4 4 0 0 1 60 18 L60 54 A4 4 0 0 1 56 58 L8 58 A4 4 0 0 1 4 54 L4 18 A4 4 0 0 1 8 14 Z"
          fill={SCAR_PEACH}
        />
      );
  }
}
