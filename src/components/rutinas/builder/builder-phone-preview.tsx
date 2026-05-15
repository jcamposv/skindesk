"use client";

import { useMemo } from "react";
import Image from "next/image";
import { DownloadIcon, MoonIcon, SunIcon } from "lucide-react";

import { ProductoIllustration } from "@/components/productos/producto-illustration";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  PRODUCTO_ABSORPTION_LABELS,
  PRODUCTO_ABSORPTION_TIMES,
} from "@/schemas/productos.schema";
import {
  dbEnumToForm,
  estimateRutinaMinutes,
  type RutinaMomento,
} from "@/schemas/rutinas.schema";

import type { BuilderStep } from "./types";

interface BuilderPhonePreviewProps {
  name: string;
  clientName: string | null;
  momento: RutinaMomento;
  skinType: string;
  steps: BuilderStep[];
  /** Persisted rutina id — enables the "Descargar PDF" CTA. Null while the
   *  rutina hasn't been saved yet; the button stays disabled in that case. */
  rutinaId: string | null;
}

/** Right column — mobile phone mockup showing the clienta's view in real
 *  time. Pure read-only rendering; the parent state drives every pixel. */
export function BuilderPhonePreview({
  name,
  clientName,
  momento,
  skinType,
  steps,
  rutinaId,
}: BuilderPhonePreviewProps) {
  const minutes = useMemo(
    () =>
      estimateRutinaMinutes(
        steps.map((s) => ({
          customAbsorptionTime: s.customAbsorptionTime,
          productoAbsorptionTime: s.producto.absorptionTime,
        })),
      ),
    [steps],
  );

  return (
    <aside className="flex h-full min-h-0 flex-col bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground/80">
          Vista de la clienta
        </h2>
        <p className="mt-0.5 text-xs font-medium text-foreground/65">
          Así lo verá en su portal
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto w-[240px] rounded-[30px] bg-foreground p-0.5 shadow-[0_10px_36px_rgba(0,0,0,0.13)]">
          <div className="overflow-hidden rounded-[28px] bg-[#FAF8F5]">
            {/* Notch */}
            <div className="flex h-7 items-end justify-center rounded-t-[26px] bg-foreground pb-1">
              <span className="h-3 w-[70px] rounded-md bg-foreground" />
            </div>

            <div className="space-y-2 p-3">
              {/* Header card */}
              <div className="rounded-[12px] bg-gradient-to-br from-[#5C6E6C] to-[#3F504D] p-3 text-white">
                <p className="text-[9px] uppercase tracking-wider text-white/60">
                  Tu rutina personalizada
                </p>
                <p className="mt-0.5 font-heading text-[15px] font-medium leading-tight">
                  {name || "Sin nombre"}
                </p>
                <p className="mt-0.5 text-[9.5px] text-white/70">
                  {clientName ? `${clientName} · ` : ""}
                  {skinType ? `Piel ${skinType}` : "Tipo de piel sin definir"}
                </p>
                <div className="mt-2 flex gap-1">
                  <MomentPill
                    icon={SunIcon}
                    label="Mañana"
                    active={momento === "am" || momento === "both"}
                  />
                  <MomentPill
                    icon={MoonIcon}
                    label="Noche"
                    active={momento === "pm" || momento === "both"}
                  />
                </div>
              </div>

              {/* Steps */}
              {steps.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-[10.5px] text-muted-foreground">
                  Agregá productos para ver la vista previa de tu clienta.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {steps.map((s, i) => (
                    <PhoneStep
                      key={`${s.id || "new"}-${i}`}
                      step={s}
                      index={i}
                    />
                  ))}
                </div>
              )}

              {steps.length > 0 ? (
                <p className="pt-1 text-center text-[9px] text-muted-foreground">
                  {steps.length}{" "}
                  {steps.length === 1 ? "paso" : "pasos"} · {minutes} min aprox.
                </p>
              ) : null}

              {rutinaId ? (
                <Button
                  type="button"
                  variant="cta"
                  size="sm"
                  className="w-full gap-1.5 text-[10.5px]"
                  render={
                    <a
                      href={`${ROUTES.rutinas}/${rutinaId}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <DownloadIcon className="size-3" />
                  Descargar PDF
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-[10.5px]"
                  disabled
                  title="Guardá la rutina para habilitar la descarga"
                >
                  <DownloadIcon className="size-3" />
                  Descargar PDF
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

interface MomentPillProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}

function MomentPill({ icon: Icon, label, active }: MomentPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8.5px] font-medium",
        active
          ? "bg-white/95 text-[#3F504D]"
          : "bg-white/15 text-white/70",
      )}
    >
      <Icon className="size-2.5" />
      {label}
    </span>
  );
}

function PhoneStep({ step, index }: { step: BuilderStep; index: number }) {
  const absorption =
    dbEnumToForm(step.customAbsorptionTime, PRODUCTO_ABSORPTION_TIMES) ||
    dbEnumToForm(step.producto.absorptionTime, PRODUCTO_ABSORPTION_TIMES) ||
    "sin_espera";
  return (
    <div className="flex items-center gap-1.5 rounded-[10px] border bg-card p-2">
      <span
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white",
          "bg-gradient-to-br from-[#5C6E6C] to-[#4F605C]",
        )}
      >
        {index + 1}
      </span>
      <div className="relative size-7 shrink-0 overflow-hidden rounded-md border bg-[#F4F1EC]">
        {step.producto.photoUrl ? (
          <Image
            src={step.producto.photoUrl}
            alt=""
            fill
            sizes="28px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-0.5">
            <ProductoIllustration category={step.producto.category} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[9.5px] font-semibold leading-tight">
          {step.producto.name}
        </p>
        <p className="truncate text-[8.5px] text-muted-foreground">
          {step.producto.brand || "—"}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-[#E7ECEA] px-1.5 py-0.5 text-[8px] font-bold text-[#4F605C]">
        ⏱ {PRODUCTO_ABSORPTION_LABELS[absorption] ?? "—"}
      </span>
    </div>
  );
}
