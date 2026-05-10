import {
  CameraIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  FileTextIcon,
  FolderOpenIcon,
  HistoryIcon,
  IdCardIcon,
  TargetIcon,
  WandSparklesIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * Plain config module — must NOT be a Client Component, because the server
 * detail page imports `TABS` to validate the `?tab=` searchParam. RSC blocks
 * cross-boundary imports of non-component values from "use client" files.
 */

export type TabKey =
  | "datos"
  | "evaluacion"
  | "objetivos"
  | "rutinas"
  | "pagos"
  | "servicios"
  | "archivos"
  | "historial"
  | "fotos";

export interface TabDefinition {
  key: TabKey;
  label: string;
  icon: LucideIcon;
}

export interface TabGroup {
  /** Visible label rendered as a small header above the group items. */
  label: string;
  tabs: TabDefinition[];
}

/**
 * Tabs are organised in three semantic groups. Order within each group is
 * by clinical priority (Datos → Evaluación → Objetivos for Clínico, etc).
 * Labels were trimmed from the previous "Plan de pagos" / "Mis servicios" /
 * "Fotos de evolución" / "Rutinas asignadas" wording — single-word tabs
 * read faster in the rail.
 */
export const TAB_GROUPS: ReadonlyArray<TabGroup> = [
  {
    label: "Clínico",
    tabs: [
      { key: "datos", label: "Datos personales", icon: IdCardIcon },
      { key: "evaluacion", label: "Evaluación", icon: ClipboardCheckIcon },
      { key: "objetivos", label: "Objetivos", icon: TargetIcon },
    ],
  },
  {
    label: "Operativo",
    tabs: [
      { key: "rutinas", label: "Rutinas", icon: WandSparklesIcon },
      { key: "servicios", label: "Servicios", icon: FolderOpenIcon },
      { key: "pagos", label: "Pagos", icon: CreditCardIcon },
    ],
  },
  {
    label: "Histórico",
    tabs: [
      { key: "archivos", label: "Archivos", icon: FileTextIcon },
      { key: "historial", label: "Historial", icon: HistoryIcon },
      { key: "fotos", label: "Fotos", icon: CameraIcon },
    ],
  },
];

/** Flattened list — used for `?tab=` validation and tablist iteration. */
export const TABS: ReadonlyArray<TabDefinition> = TAB_GROUPS.flatMap(
  (g) => g.tabs,
);

export function isTabKey(value: string | null | undefined): value is TabKey {
  if (!value) return false;
  return TABS.some((t) => t.key === value);
}
