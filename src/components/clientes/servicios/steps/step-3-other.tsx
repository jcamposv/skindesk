"use client";

import { Controller, useFormContext, type FieldValues } from "react-hook-form";

import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";

import { ChipMultiSelect } from "../chip-multi-select";
import { PhotoUploader } from "../photo-uploader";
import {
  CORPORAL_DEVICES,
  FACIAL_ACTIVES,
  FACIAL_DEVICES,
  FACIAL_PRODUCTS,
} from "../catalog";
import type { ClienteRef } from "../types";

/**
 * Step 3 — other. Formulario flexible — no mapa, sin escalas obligatorias.
 * La cosmetóloga describe el servicio libremente y elige aparatología de un
 * catálogo combinado (facial + corporal) para no encerrarla. RHF-bound; see
 * header docstring on `Step3Facial`.
 */
interface Step3OtherProps {
  cliente: ClienteRef;
  sessionId?: string | null;
  pathPrefix?: "" | "firstSession";
}

export function Step3Other({
  cliente,
  sessionId = null,
  pathPrefix = "",
}: Step3OtherProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useFormContext<FieldValues & any>();
  const p = (suffix: string) =>
    (pathPrefix ? `${pathPrefix}.${suffix}` : suffix) as never;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name={p("payload.data.category")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-foreground/80">
                Categoría libre
              </FormLabel>
              <Input
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                placeholder="Microblading, micropuntura, tratamiento mixto…"
                className="h-9"
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={p("payload.data.objective")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-foreground/80">
                Objetivo principal
              </FormLabel>
              <Input
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                placeholder="Aclarar manchas, mejorar textura…"
                className="h-9"
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={p("payload.data.treatedArea")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-foreground/80">
                Zona tratada
              </FormLabel>
              <Input
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                placeholder="Rostro, cuello, manos, busto…"
                className="h-9"
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={p("durationMin")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-foreground/80">
                Duración (min)
              </FormLabel>
              <NumericInput
                value={(field.value as number) ?? null}
                onChange={(n) => field.onChange(n ?? 0)}
                min={0}
                max={600}
                placeholder="60"
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name={p("payload.data.protocolNotes")}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-semibold text-foreground/80">
              Protocolo aplicado
            </FormLabel>
            <textarea
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              rows={3}
              placeholder="Pasos, tiempos y productos en orden de aplicación…"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Controller
          control={form.control}
          name={p("payload.data.products")}
          render={({ field }) => (
            <ChipMultiSelect
              label="Productos / activos"
              options={[...FACIAL_PRODUCTS, ...FACIAL_ACTIVES]}
              value={(field.value as string[]) ?? []}
              onChange={field.onChange}
              tone="sage"
            />
          )}
        />
        <Controller
          control={form.control}
          name={p("payload.data.devices")}
          render={({ field }) => (
            <ChipMultiSelect
              label="Aparatología"
              options={[...FACIAL_DEVICES, ...CORPORAL_DEVICES]}
              value={(field.value as string[]) ?? []}
              onChange={field.onChange}
              tone="honey"
            />
          )}
        />
      </div>

      <FormField
        control={form.control}
        name={p("notes")}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-semibold text-foreground/80">
              Notas de sesión
            </FormLabel>
            <textarea
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              rows={2}
              placeholder="Observaciones técnicas internas…"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={p("recommendations")}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-semibold text-foreground/80">
              Recomendaciones para casa
            </FormLabel>
            <textarea
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              rows={2}
              placeholder="Cuidados, productos a usar/evitar, horarios…"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Controller
          control={form.control}
          name={p("beforePaths")}
          render={({ field }) => (
            <PhotoUploader
              label="Fotos antes"
              paths={(field.value as string[]) ?? []}
              onChange={field.onChange}
              tenantId={cliente.tenantId}
              clienteId={cliente.clienteId}
              sessionId={sessionId}
              tone="before"
            />
          )}
        />
        <Controller
          control={form.control}
          name={p("afterPaths")}
          render={({ field }) => (
            <PhotoUploader
              label="Fotos después"
              paths={(field.value as string[]) ?? []}
              onChange={field.onChange}
              tenantId={cliente.tenantId}
              clienteId={cliente.clienteId}
              sessionId={sessionId}
              tone="after"
            />
          )}
        />
      </div>
    </div>
  );
}
