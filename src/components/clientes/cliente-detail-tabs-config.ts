import {
  CameraIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FileTextIcon,
  FolderOpenIcon,
  HistoryIcon,
  IdCardIcon,
  LeafIcon,
  TargetIcon,
  WandSparklesIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * Plain config module — must NOT be a Client Component, because the server
 * detail page imports `TABS` to validate the `?tab=` searchParam. RSC blocks
 * cross-boundary imports of non-component values from "use client" files,
 * which is what was crashing `parseTab()` with `TABS.find is not a function`.
 */

export type TabKey =
  | "datos"
  | "anamnesis"
  | "habitos"
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

export const TABS: ReadonlyArray<TabDefinition> = [
  { key: "datos", label: "Datos personales", icon: IdCardIcon },
  { key: "anamnesis", label: "Anamnesis", icon: ClipboardListIcon },
  { key: "habitos", label: "Hábitos", icon: LeafIcon },
  { key: "objetivos", label: "Objetivos", icon: TargetIcon },
  { key: "rutinas", label: "Rutinas asignadas", icon: WandSparklesIcon },
  { key: "pagos", label: "Plan de pagos", icon: CreditCardIcon },
  { key: "servicios", label: "Mis servicios", icon: FolderOpenIcon },
  { key: "archivos", label: "Archivos", icon: FileTextIcon },
  { key: "historial", label: "Historial", icon: HistoryIcon },
  { key: "fotos", label: "Fotos de evolución", icon: CameraIcon },
];

export function isTabKey(value: string | null | undefined): value is TabKey {
  if (!value) return false;
  return TABS.some((t) => t.key === value);
}
