"use client";

import { FACIAL_ZONES } from "@/components/evaluaciones/facial-zones";

import { PhotoZonePicker, type PhotoZone } from "./photo-zone-picker";

/**
 * Re-exported list of facial zones (sourced from evaluaciones so labels,
 * positions and ids stay 1:1 across the app). Anywhere a service surface
 * needs to look up a zone label (history sheet, future report views), it
 * imports from here.
 */
export const FACIAL_PICKER_ZONES: PhotoZone[] = FACIAL_ZONES.map((z) => ({
  id: z.id,
  label: z.label,
  path: z.path,
  anchor: z.anchor,
  placement: z.placement,
}));

interface FacialZonePickerProps {
  selected: string[];
  onToggle: (id: string) => void;
  readOnly?: boolean;
  className?: string;
}

/**
 * Toggle-based facial map for the "Mis servicios" surface. Reuses the same
 * photo + anatomical zones as the evaluación map so the cosmetóloga sees
 * the exact same face in both flows.
 */
export function FacialZonePicker({
  selected,
  onToggle,
  readOnly,
  className,
}: FacialZonePickerProps) {
  return (
    <PhotoZonePicker
      photoSrc="/evaluaciones/face-base.png"
      photoAlt="Mapa facial · vista frontal con zonas anatómicas"
      photoAspect={1}
      zones={FACIAL_PICKER_ZONES}
      selected={selected}
      onToggle={onToggle}
      readOnly={readOnly}
      surface="plain"
      className={className}
    />
  );
}
