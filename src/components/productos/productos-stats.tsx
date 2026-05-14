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
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {cards.map(({ label, value, icon: Icon, color }) => (
        <Card key={label} className="flex items-center gap-3 p-4">
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-full",
              color,
            )}
          >
            <Icon className="size-5" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="font-heading text-xl font-medium tabular-nums">
              {value}
            </p>
          </div>
        </Card>
      ))}
    </section>
  );
}
