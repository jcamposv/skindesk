import {
  ScanFaceIcon,
  SparklesIcon,
  WavesIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

import type { ServiceStatus, ServiceType } from "./types";

interface ServiceVisual {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  ringColor: string;
  badge: string;
}

/**
 * Per-type icon + palette so the cards feel different at a glance:
 *  · facial → rose (skin tone)
 *  · corporal → sage (clinical / wellness)
 *  · laser → honey (warm warning, machine-driven)
 *  · other → copper (catch-all, brand-matching)
 */
export const SERVICE_VISUAL: Record<ServiceType, ServiceVisual> = {
  facial: {
    icon: ScanFaceIcon,
    iconBg: "bg-[#F8EAE9]",
    iconColor: "text-[#7B3D3D]",
    ringColor: "ring-[#C58F8A]/30",
    badge: "bg-[#F8EAE9] text-[#7B3D3D] border-[#C58F8A]/30",
  },
  corporal: {
    icon: WavesIcon,
    iconBg: "bg-[#E7ECEA]",
    iconColor: "text-[#4F605C]",
    ringColor: "ring-[#5C6E6C]/30",
    badge: "bg-[#E7ECEA] text-[#4F605C] border-[#5C6E6C]/30",
  },
  laser: {
    icon: ZapIcon,
    iconBg: "bg-[#F8EFD7]",
    iconColor: "text-[#7C5E1F]",
    ringColor: "ring-[#D2A96A]/30",
    badge: "bg-[#F8EFD7] text-[#7C5E1F] border-[#D2A96A]/30",
  },
  other: {
    icon: SparklesIcon,
    iconBg: "bg-[#F6E0D6]",
    iconColor: "text-[#8C4A30]",
    ringColor: "ring-[#BB7154]/30",
    badge: "bg-[#F6E0D6] text-[#8C4A30] border-[#BB7154]/30",
  },
};

export const STATUS_VISUAL: Record<
  ServiceStatus,
  { label: string; classes: string; dot: string }
> = {
  active: {
    label: "Activo",
    classes: "bg-[#E7ECEA] text-[#4F605C] border-[#5C6E6C]/30",
    dot: "bg-[#5C6E6C]",
  },
  paused: {
    label: "En pausa",
    classes: "bg-[#F8EFD7] text-[#7C5E1F] border-[#D2A96A]/30",
    dot: "bg-[#D2A96A]",
  },
  completed: {
    label: "Completado",
    classes: "bg-[#F6E0D6] text-[#8C4A30] border-[#BB7154]/30",
    dot: "bg-[#BB7154]",
  },
  cancelled: {
    label: "Cancelado",
    classes:
      "bg-muted/60 text-muted-foreground border-border/60 line-through decoration-muted-foreground/50",
    dot: "bg-muted-foreground/60",
  },
};
