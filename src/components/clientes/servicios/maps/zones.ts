/**
 * Stylised SVG zone definitions for the **back-view laser** map only.
 *
 * Front view of every type-specific map (facial, corporal, laser) now uses
 * photo-based pickers. Back view stays on the stylised SVG because there's
 * no back-view photo.
 *
 * Zones live in a normalised viewBox (0 0 240 430). Hit areas are generous
 * for touch.
 */

export interface MapZone {
  id: string;
  label: string;
  path: string;
  /** Anchor point for the label badge (in viewBox units). */
  labelAt: { x: number; y: number };
}

// ─── Laser map (back) ───────────────────────────────────────────────────────

export const LASER_MAP_ZONES_BACK: MapZone[] = [
  {
    id: "espalda-laser",
    label: "Espalda",
    path: "M85,120 Q120,110 155,120 Q160,180 120,210 Q80,180 85,120 Z",
    labelAt: { x: 120, y: 160 },
  },
  {
    id: "gluteos-laser",
    label: "Glúteos",
    path: "M85,220 Q120,212 155,220 Q160,265 120,275 Q80,265 85,220 Z",
    labelAt: { x: 120, y: 245 },
  },
  {
    id: "piernas-laser-back",
    label: "Piernas completas",
    path: "M90,280 Q120,275 150,280 Q150,360 130,400 L110,400 Q90,360 90,280 Z",
    labelAt: { x: 120, y: 340 },
  },
];

// ─── Stylised body silhouette (used as background for the back laser map) ──

export const BODY_SILHOUETTE_BACK =
  "M120,30 C140,30 152,45 152,62 C152,78 142,90 130,95 L130,110 L150,110 Q200,130 200,180 Q200,235 190,260 Q180,275 160,275 L160,295 Q170,360 160,400 L155,415 L130,415 L125,360 L120,300 L115,360 L110,415 L85,415 L80,400 Q70,360 80,295 L80,275 Q60,275 50,260 Q40,235 40,180 Q40,130 90,110 L110,110 L110,95 C98,90 88,78 88,62 C88,45 100,30 120,30 Z";
