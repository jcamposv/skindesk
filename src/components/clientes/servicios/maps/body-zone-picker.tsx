"use client";

import { PhotoZonePicker, type PhotoZone } from "./photo-zone-picker";

/**
 * Body zones calibrated to /public/servicios/body-base.png — a 800×1200
 * transparent PNG (front view, subject centered, head → upper thigh).
 *
 * Photo aspect: 800/1200 = 0.6667.
 *
 * The picker normalises the photo to a 1000-wide × 1500-tall photo-space.
 * All zone paths live in that space.
 *
 * Zones only cover anatomy visible in the photo. Back-only zones (espalda,
 * glúteos) and lower legs (rodillas, pantorrillas) need a separate
 * back-view photo — out of scope for this mock.
 */
export const BODY_PHOTO_ASPECT = 800 / 1200;

export const BODY_PICKER_ZONES: PhotoZone[] = [
  {
    id: "brazos",
    label: "Brazos",
    // Left arm (upper + forearm) + right arm. Subject's arms hang naturally
    // from shoulders (y~450) to mid-thigh (y~1150).
    path:
      "M 200 480 L 320 460 L 330 1140 L 220 1160 Z " +
      "M 680 460 L 800 480 L 780 1160 L 670 1140 Z",
    anchor: { x: 280, y: 800 },
    placement: { x: 4, y: 35, side: "left" },
  },
  {
    id: "cintura",
    label: "Cintura",
    path: "M 380 720 Q 500 705 620 720 L 615 820 Q 500 835 385 820 Z",
    anchor: { x: 500, y: 770 },
    placement: { x: 78, y: 42, side: "right" },
  },
  {
    id: "flancos",
    label: "Flancos",
    // Narrow side strips of the torso just below the ribs.
    path:
      "M 340 620 Q 360 720 385 760 L 385 830 Q 360 830 335 780 Z " +
      "M 660 620 Q 640 720 615 760 L 615 830 Q 640 830 665 780 Z",
    anchor: { x: 355, y: 720 },
    placement: { x: 4, y: 50, side: "left" },
  },
  {
    id: "abdomen",
    label: "Abdomen",
    // Mid-belly, between the bikini top and bikini bottom.
    path:
      "M 385 830 Q 500 850 615 830 Q 625 920 600 970 Q 500 990 400 970 Q 375 920 385 830 Z",
    anchor: { x: 500, y: 905 },
    placement: { x: 78, y: 60, side: "right" },
  },
  {
    id: "muslos",
    label: "Muslos",
    // Upper thighs — visible from y~1280 down to the bottom edge.
    path:
      "M 340 1280 Q 410 1300 460 1340 L 460 1500 L 300 1500 L 320 1290 Z " +
      "M 540 1340 Q 590 1300 660 1280 L 680 1290 L 700 1500 L 540 1500 Z",
    anchor: { x: 440, y: 1430 },
    placement: { x: 4, y: 92, side: "left" },
  },
];

interface BodyZonePickerProps {
  selected: string[];
  onToggle: (id: string) => void;
  readOnly?: boolean;
  className?: string;
}

/**
 * Photo-based body zone picker for "Corporales". Same UX as the facial
 * picker — click a zone or chip to toggle. Uses the transparent PNG so the
 * cream card background shows through (no harsh photo-studio edge).
 */
export function BodyZonePicker({
  selected,
  onToggle,
  readOnly,
  className,
}: BodyZonePickerProps) {
  return (
    <PhotoZonePicker
      photoSrc="/servicios/body-base.png"
      photoAlt="Mapa corporal · vista frontal con zonas anatómicas"
      photoAspect={BODY_PHOTO_ASPECT}
      zones={BODY_PICKER_ZONES}
      selected={selected}
      onToggle={onToggle}
      readOnly={readOnly}
      surface="plain"
      className={className}
    />
  );
}
