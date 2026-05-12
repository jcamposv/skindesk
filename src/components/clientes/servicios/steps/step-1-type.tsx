"use client";

import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  SERVICE_TYPE_LABEL,
  SERVICE_TYPE_TAGLINE,
  type ServiceType,
} from "../types";
import { SERVICE_VISUAL } from "../service-type-visual";

interface Step1Props {
  value: ServiceType | null;
  onChange: (next: ServiceType) => void;
}

const ORDER: ServiceType[] = ["facial", "corporal", "laser", "other"];

/**
 * Step 1 — pick the service type. Big, finger-friendly tiles because this is
 * the only step where the operator can't keep typing — they have to commit
 * to a category. Each tile is a distinct visual identity so future muscle
 * memory hits: rose = facial, sage = corporal, honey = laser, copper = other.
 */
export function Step1Type({ value, onChange }: Step1Props) {
  return (
    <div className="grid gap-3">
      <div>
        <h3 className="font-heading text-base font-medium tracking-tight">
          ¿Qué tipo de servicio querés agregar?
        </h3>
        <p className="text-[12.5px] text-muted-foreground">
          Cada tipo de servicio tiene su propio mapa, parámetros y campos clínicos.
        </p>
      </div>
      <ul role="radiogroup" className="grid gap-2 sm:grid-cols-2">
        {ORDER.map((type) => {
          const visual = SERVICE_VISUAL[type];
          const Icon = visual.icon;
          const isSelected = value === type;
          return (
            <li key={type}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onChange(type)}
                className={cn(
                  "group relative flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB7154]/30",
                  isSelected
                    ? "border-[#BB7154] bg-[#FBEFE7]/40 shadow-md"
                    : "border-border/60 bg-card hover:border-[#BB7154]/40 hover:bg-[#FBEFE7]/20",
                )}
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-105",
                    visual.iconBg,
                    visual.iconColor,
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-foreground">
                    {SERVICE_TYPE_LABEL[type]}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
                    {SERVICE_TYPE_TAGLINE[type]}
                  </span>
                </span>
                {isSelected ? (
                  <span
                    aria-hidden
                    className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-[#BB7154] text-white shadow-sm"
                  >
                    <CheckIcon className="size-3" />
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
