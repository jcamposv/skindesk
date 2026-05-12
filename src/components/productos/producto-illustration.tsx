import { cn } from "@/lib/utils";
import type { ProductoCategoria } from "@/schemas/productos.schema";

/**
 * Category-specific SVG illustration used as the fallback when a product
 * has no photo. The stroke palette is fixed (sage + copper accents) so the
 * card stays visually quiet and the photo cards "pop" by contrast.
 *
 * All illustrations share a 64×80 viewBox so they swap cleanly without
 * shifting the card layout.
 */
interface ProductoIllustrationProps {
  category: ProductoCategoria;
  className?: string;
}

const STROKE = "#5C6E6C"; // sage
const ACCENT = "#BB7154"; // copper
const FILL = "#E7ECEA"; // sage-50

export function ProductoIllustration({
  category,
  className,
}: ProductoIllustrationProps) {
  return (
    <svg
      viewBox="0 0 64 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("h-full w-full", className)}
    >
      {SHAPES[category]({ stroke: STROKE, fill: FILL, accent: ACCENT })}
    </svg>
  );
}

type ShapeArgs = { stroke: string; fill: string; accent: string };
type ShapeFn = (a: ShapeArgs) => React.ReactElement;

// Tiny illustration set — each shape uses the same 3-colour palette.
// The visuals are intentionally minimal: silhouettes, no fills inside the
// bottle, so the card chrome stays calm.
const SHAPES: Record<ProductoCategoria, ShapeFn> = {
  serum: ({ stroke, fill, accent }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      {/* Dropper bottle */}
      <rect x="20" y="22" width="24" height="48" rx="4" fill={fill} stroke={stroke} />
      <rect x="24" y="10" width="16" height="14" rx="2" stroke={stroke} />
      <line x1="32" y1="4" x2="32" y2="10" stroke={accent} strokeWidth="2.5" />
      <circle cx="32" cy="4" r="2" fill={accent} stroke="none" />
      <line x1="26" y1="36" x2="38" y2="36" stroke={stroke} />
    </g>
  ),
  hidratante: ({ stroke, fill }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      {/* Wide jar */}
      <rect x="14" y="22" width="36" height="48" rx="4" fill={fill} stroke={stroke} />
      <rect x="18" y="14" width="28" height="10" rx="2" stroke={stroke} fill={fill} />
      <line x1="22" y1="40" x2="42" y2="40" stroke={stroke} />
    </g>
  ),
  limpiador: ({ stroke, fill, accent }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      {/* Pump bottle */}
      <rect x="20" y="24" width="24" height="46" rx="3" fill={fill} stroke={stroke} />
      <rect x="26" y="14" width="12" height="10" rx="2" stroke={stroke} fill={fill} />
      <line x1="32" y1="6" x2="32" y2="14" stroke={accent} strokeWidth="2" />
      <line x1="28" y1="6" x2="36" y2="6" stroke={accent} strokeWidth="2" />
    </g>
  ),
  spf: ({ stroke, fill, accent }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      {/* Sunscreen tube */}
      <path d="M22 18 L42 18 L40 72 L24 72 Z" fill={fill} stroke={stroke} />
      <rect x="24" y="10" width="16" height="8" rx="2" stroke={stroke} />
      <circle cx="32" cy="44" r="6" stroke={accent} strokeWidth="2" fill="none" />
      <line x1="32" y1="34" x2="32" y2="36" stroke={accent} strokeWidth="2" />
      <line x1="32" y1="52" x2="32" y2="54" stroke={accent} strokeWidth="2" />
      <line x1="22" y1="44" x2="24" y2="44" stroke={accent} strokeWidth="2" />
      <line x1="40" y1="44" x2="42" y2="44" stroke={accent} strokeWidth="2" />
    </g>
  ),
  mascarilla: ({ stroke, fill }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      {/* Mask jar — short and wide */}
      <rect x="12" y="32" width="40" height="36" rx="6" fill={fill} stroke={stroke} />
      <rect x="16" y="22" width="32" height="10" rx="2" stroke={stroke} fill={fill} />
      <path d="M22 50 Q32 56 42 50" stroke={stroke} fill="none" />
    </g>
  ),
  tonico: ({ stroke, fill, accent }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      {/* Spray bottle */}
      <rect x="20" y="24" width="24" height="46" rx="3" fill={fill} stroke={stroke} />
      <path d="M26 14 L38 14 L40 24 L24 24 Z" stroke={stroke} fill={fill} />
      <path d="M40 18 L48 18" stroke={stroke} />
      <line x1="48" y1="14" x2="48" y2="22" stroke={accent} strokeWidth="2" />
    </g>
  ),
  contorno_ojos: ({ stroke, fill, accent }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      {/* Tiny tube */}
      <path d="M24 22 L40 22 L38 70 L26 70 Z" fill={fill} stroke={stroke} />
      <rect x="26" y="14" width="12" height="8" rx="2" stroke={stroke} />
      <circle cx="32" cy="46" r="3" fill={accent} stroke="none" />
    </g>
  ),
  exfoliante: ({ stroke, fill, accent }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      <rect x="16" y="22" width="32" height="48" rx="4" fill={fill} stroke={stroke} />
      <rect x="20" y="14" width="24" height="8" rx="2" stroke={stroke} />
      <circle cx="24" cy="40" r="1.5" fill={accent} stroke="none" />
      <circle cx="32" cy="44" r="1.5" fill={accent} stroke="none" />
      <circle cx="40" cy="38" r="1.5" fill={accent} stroke="none" />
      <circle cx="28" cy="54" r="1.5" fill={accent} stroke="none" />
      <circle cx="38" cy="56" r="1.5" fill={accent} stroke="none" />
    </g>
  ),
  regenerante: ({ stroke, fill, accent }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      <rect x="18" y="22" width="28" height="48" rx="6" fill={fill} stroke={stroke} />
      <rect x="22" y="14" width="20" height="8" rx="2" stroke={stroke} />
      <path d="M32 36 L32 54 M26 42 L38 42 M28 48 L36 48" stroke={accent} strokeWidth="2" fill="none" />
    </g>
  ),
  desmaquillante: ({ stroke, fill }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      <rect x="14" y="22" width="36" height="48" rx="4" fill={fill} stroke={stroke} />
      <rect x="18" y="12" width="28" height="10" rx="2" stroke={stroke} fill={fill} />
      <path d="M22 38 Q32 32 42 38" stroke={stroke} fill="none" />
      <path d="M22 50 Q32 44 42 50" stroke={stroke} fill="none" />
    </g>
  ),
  agua_micelar: ({ stroke, fill, accent }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      <rect x="16" y="22" width="32" height="48" rx="4" fill={fill} stroke={stroke} />
      <rect x="22" y="12" width="20" height="10" rx="2" stroke={stroke} />
      <circle cx="24" cy="50" r="2" stroke={accent} fill="none" />
      <circle cx="32" cy="42" r="2" stroke={accent} fill="none" />
      <circle cx="40" cy="52" r="2" stroke={accent} fill="none" />
    </g>
  ),
  tratamiento_especifico: ({ stroke, fill, accent }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      <rect x="20" y="22" width="24" height="48" rx="4" fill={fill} stroke={stroke} />
      <rect x="24" y="12" width="16" height="10" rx="2" stroke={stroke} />
      <path d="M28 40 L36 40 M32 36 L32 44" stroke={accent} strokeWidth="2.5" />
    </g>
  ),
  ampolleta: ({ stroke, fill, accent }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      {/* Tall thin ampoule */}
      <path d="M28 14 L36 14 L34 70 L30 70 Z" fill={fill} stroke={stroke} />
      <line x1="26" y1="14" x2="38" y2="14" stroke={stroke} />
      <line x1="32" y1="6" x2="32" y2="14" stroke={accent} strokeWidth="2.5" />
    </g>
  ),
  bruma: ({ stroke, fill, accent }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      <rect x="22" y="22" width="20" height="48" rx="3" fill={fill} stroke={stroke} />
      <rect x="26" y="14" width="12" height="8" rx="2" stroke={stroke} />
      <path d="M38 10 L48 6 M40 14 L50 12 M40 18 L50 18" stroke={accent} strokeWidth="1.5" />
    </g>
  ),
  balsamo_labios: ({ stroke, fill }) => (
    <g strokeWidth="1.5" strokeLinecap="round">
      {/* Small twist tube */}
      <rect x="24" y="28" width="16" height="42" rx="3" fill={fill} stroke={stroke} />
      <rect x="22" y="16" width="20" height="12" rx="2" stroke={stroke} fill={fill} />
      <line x1="28" y1="50" x2="36" y2="50" stroke={stroke} />
    </g>
  ),
};
