import {
  CalendarPlusIcon,
  PackageIcon,
  RouteIcon,
  SparklesIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProductosStats } from "@/services/productos.service";

interface ProductosStatsProps {
  stats: ProductosStats;
}

/** Top-of-page stat strip. Pure server component — no state. */
export function ProductosStatsStrip({ stats }: ProductosStatsProps) {
  const cards: Array<{
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }> = [
    {
      label: "Productos en catálogo",
      value: stats.totalActive,
      icon: PackageIcon,
      color: "text-[#5C6E6C] bg-[#E7ECEA]",
    },
    {
      label: "Categorías activas",
      value: stats.activeCategories,
      icon: SparklesIcon,
      color: "text-[#8C4A30] bg-[#F6E0D6]",
    },
    {
      label: "Agregados esta semana",
      value: stats.addedThisWeek,
      icon: CalendarPlusIcon,
      color: "text-[#7C5E1F] bg-[#F8EFD7]",
    },
    {
      label: "Usados en rutinas",
      value: stats.usedInRoutines,
      icon: RouteIcon,
      color: "text-[#7B3D3D] bg-[#F8EAE9]",
    },
  ];

  return (
    <section
      aria-label="Resumen del catálogo"
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
    >
      {cards.map(({ label, value, icon: Icon, color }) => (
        <Card
          key={label}
          size="sm"
          className="flex flex-row items-center gap-2.5 px-3 py-2"
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              color,
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/75">
              {label}
            </p>
            <p className="font-heading text-lg font-semibold tabular-nums text-foreground">
              {value}
            </p>
          </div>
        </Card>
      ))}
    </section>
  );
}
