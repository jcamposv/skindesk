import {
  CalendarPlusIcon,
  PackageIcon,
  RouteIcon,
  SparklesIcon,
} from "lucide-react";

import { StatStrip, type StatStripItem } from "@/components/shared/stat-strip";
import type { ProductosStats } from "@/services/productos.service";

interface ProductosStatsProps {
  stats: ProductosStats;
}

/** Top-of-page stat strip. Pure server component — no state. */
export function ProductosStatsStrip({ stats }: ProductosStatsProps) {
  const items: StatStripItem[] = [
    {
      label: "Productos en catálogo",
      value: stats.totalActive,
      icon: PackageIcon,
      colorClass: "text-[#5C6E6C] bg-[#E7ECEA]",
    },
    {
      label: "Categorías activas",
      value: stats.activeCategories,
      icon: SparklesIcon,
      colorClass: "text-[#8C4A30] bg-[#F6E0D6]",
    },
    {
      label: "Agregados esta semana",
      value: stats.addedThisWeek,
      icon: CalendarPlusIcon,
      colorClass: "text-[#7C5E1F] bg-[#F8EFD7]",
    },
    {
      label: "Usados en rutinas",
      value: stats.usedInRoutines,
      icon: RouteIcon,
      colorClass: "text-[#7B3D3D] bg-[#F8EAE9]",
    },
  ];

  return <StatStrip items={items} ariaLabel="Resumen del catálogo" />;
}
