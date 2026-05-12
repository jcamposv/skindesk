"use client";

import {
  Controller,
  useFormContext,
  useWatch,
  type FieldValues,
} from "react-hook-form";

import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { cn } from "@/lib/utils";

import { LASER_EQUIPMENT } from "../catalog";
import { LaserZonePicker } from "../maps/laser-zone-picker";
import { LevelScale } from "../level-scale";
import { PhotoUploader } from "../photo-uploader";
import {
  BODY_SILHOUETTE_BACK,
  LASER_MAP_ZONES_BACK,
} from "../maps/zones";
import { ZoneMap } from "../maps/zone-map";
import {
  REACTION_LABEL,
  type ClienteRef,
  type LaserDiagnosis,
  type SkinReaction,
} from "../types";

interface Step3LaserProps {
  cliente: ClienteRef;
  sessionId?: string | null;
  pathPrefix?: "" | "firstSession";
  /** Initial step (creating the service) needs the diagnosis block; per-session
   *  add flows already have the diagnosis fixed on the service, so they hide it. */
  showDiagnosis?: boolean;
}

const REACTIONS: SkinReaction[] = [
  "sin-reaccion",
  "eritema-leve",
  "eritema-moderado",
  "reaccion-intensa",
];

const FITZPATRICK: LaserDiagnosis["fitzpatrick"][] = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
];

/**
 * Step 3 — láser. RHF-bound; see header docstring on `Step3Facial`.
 * Has two sub-blocks: the initial diagnosis (fixed on the servicio) and the
 * session itself with per-shot clinical params (fluence, pulse width, etc.).
 * Body map switches between Front / Back via `payload.data.view`.
 */
