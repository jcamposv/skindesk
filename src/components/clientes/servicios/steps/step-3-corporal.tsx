"use client";

import { Controller, useFormContext, type FieldValues } from "react-hook-form";

import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";

import { ChipMultiSelect } from "../chip-multi-select";
import { LevelScale } from "../level-scale";
import { PhotoUploader } from "../photo-uploader";
import {
  CORPORAL_DEVICES,
  CORPORAL_TECHNIQUES,
  FACIAL_ACTIVES,
} from "../catalog";
import { BodyZonePicker } from "../maps/body-zone-picker";
import type { ClienteRef, LevelScore } from "../types";

interface Step3CorporalProps {
  cliente: ClienteRef;
  isPostOp: boolean;
  sessionId?: string | null;
  pathPrefix?: "" | "firstSession";
}

const EMPTY_POST_OP = {
  surgeryType: "",
  surgeryDate: "",
  doctorName: "",
  contraindications: "",
  swelling: 0 as LevelScore,
  drainageNotes: "",
};

/**
 * Step 3 — corporal. RHF-bound; see header docstring on `Step3Facial`.
 */
export function Step3Corporal({
  cliente,
  isPostOp,
  sessionId = null,
  pathPrefix = "",
}: Step3CorporalProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useFormContext<FieldValues & any>();
  const p = (suffix: string) =>
    (pathPrefix ? `${pathPrefix}.${suffix}` : suffix) as never;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
        <div className="lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            Mapa corporal · zonas tratadas
          </p>
          <Controller
            control={form.control}
            name={p("payload.data.zones")}
            render={({ field }) => {
              const zones = (field.value as string[]) ?? [];
              return (
                <BodyZonePicker
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

        <div className="grid content-start gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name={p("payload.data.measurementsBefore")}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-medium text-muted-foreground">
                    Medidas antes (cm)
                  </FormLabel>
                  <Input
                    value={(field.value as string) ?? ""}
                    onChange={field.onChange}
                    placeholder="Abdomen 92 · Cintura 78"
                    className="h-9"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={p("payload.data.measurementsAfter")}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-medium text-muted-foreground">
                    Medidas después (cm)
                  </FormLabel>
                  <Input
                    value={(field.value as string) ?? ""}
                    onChange={field.onChange}
                    placeholder="Abdomen 90 · Cintura 76"
                    className="h-9"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={p("payload.data.weight")}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-medium text-muted-foreground">
                    Peso (opcional, kg)
                  </FormLabel>
                  <Input
                    value={(field.value as string) ?? ""}
                    onChange={field.onChange}
                    placeholder="68"
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
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["pain", "Dolor", "rose", ["Sin dolor", "Intenso"]],
                ["inflammation", "Inflamación", "copper", ["Nula", "Severa"]],
                ["fibrosis", "Fibrosis", "honey", ["Nula", "Marcada"]],
                ["cellulite", "Celulitis", "copper", ["Grado 0", "Grado 4"]],
                [
                  "fluidRetention",
                  "Retención de líquidos",
                  "sage",
                  ["Nula", "Severa"],
                ],
              ] as const
            ).map(([key, label, tone, hints]) => (
              <Controller
                key={key}
                control={form.control}
                name={p(`payload.data.${key}`)}
                render={({ field }) => (
                  <LevelScale
                    label={label}
                    value={field.value}
                    onChange={field.onChange}
                    tone={tone}
                    scaleHints={hints as [string, string]}
                  />
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name={p("payload.data.technique")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Técnica utilizada
              </FormLabel>
              <select
                value={(field.value as string) ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Seleccionar…</option>
                {CORPORAL_TECHNIQUES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Controller
          control={form.control}
          name={p("payload.data.devices")}
          render={({ field }) => (
            <ChipMultiSelect
              label="Aparatología corporal"
              options={CORPORAL_DEVICES}
              value={(field.value as string[]) ?? []}
              onChange={field.onChange}
              tone="honey"
            />
          )}
        />
      </div>

      <Controller
        control={form.control}
        name={p("payload.data.productsOrActives")}
        render={({ field }) => (
          <ChipMultiSelect
            label="Productos o activos"
            options={FACIAL_ACTIVES}
            value={(field.value as string[]) ?? []}
            onChange={field.onChange}
            tone="sage"
          />
        )}
      />

      {isPostOp ? <PostOpBlock pathPrefix={pathPrefix} /> : null}

      <FormField
        control={form.control}
        name={p("payload.data.observations")}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-[11px] font-medium text-muted-foreground">
              Observaciones
            </FormLabel>
            <textarea
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              rows={2}
              placeholder="Hallazgos clínicos, respuesta al tratamiento…"
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
              Recomendaciones post-tratamiento
            </FormLabel>
            <textarea
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              rows={2}
              placeholder="Hidratación, faja, actividad física, alimentación…"
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

function PostOpBlock({
  pathPrefix,
}: {
  pathPrefix: "" | "firstSession";
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useFormContext<FieldValues & any>();
  const p = (suffix: string) =>
    (pathPrefix ? `${pathPrefix}.${suffix}` : suffix) as never;

  // Ensure the postOp sub-object exists once we render this block — RHF
  // can address sub-paths into it. The `as never` casts work around the
  // loose `any` context typing.
  const current = form.getValues(p("payload.data.postOp"));
  if (!current) {
    form.setValue(p("payload.data.postOp"), EMPTY_POST_OP as never, {
      shouldDirty: false,
      shouldTouch: false,
    });
  }

  return (
    <div className="grid gap-3 rounded-xl border border-[#D2A96A]/30 bg-[#F8EFD7]/30 p-4">
      <p className="text-[10.5px] font-medium uppercase tracking-wider text-[#7C5E1F]">
        Post-operatorio · datos clínicos
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name={p("payload.data.postOp.surgeryType")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Tipo de cirugía
              </FormLabel>
              <Input
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                placeholder="Liposucción, abdominoplastia…"
                className="h-9"
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={p("payload.data.postOp.surgeryDate")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Fecha de cirugía
              </FormLabel>
              <Input
                type="date"
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                className="h-9"
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={p("payload.data.postOp.doctorName")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Médico tratante
              </FormLabel>
              <Input
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                placeholder="Dr/a. responsable de la cirugía"
                className="h-9"
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <Controller
          control={form.control}
          name={p("payload.data.postOp.swelling")}
          render={({ field }) => (
            <LevelScale
              label="Inflamación post-op"
              value={field.value}
              onChange={field.onChange}
              tone="rose"
              scaleHints={["Nula", "Marcada"]}
            />
          )}
        />
      </div>
      <FormField
        control={form.control}
        name={p("payload.data.postOp.contraindications")}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-[11px] font-medium text-muted-foreground">
              Contraindicaciones
            </FormLabel>
            <textarea
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              rows={2}
              placeholder="Cuidados específicos, restricciones de movimiento…"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={p("payload.data.postOp.drainageNotes")}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-[11px] font-medium text-muted-foreground">
              Notas de drenaje
            </FormLabel>
            <textarea
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              rows={2}
              placeholder="Manualidad, cantidad de drenaje, técnica…"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
