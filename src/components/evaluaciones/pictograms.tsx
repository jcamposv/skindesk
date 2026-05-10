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

    // ─── CICATRICES ──────────────────────────────────────────────────────
    case "scar-icepick":
      // Estrecha + profunda: V profunda
      return (
        <>
          <path
            d="M6 30 L 24 30 L 30 50 L 36 30 L 58 30"
            fill="none"
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path d="M6 30 L 24 30" stroke={STROKE_LIGHT} strokeWidth="0.8" />
          <path d="M36 30 L 58 30" stroke={STROKE_LIGHT} strokeWidth="0.8" />
        </>
      );
    case "scar-rolling":
      // Ondulaciones suaves
      return (
        <>
          <path
            d="M6 32 Q 16 22, 22 32 Q 28 42, 34 32 Q 40 22, 46 32 Q 52 42, 58 32"
            fill="none"
            stroke={STROKE}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      );
    case "scar-boxcar":
      // Rectangulares con bordes verticales
      return (
        <>
          <path
            d="M6 30 L 18 30 L 18 44 L 30 44 L 30 30 L 42 30 L 42 44 L 54 44 L 54 30 L 58 30"
            fill="none"
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="miter"
            strokeLinecap="round"
          />
        </>
      );
    case "scar-keloid":
      // Elevada sobre la piel (cresta hacia arriba)
      return (
        <>
          <path
            d="M6 38 L 22 38 Q 28 22, 32 22 Q 36 22, 42 38 L 58 38"
            fill={FILL_BG}
            stroke={STROKE}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="M22 38 Q 28 22, 32 22 Q 36 22, 42 38"
            fill={ACCENT}
            fillOpacity="0.25"
            stroke="none"
          />
        </>
      );
  }
}