export function Step3Laser({
  cliente,
  sessionId = null,
  pathPrefix = "",
  showDiagnosis = true,
}: Step3LaserProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useFormContext<FieldValues & any>();
  const p = (suffix: string) =>
    (pathPrefix ? `${pathPrefix}.${suffix}` : suffix) as never;

  const view =
    (useWatch({ control: form.control, name: p("payload.data.view") }) as
      | "front"
      | "back"
      | undefined) ?? "front";

  return (
    <div className="grid gap-4">
      {showDiagnosis ? <DiagnosisBlock pathPrefix={pathPrefix} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
        <div className="lg:sticky lg:top-0 lg:self-start">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
              Zonas tratadas
            </p>
            <Controller
              control={form.control}
              name={p("payload.data.view")}
              render={({ field }) => (
                <div className="inline-flex overflow-hidden rounded-full border border-border/60 bg-card text-[11px]">
                  {(["front", "back"] as const).map((v) => {
                    const isActive = (field.value ?? "front") === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => field.onChange(v)}
                        className={cn(
                          "px-3 py-1 transition-colors",
                          isActive
                            ? "bg-[#BB7154] text-white"
                            : "text-muted-foreground hover:bg-muted/40",
                        )}
                      >
                        {v === "front" ? "Frente" : "Espalda"}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>
          <Controller
            control={form.control}
            name={p("payload.data.zones")}
            render={({ field }) => {
              const zones = (field.value as string[]) ?? [];
              const toggle = (id: string) =>
                field.onChange(
                  zones.includes(id)
                    ? zones.filter((z) => z !== id)
                    : [...zones, id],
                );
              return view === "front" ? (
                <LaserZonePicker selected={zones} onToggle={toggle} />
              ) : (
                <ZoneMap
                  variant="body"
                  silhouette={BODY_SILHOUETTE_BACK}
                  zones={LASER_MAP_ZONES_BACK}
                  selected={zones}
                  onToggle={toggle}
                />
              );
            }}
          />
        </div>

        <div className="grid content-start gap-3">
          <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            Parámetros de la sesión
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name={p("payload.data.fluence")}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-medium text-muted-foreground">
                    Fluencia (J/cm²)
                  </FormLabel>
                  <Input
                    value={(field.value as string) ?? ""}
                    onChange={field.onChange}
                    placeholder="28 J/cm²"
                    className="h-9"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={p("payload.data.pulseWidth")}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-medium text-muted-foreground">
                    Ancho de pulso (ms)
                  </FormLabel>
                  <Input
                    value={(field.value as string) ?? ""}
                    onChange={field.onChange}
                    placeholder="30 ms"
                    className="h-9"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={p("payload.data.wavelength")}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-medium text-muted-foreground">
                    Longitud de onda (nm)
                  </FormLabel>
                  <Input
                    value={(field.value as string) ?? ""}
                    onChange={field.onChange}
                    placeholder="808 nm"
                    className="h-9"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={p("payload.data.shotCount")}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-medium text-muted-foreground">
                    Conteo de disparos
                  </FormLabel>
                  <Input
                    value={(field.value as string) ?? ""}
                    onChange={field.onChange}
                    placeholder="400"
                    className="h-9"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={p("payload.data.powerLevel")}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-medium text-muted-foreground">
                    Nivel de potencia
                  </FormLabel>
                  <Input
                    value={(field.value as string) ?? ""}
                    onChange={field.onChange}
                    placeholder="Medio · alto"
                    className="h-9"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={p("payload.data.reductionPct")}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-medium text-muted-foreground">
                    % reducción estimada
                  </FormLabel>
                  <Input
                    value={(field.value as string) ?? ""}
                    onChange={field.onChange}
                    placeholder="20"
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
            <Controller
              control={form.control}
              name={p("payload.data.pain")}
              render={({ field }) => (
                <LevelScale
                  label="Dolor"
                  value={field.value}
                  onChange={field.onChange}
                  tone="rose"
                  scaleHints={["Sin dolor", "Intenso"]}
                />
              )}
            />
          </div>

          <Controller
            control={form.control}
            name={p("payload.data.reaction")}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-medium text-muted-foreground">
                  Reacción cutánea
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
      </div>

      <FormField
        control={form.control}
        name={p("payload.data.nextParams")}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-[11px] font-medium text-muted-foreground">
              Parámetros recomendados para próxima sesión
            </FormLabel>
            <textarea
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              rows={2}
              placeholder="Subir a 30 J/cm² si tolera. Sumar pasada en eje pelvis…"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={p("payload.data.postCare")}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-[11px] font-medium text-muted-foreground">
              Cuidados post-tratamiento
            </FormLabel>
            <textarea
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              rows={2}
              placeholder="Aloe vera, SPF 50, no exponer al sol 7 días…"
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
              Recomendaciones
            </FormLabel>
            <textarea
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              rows={2}
              placeholder="Indicaciones para la clienta…"
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

function DiagnosisBlock({
  pathPrefix,
}: {
  pathPrefix: "" | "firstSession";
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useFormContext<FieldValues & any>();
  // Diagnosis lives on the servicio (root of the wizard form), NOT inside the
  // session payload. Even when the session block is mounted with
  // `pathPrefix="firstSession"`, diagnosis paths stay at the root.
  const dx = (suffix: string) =>
    (pathPrefix ? `laserDiagnosis.${suffix}` : `laserDiagnosis.${suffix}`) as never;
  // ^ kept symmetric on purpose — both wizard (pathPrefix="firstSession") and
  //   any future caller resolve `laserDiagnosis.*` at the root.

  return (
    <div className="grid gap-3 rounded-xl border border-[#D2A96A]/30 bg-[#F8EFD7]/30 p-4">
      <p className="text-[10.5px] font-medium uppercase tracking-wider text-[#7C5E1F]">
        Diagnóstico inicial · una vez por servicio
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Controller
          control={form.control}
          name={dx("fitzpatrick")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Fototipo Fitzpatrick
              </FormLabel>
              <div className="flex flex-wrap gap-1">
                {FITZPATRICK.map((f) => {
                  const isActive = field.value === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => field.onChange(f)}
                      className={cn(
                        "h-8 min-w-8 rounded-md border px-2 text-[11px] font-semibold transition-colors",
                        isActive
                          ? "border-[#BB7154] bg-[#F6E0D6] text-[#8C4A30]"
                          : "border-border/60 bg-card text-muted-foreground hover:border-[#BB7154]/40",
                      )}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={dx("equipment")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Equipo láser
              </FormLabel>
              <select
                value={(field.value as string) ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Seleccionar equipo…</option>
                {LASER_EQUIPMENT.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={dx("hairColor")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Color del vello
              </FormLabel>
              <Input
                value={(field.value as string) ?? ""}
                onChange={field.onChange}
                placeholder="Castaño oscuro / negro"
                className="h-9"
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={dx("hairThickness")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] font-medium text-muted-foreground">
                Grosor del vello
              </FormLabel>
              <select
                value={(field.value as string) ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Seleccionar…</option>
                <option value="fino">Fino</option>
                <option value="medio">Medio</option>
                <option value="grueso">Grueso</option>
              </select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name={dx("contraindications")}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-[11px] font-medium text-muted-foreground">
              Contraindicaciones / antecedentes
            </FormLabel>
            <textarea
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              rows={2}
              placeholder="Embarazo, fotosensibilizantes, tatuajes en la zona…"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={dx("observations")}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-[11px] font-medium text-muted-foreground">
              Observaciones iniciales
            </FormLabel>
            <textarea
              value={(field.value as string) ?? ""}
              onChange={field.onChange}
              rows={2}
              placeholder="Foliculitis previa, vellos encarnados, manchas…"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
