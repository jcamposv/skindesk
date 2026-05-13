import {
  BeakerIcon,
  DropletIcon,
  LayersIcon,
  type LucideIcon,
  ScanFaceIcon,
  SunIcon,
  ThermometerIcon,
  Wand2Icon,
} from "lucide-react";

import type { AtlasSection } from "@/schemas/atlas.schema";

/** Section-to-icon mapping. Kept next to the labels so the reader landing,
 *  sidebar tabs and breadcrumbs all show the same affordance. */
export const ATLAS_SECTION_ICONS: Record<AtlasSection, LucideIcon> = {
  biotipos: ScanFaceIcon,
  estados_cutaneos: ThermometerIcon,
  fitzpatrick: SunIcon,
  glogau: LayersIcon,
  piramide_skincare: DropletIcon,
  principios_activos: BeakerIcon,
  compatibilidad_activos: Wand2Icon,
};

/** Brand-tinted background + foreground colour per section. Uses the
 *  palette tokens from globals.css; values map to balsam / dusty-rose /
 *  artemis-honey / muted-aquatone / warm-copper. */
export const ATLAS_SECTION_TONES: Record<
  AtlasSection,
  { bg: string; fg: string }
> = {
  biotipos: { bg: "bg-[#EAE6DC]", fg: "text-[#5C6E6C]" },
  estados_cutaneos: { bg: "bg-[#F3DCD9]", fg: "text-[#A1645F]" },
  fitzpatrick: { bg: "bg-[#F6E5C5]", fg: "text-[#8E6628]" },
  glogau: { bg: "bg-[#E2EAE4]", fg: "text-[#4F6A5C]" },
  piramide_skincare: { bg: "bg-[#E7E2D5]", fg: "text-[#5C6E6C]" },
  principios_activos: { bg: "bg-[#F2E2D8]", fg: "text-[#A56146]" },
  compatibilidad_activos: { bg: "bg-[#E3E0D6]", fg: "text-[#67746E]" },
};
