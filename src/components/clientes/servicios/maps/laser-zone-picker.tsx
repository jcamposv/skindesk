"use client";

import { PhotoZonePicker, type PhotoZone } from "./photo-zone-picker";

/**
 * Laser-depilation zones calibrated to /public/servicios/laser-base.png
 * (844×1500, transparent PNG, front view with arms raised so the axillas
 * are exposed — the classic clinical pose for láser).
 *
 * The picker normalises the photo to 1000-wide × ~1777-tall photo-space.
 * All zone paths and anchors live in that space.
 *
 * Back-only zones (espalda, glúteos, piernas-back) still ship via the
 * stylised SVG fallback inside `step-3-laser.tsx` — there's no back photo.
 */
export const LASER_PHOTO_ASPECT = 844 / 1500;

export const LASER_PICKER_ZONES_FRONT: PhotoZone[] = [
  {
    id: "bozo",
    label: "Bozo / labio sup.",
    path: "M 455 480 Q 500 472 545 480 Q 540 505 500 510 Q 460 505 455 480 Z",
    anchor: { x: 500, y: 495 },
    placement: { x: 78, y: 22, side: "right" },
  },
  {
    id: "rostro-menton",
    label: "Rostro / mentón",
    path: "M 425 520 Q 500 508 575 520 Q 585 590 500 605 Q 415 590 425 520 Z",
    anchor: { x: 500, y: 560 },
    placement: { x: 4, y: 28, side: "left" },
  },
  {
    id: "axilas",
    label: "Axilas",
    // Both armpits — clearly visible because arms are raised.
    path:
      "M 335 625 Q 380 615 420 625 Q 420 690 380 705 Q 340 695 335 660 Z " +
      "M 580 625 Q 620 615 665 625 Q 660 695 620 705 Q 580 690 580 660 Z",
    anchor: { x: 380, y: 665 },
    placement: { x: 4, y: 37, side: "left" },
  },
  {
    id: "brazos-laser",
    label: "Brazos / antebrazos",
    // Raised arms: roughly trapezoidal strips from shoulder up to hand.
    path:
      "M 210 150 L 360 140 L 365 580 L 280 590 Z " +
      "M 640 140 L 790 150 L 720 590 L 635 580 Z",
    anchor: { x: 280, y: 380 },
    placement: { x: 78, y: 18, side: "right" },
  },
  {
    id: "linea-alba",
    label: "Línea alba / abdomen",
    path:
      "M 410 870 Q 500 855 590 870 Q 605 980 580 1050 Q 500 1080 420 1050 Q 395 980 410 870 Z",
    anchor: { x: 500, y: 970 },
    placement: { x: 78, y: 52, side: "right" },
  },
  {
    id: "bikini",
    label: "Bikini / inglés",
    path:
      "M 350 1090 Q 500 1075 650 1090 Q 655 1230 500 1290 Q 345 1230 350 1090 Z",
    anchor: { x: 500, y: 1180 },
    placement: { x: 4, y: 65, side: "left" },
  },
  {
    id: "piernas-completas",
    label: "Piernas completas",
    // Upper thighs visible at the bottom of the photo — the label conveys
    // the full-leg intent even though we only see the upper portion.
    path:
      "M 280 1320 Q 380 1340 470 1360 L 460 1777 L 240 1777 Z " +
      "M 540 1360 Q 620 1340 720 1320 L 760 1777 L 540 1777 Z",
    anchor: { x: 380, y: 1500 },
    placement: { x: 78, y: 78, side: "right" },
  },
];

interface LaserZonePickerProps {
  selected: string[];
  onToggle: (id: string) => void;
  readOnly?: boolean;
  className?: string;
}

/**
 * Photo-based **front** zone picker for depilación láser. Used by the
 * "Frente" tab in step 3. The "Espalda" tab still uses the stylised SVG
 * fallback because there's no back-view photo.
 */
export function LaserZonePicker({
  selected,
  onToggle,
  readOnly,
  className,
}: LaserZonePickerProps) {
  return (
    <PhotoZonePicker
      photoSrc="/servicios/laser-base.png"
      photoAlt="Mapa láser · vista frontal con axilas expuestas"
      photoAspect={LASER_PHOTO_ASPECT}
      zones={LASER_PICKER_ZONES_FRONT}
      selected={selected}
      onToggle={onToggle}
      readOnly={readOnly}
      surface="plain"
      className={className}
    />
  );
}
