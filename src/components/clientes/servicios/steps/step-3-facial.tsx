"use client";

import { Controller, useFormContext, type FieldValues } from "react-hook-form";

import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";

import { ChipMultiSelect } from "../chip-multi-select";
import { LevelScale } from "../level-scale";
import { PhotoUploader } from "../photo-uploader";
import {
  FACIAL_ACTIVES,
  FACIAL_DEVICES,
  FACIAL_PRODUCTS,
  SKIN_CONDITIONS,
  SKIN_TYPES,
} from "../catalog";
import { FacialZonePicker } from "../maps/facial-zone-picker";
import { REACTION_LABEL, type ClienteRef, type SkinReaction } from "../types";

/**
 * Step 3 — facial. Renders the facial-specific clinical fields + the
 * shared session-level meta fields (notes, recommendations, photos,
 * duration) at their visual positions. State is owned by the parent's
 * RHF form via `useFormContext`.
 *
 * Path-prefix lets the component be mounted in either:
 *   · the dialog form (`""`) — schema IS `FacialSesionFormInput`.
 *   · the wizard form (`"firstSession"`) — schema is
 *     `FacialServicioCreateFormInput`.
 * Path typing is intentionally loose (`useFormContext<any>`) because the
 * concrete form shape differs between callers; the zod schema enforces
 * correctness at submit.
 */
interface Step3FacialProps {
  cliente: ClienteRef;
  /** When the parent persisted the sesion already, photo removals splice
   *  the column server-side. */
  sessionId?: string | null;
  pathPrefix?: "" | "firstSession";
}

const REACTIONS: SkinReaction[] = [
  "sin-reaccion",
  "eritema-leve",
  "eritema-moderado",
  "reaccion-intensa",
];

export function Step3Facial({
  cliente,
  sessionId = null,
  pathPrefix = "",
}: Step3FacialProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useFormContext<FieldValues & any>();
  const p = (suffix: string) =>
    (pathPrefix ? `${pathPrefix}.${suffix}` : suffix) as never;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
        <div className="lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            Mapa facial · zonas tratadas
          </p>
          <Controller
            control={form.control}
            name={p("payload.data.zones")}
            render={({ field }) => {
              const zones = (field.value as string[]) ?? [];
              return (
                <FacialZonePicker
                  selected={zones}
                  onToggle={(id) =>
                    field.onChange(
                      zones.includes(id)
                        ? zones.filter((z) => z !== id)
                        : [...zones, id],
                    )
                  }
                />
              );
            }}
          />
        </div>

        <div className="grid content-start gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name={p("payload.data.skinType")}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-medium text-muted-foreground">
                    Tipo de piel
                  </FormLabel>
                  <select
                    value={(field.value as string) ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="">Seleccionar…</option>
                    {SKIN_TYPES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={p("payload.data.skinCondition")}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-medium text-muted-foreground">
                    Condición de la piel
                  </FormLabel>
                  <select
                    value={(field.value as string) ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="">Seleccionar…</option>
                    {SKIN_CONDITIONS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Controller
              control={form.control}
              name={p("payload.data.sensitivity")}
              render={({ field }) => (
                <LevelScale
                  label="Sensibilidad"
                  value={field.value}
                  onChange={field.onChange}
                  tone="rose"
                  scaleHints={["Tolera", "Reactiva"]}
                />
              )}
            />
            <Controller
              control={form.control}
              name={p("payload.data.acne")}
              render={({ field }) => (
                <LevelScale
                  label="Acné"
                  value={field.value}
                  onChange={field.onChange}
                  tone="copper"
                  scaleHints={["Ninguno", "Activo"]}
                />
              )}
            />
            <Controller
              control={form.control}
              name={p("payload.data.hydration")}
              render={({ field }) => (
                <LevelScale
                  label="Hidratación"
                  value={field.value}
                  onChange={field.onChange}
                  tone="sage"
                  scaleHints={["Seca", "Hidratada"]}
                />
              )}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Controller
          control={form.control}
          name={p("payload.data.products")}
          render={({ field }) => (
            <ChipMultiSelect
              label="Productos utilizados"
              options={FACIAL_PRODUCTS}
              value={(field.value as string[]) ?? []}
              onChange={field.onChange}
              tone="copper"
            />
          )}
        />
        <Controller
          control={form.control}
          name={p("payload.data.actives")}
          render={({ field }) => (
            <ChipMultiSelect
              label="Activos / principios"
              options={FACIAL_ACTIVES}
              value={(field.value as string[]) ?? []}
              onChange={field.onChange}
              tone="sage"
            />
          )}
        />
      </div>

      <Controller
        control={form.control}
        name={p("payload.data.devices")}
        render={({ field }) => (
          <ChipMultiSelect
            label="Aparatología facial usada"
            options={FACIAL_DEVICES}
            value={(field.value as string[]) ?? []}
            onChange={field.onChange}
            tone="honey"
          />
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name={p("durationMin")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
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
        <Controller
          control={form.control}
          name={p("payload.data.reaction")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Reacción posterior
              </FormLabel>
              <div className="flex flex-wrap gap-1.5">
                {REACTIONS.map((r) => {
                  const isActive = field.value === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => field.onChange(r)}
                      className={
                        isActive
                          ? "rounded-full border border-[#BB7154] bg-[#F6E0D6] px-2.5 py-1 text-[11px] font-medium text-[#8C4A30]"
                          : "rounded-full border border-border/60 bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:border-[#BB7154]/40"
                      }
                    >
                      {REACTION_LABEL[r]}
                    </button>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name={p("payload.data.protocol")}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-[11px] font-medium text-muted-foreground">
              Protocolo aplicado
            </FormLabel>
            <textarea
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              rows={2}
              placeholder="Limpieza + extracción + RF 6 pases + mascarilla calmante…"
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
            <FormLabel className="text-[11px] font-medium text-muted-foreground">
              Recomendaciones para casa
            </FormLabel>
            <textarea
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              rows={2}
              placeholder="SPF 50, no exfoliar 5 días, hidratante oil-free…"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={p("notes")}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-[11px] font-medium text-muted-foreground">
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
