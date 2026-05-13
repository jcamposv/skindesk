"use client";

import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { CATALOG, type CatalogItem } from "../catalog";
import { SERVICE_TYPE_LABEL, type ServiceType } from "../types";
import { SERVICE_VISUAL } from "../service-type-visual";

interface Step2Props {
  serviceType: ServiceType;
  value: string | null;
  onChange: (key: string, item: CatalogItem) => void;
}

/**
 * Step 2 — pick the specific service from the catalog of the chosen type.
 * Catalog is just mock data living in `catalog.ts`; in the real product
 * each tenant would have its own customisable catalog.
 */
export function Step2Catalog({ serviceType, value, onChange }: Step2Props) {
  const items = CATALOG[serviceType];
  const visual = SERVICE_VISUAL[serviceType];

  return (
    <div className="grid gap-3">
      <div>
        <h3 className="font-heading text-base font-medium tracking-tight">
          Elegí el servicio de {SERVICE_TYPE_LABEL[serviceType].toLowerCase()}
        </h3>
        <p className="text-[12.5px] text-muted-foreground">
          Catálogo personalizable. Si no está aquí, puedes crearlo desde Configuración.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const isSelected = value === item.key;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onChange(item.key, item)}
                className={cn(
                  "relative flex w-full items-start gap-2.5 rounded-xl border-2 p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB7154]/30",
                  isSelected
                    ? "border-[#BB7154] bg-[#FBEFE7]/40 shadow-sm"
                    : "border-border/60 bg-card hover:border-[#BB7154]/40 hover:bg-[#FBEFE7]/20",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                    visual.iconBg,
                    visual.iconColor,
                  )}
                  aria-hidden
                >
                  <span className="text-[10px] font-bold">
                    {item.defaultSessions}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[12.5px] font-semibold text-foreground">
                      {item.name}
                    </span>
                    {item.isPostOp ? (
                      <span className="inline-flex items-center rounded-full bg-[#F8EAE9] px-1.5 py-0.5 text-[9px] font-medium text-[#7B3D3D]">
                        Post-op
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {item.description}
                  </span>
                  <span className="mt-1 block text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    Sugerido · {item.defaultSessions} sesiones
                  </span>
                </span>
                {isSelected ? (
                  <span
                    aria-hidden
                    className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-[#BB7154] text-white"
                  >
                    <CheckIcon className="size-2.5" />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
