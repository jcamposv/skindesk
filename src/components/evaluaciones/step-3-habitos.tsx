"use client";

import { useMemo, useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import {
  ActivityIcon,
  CheckIcon,
  ChevronDownIcon,
  CigaretteIcon,
  MoonIcon,
  SaladIcon,
  SparklesIcon,
  SunIcon,
  VenusIcon,
  WineIcon,
  type LucideIcon,
} from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import {
  ALIMENTACION_OPCIONES,
  ANTICONCEPTIVOS,
  SUPLEMENTOS,
} from "@/types/evaluacion";
import { cn } from "@/lib/utils";

import { SectionCard } from "@/components/shared/section-card";
import { useEvaluacionForm } from "./evaluacion-form-context";
import type { EvaluacionFormValues } from "./evaluacion-form-context";

type SubTab = "vida" | "piel";

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: "vida", label: "Estilo de vida" },
  { id: "piel", label: "Hábitos de piel" },
];

export function Step3Habitos() {
  const { form } = useEvaluacionForm();
  // Watch only the fields driving the sub-tab "done" indicators. Watching
  // the whole `habitos` object made every keystroke re-render the entire
  // step (1000+ lines).
  const [
    alimentacion,
    digestion,
    litrosAgua,
    actividadHace,
    fuma,
    alcohol,
    drogas,
    lacteos,
    suplementos,
    exposicionSolar,
    usaSpf,
    lavadosDia,
    maquillaje,
    cicatrizacion,
    rutinaAm,
    rutinaPm,
  ] = useWatch({
    control: form.control,
    name: [
      "habitos.alimentacion",
      "habitos.digestion",
      "habitos.litrosAgua",
      "habitos.actividadFisica.hace",
      "habitos.fuma.si",
      "habitos.alcohol.si",
      "habitos.drogas.si",
      "habitos.lacteos.si",
      "habitos.suplementos",
      "habitos.exposicionSolar",
      "habitos.usaSpf",
      "habitos.lavadosDia",
      "habitos.maquillaje",
      "habitos.cicatrizacion",
      "habitos.rutinaAm",
      "habitos.rutinaPm",
    ],
  });

  // Sub-tab state local to step. We mount BOTH panels (CSS-hidden the inactive
  // one) so RHF state stays mounted — switching tabs is instant.
  const [tab, setTab] = useState<SubTab>("vida");

  const counts = useMemo(() => {
    const vidaDone =
      Boolean(alimentacion) ||
      Boolean(digestion) ||
      litrosAgua != null ||
      actividadHace === true ||
      fuma === true ||
      alcohol === true ||
      drogas === true ||
      lacteos === true ||
      (suplementos?.length ?? 0) > 0;
    const pielDone =
      Boolean(exposicionSolar) ||
      usaSpf === true ||
      Boolean(lavadosDia) ||
      Boolean(maquillaje) ||
      Boolean(cicatrizacion) ||
      Boolean(rutinaAm) ||
      Boolean(rutinaPm);
    return { vidaDone, pielDone };
  }, [
    alimentacion,
    digestion,
    litrosAgua,
    actividadHace,
    fuma,
    alcohol,
    drogas,
    lacteos,
    suplementos,
    exposicionSolar,
    usaSpf,
    lavadosDia,
    maquillaje,
    cicatrizacion,
    rutinaAm,
    rutinaPm,
  ]);

  return (
    <div className="grid gap-5">
      {/* Sub-tab nav: in-step segmented control */}
      <div className="rounded-xl border bg-card p-1 shadow-sm">
        <div role="tablist" className="grid grid-cols-2 gap-1">
          {SUBTABS.map((t) => {
            const active = tab === t.id;
            const done = t.id === "vida" ? counts.vidaDone : counts.pielDone;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-[#F4F1EC] text-[#5C6E6C] shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {done ? (
                  <span className="flex size-4 items-center justify-center rounded-full bg-[#5C6E6C] text-white">
                    <CheckIcon className="size-2.5" strokeWidth={3} />
                  </span>
                ) : null}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Vida panel */}
      <div className={tab === "vida" ? "grid gap-5" : "hidden"} role="tabpanel">
        <div className="grid gap-5 lg:grid-cols-2">
          <AlimentacionCard />
          <ActividadCard />
        </div>
        <SustanciasTabla />
        <SeccionMujerCollapsible />
      </div>

      {/* Piel panel */}
      <div className={tab === "piel" ? "grid gap-5" : "hidden"} role="tabpanel">
        <div className="grid gap-5 lg:grid-cols-2">
          <SolSpfCard />
          <LimpiezaMaquillajeCard />
        </div>
        <SkinReactivityCard />
        <RutinaFacialCard />
      </div>
    </div>
  );
}

// ─── ESTILO DE VIDA · Alimentación + agua ───────────────────────────────────

function AlimentacionCard() {
  const { form } = useEvaluacionForm();
  const alimentacion = useWatch({
    control: form.control,
    name: "habitos.alimentacion",
  }) as string | undefined;
  const digestion = useWatch({
    control: form.control,
    name: "habitos.digestion",
  }) as string | undefined;

  return (
    <SectionCard
      icon={SaladIcon}
      title="Alimentación e hidratación"
      tone="aqua"
    >
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-foreground/85">
          ¿Cómo considerás tu alimentación?
        </legend>
        {ALIMENTACION_OPCIONES.map((opt) => {
          const active = alimentacion === opt.value;
          const dotClass =
            opt.tone === "sage"
              ? opt.value === "muy_saludable"
                ? "bg-[#5C6E6C]"
                : "bg-[#A6B7AA]"
              : opt.tone === "honey"
                ? "bg-[#D2A96A]"
                : "bg-[#BB7154]";
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                form.setValue("habitos.alimentacion", opt.value, {
                  shouldDirty: true,
                })
              }
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all",
                active
                  ? "border-2 border-[#5C6E6C] bg-[#F4F1EC]"
                  : "border border-border/60 bg-card hover:border-foreground/20",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-2.5 shrink-0 rounded-full",
                  dotClass,
                  active ? "" : "opacity-70",
                )}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={
                    active
                      ? "text-[15px] font-semibold text-foreground"
                      : "text-[15px] font-medium text-foreground"
                  }
                >
                  {opt.label}
                </p>
                <p className="text-sm leading-relaxed text-foreground/75">
                  {opt.description}
                </p>
              </div>
              {active ? (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                  <CheckIcon className="size-3" />
                </span>
              ) : null}
            </button>
          );
        })}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-foreground/85">
            Digestión intestinal
          </label>
          <div className="flex gap-1.5">
            {(["buena", "regular", "mala"] as const).map((v) => (
              <Chip
                key={v}
                pressed={digestion === v}
                onPressedChange={() =>
                  form.setValue("habitos.digestion", digestion === v ? "" : v, {
                    shouldDirty: true,
                  })
                }
                size="sm"
                tone="sage"
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-foreground/85">
            Litros de agua al día
          </label>
          <Controller
            control={form.control}
            name="habitos.litrosAgua"
            render={({ field }) => (
              <Input
                type="number"
                step="0.5"
                min="0"
                max="10"
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="Ej: 1.5"
                className="h-10"
              />
            )}
          />
        </div>
      </div>
    </SectionCard>
  );
}

// ─── ESTILO DE VIDA · Actividad + suplementos ───────────────────────────────

function ActividadCard() {
  const { form } = useEvaluacionForm();
  const actividad = useWatch({
    control: form.control,
    name: "habitos.actividadFisica.hace",
  });

  const supl = (useWatch({
    control: form.control,
    name: "habitos.suplementos",
  }) ?? []) as string[];

  function toggleSupl(s: string) {
    if (supl.includes(s)) {
      form.setValue(
        "habitos.suplementos",
        supl.filter((v) => v !== s),
        { shouldDirty: true },
      );
    } else {
      form.setValue("habitos.suplementos", [...supl, s], { shouldDirty: true });
    }
  }

  return (
    <SectionCard icon={ActivityIcon} title="Actividad física y suplementos" tone="aqua">
      <div className="grid gap-2">
        <span className="text-[15px] font-semibold text-foreground">Actividad física</span>
        <Controller
          control={form.control}
          name="habitos.actividadFisica.hace"
          render={({ field }) => (
            <YesNoToggle
              value={field.value}
              onChange={field.onChange}
              size="sm"
            />
          )}
        />
        {actividad ? (
          <div className="grid gap-2 rounded-xl bg-[#FBF9F4] p-3 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="habitos.actividadFisica.cual"
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder="Yoga, gym, caminar…"
                  className="h-9"
                />
              )}
            />
            <Controller
              control={form.control}
              name="habitos.actividadFisica.frecuencia"
              render={({ field }) => (
                <div className="flex flex-wrap gap-1.5">
                  {(["1x", "2–3x", "4–5x", "Diario"] as const).map((f) => (
                    <Chip
                      key={f}
                      pressed={field.value === f}
                      onPressedChange={() =>
                        field.onChange(field.value === f ? "" : f)
                      }
                      size="sm"
                      tone="sage"
                    >
                      {f}
                    </Chip>
                  ))}
                </div>
              )}
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-foreground/85">
          Suplementos
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SUPLEMENTOS.map((s) => (
            <Chip
              key={s}
              pressed={supl.includes(s)}
              onPressedChange={() => toggleSupl(s)}
              size="sm"
              tone="sage"
            >
              {s}
            </Chip>
          ))}
        </div>
        <Controller
          control={form.control}
          name="habitos.suplementosDetalle"
          render={({ field }) => (
            <Input
              {...field}
              placeholder="Especificá los suplementos que tomás…"
              className="h-9"
            />
          )}
        />
      </div>
    </SectionCard>
  );
}

// ─── ESTILO DE VIDA · Tabla compacta de sustancias / lácteos ────────────────

interface SustanciaRowDef {
  label: string;
  icon?: LucideIcon;
  tieneName: keyof Pick<
    EvaluacionFormValues["habitos"],
    "fuma" | "alcohol" | "drogas" | "lacteos"
  >;
  detallePlaceholder: string;
}

const SUSTANCIAS_ROWS: SustanciaRowDef[] = [
  {
    label: "Tabaco",
    icon: CigaretteIcon,
    tieneName: "fuma",
    detallePlaceholder: "Frecuencia (cigarrillos por día, ocasional…)",
  },
  {
    label: "Alcohol",
    icon: WineIcon,
    tieneName: "alcohol",
    detallePlaceholder: "Frecuencia (fines de semana, diario…)",
  },
  {
    label: "Drogas",
    tieneName: "drogas",
    detallePlaceholder: "¿Cuáles?",
  },
  {
    label: "Lácteos",
    tieneName: "lacteos",
    detallePlaceholder: "¿Con qué frecuencia?",
  },
];

function SustanciasTabla() {
  return (
    <SectionCard
      icon={WineIcon}
      title="Consumo de sustancias y lácteos"
      tone="aqua"
    >
      <div className="overflow-hidden rounded-xl border border-border/60">
        <ul className="divide-y divide-border/60">
          {SUSTANCIAS_ROWS.map((row) => (
            <SustanciaRow key={row.label} row={row} />
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}

function SustanciaRow({ row }: { row: SustanciaRowDef }) {
  const { form } = useEvaluacionForm();
  const Icon = row.icon;
  const watchPath =
    row.tieneName === "fuma"
      ? "habitos.fuma.si"
      : row.tieneName === "alcohol"
        ? "habitos.alcohol.si"
        : row.tieneName === "drogas"
          ? "habitos.drogas.si"
          : "habitos.lacteos.si";
  const detallePath =
    row.tieneName === "fuma"
      ? "habitos.fuma.frecuencia"
      : row.tieneName === "alcohol"
        ? "habitos.alcohol.frecuencia"
        : row.tieneName === "drogas"
          ? "habitos.drogas.cuales"
          : "habitos.lacteos.frecuencia";

  const tiene = useWatch({ control: form.control, name: watchPath });

  return (
    <li className="grid items-center gap-3 bg-card px-3 py-2.5 sm:grid-cols-[120px_minmax(0,140px)_minmax(0,1fr)]">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="size-4 text-foreground/70" /> : null}
        <span className="text-[15px] font-semibold text-foreground">{row.label}</span>
      </div>
      <Controller
        control={form.control}
        name={watchPath}
        render={({ field }) => (
          <YesNoToggle
            value={field.value}
            onChange={field.onChange}
            size="sm"
          />
        )}
      />
      <div className={tiene ? "block" : "hidden sm:block sm:opacity-40 sm:pointer-events-none"}>
        <Controller
          control={form.control}
          name={detallePath}
          render={({ field }) => (
            <Input
              {...field}
              placeholder={row.detallePlaceholder}
              className="h-9"
              disabled={!tiene}
            />
          )}
        />
      </div>
    </li>
  );
}

// ─── ESTILO DE VIDA · Sección Mujer (collapsible) ───────────────────────────

function SeccionMujerCollapsible() {
  const { form } = useEvaluacionForm();
  const aplica = useWatch({
    control: form.control,
    name: "habitos.mujer.aplicable",
  });
  const mujer = useWatch({ control: form.control, name: "habitos.mujer" });
  const [open, setOpen] = useState(false);

  const completedCount = useMemo(() => {
    if (!mujer) return 0;
    let c = 0;
    if (mujer.edadInicioMenstruacion) c++;
    if (mujer.periodos) c++;
    if (mujer.colicos) c++;
    if (mujer.embarazos > 0) c++;
    if (mujer.embarazadaActualmente?.si === true) c++;
    if (mujer.lactancia?.si === true) c++;
    if (mujer.anticonceptivo) c++;
    return c;
  }, [mujer]);

  return (
    <SectionCard
      icon={VenusIcon}
      title="Salud hormonal y reproductiva"
      tone="rose"
      headerAccessory={
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/75">
          {aplica ? `${completedCount}/7 completadas` : "No aplica"}
        </span>
      }
    >
      <label className="flex items-center gap-2 text-[15px] font-medium text-foreground">
        <Controller
          control={form.control}
          name="habitos.mujer.aplicable"
          render={({ field }) => (
            <input
              type="checkbox"
              checked={field.value}
              onChange={(e) => {
                field.onChange(e.target.checked);
                if (e.target.checked) setOpen(true);
              }}
              className="size-4 rounded border-border accent-[#5C6E6C]"
            />
          )}
        />
        Aplica a esta clienta
      </label>

      {aplica ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center justify-between rounded-lg border border-dashed border-border/60 px-3 py-2 text-left text-sm font-medium text-foreground/75 hover:border-foreground/30 hover:bg-muted/30"
          >
            <span>
              {open ? "Cerrar sección" : "Abrir formulario completo (7 campos)"}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
          {open ? <MujerFields /> : null}
        </>
      ) : null}
    </SectionCard>
  );
}

function MujerFields() {
  const { form } = useEvaluacionForm();
  const embarazada = useWatch({
    control: form.control,
    name: "habitos.mujer.embarazadaActualmente.si",
  });
  const lactancia = useWatch({
    control: form.control,
    name: "habitos.mujer.lactancia.si",
  });
  const ae6m = useWatch({ control: form.control, name: "habitos.mujer.ae6m.si" });
  const periodos = useWatch({
    control: form.control,
    name: "habitos.mujer.periodos",
  });
  const colicos = useWatch({
    control: form.control,
    name: "habitos.mujer.colicos",
  });

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-foreground/85">
            Edad inicio periodo / menopausia
          </label>
          <Controller
            control={form.control}
            name="habitos.mujer.edadInicioMenstruacion"
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Ej: 13 años / 50 años"
                className="h-9"
              />
            )}
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-foreground/85">
            ¿Cómo son sus períodos?
          </label>
          <div className="flex gap-1.5">
            {(["regulares", "irregulares"] as const).map((v) => (
              <Chip
                key={v}
                pressed={periodos === v}
                onPressedChange={() =>
                  form.setValue(
                    "habitos.mujer.periodos",
                    periodos === v ? "" : v,
                    { shouldDirty: true },
                  )
                }
                size="sm"
                tone="rose"
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-foreground/85">
            ¿Padece cólicos?
          </label>
          <div className="flex gap-1.5">
            {(["no", "pocos", "muchos"] as const).map((v) => (
              <Chip
                key={v}
                pressed={colicos === v}
                onPressedChange={() =>
                  form.setValue(
                    "habitos.mujer.colicos",
                    colicos === v ? "" : v,
                    { shouldDirty: true },
                  )
                }
                size="sm"
                tone="rose"
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-foreground/85">
            ¿Cuántos embarazos ha tenido?
          </label>
          <Controller
            control={form.control}
            name="habitos.mujer.embarazos"
            render={({ field }) => (
              <Input
                type="number"
                min="0"
                value={field.value ?? 0}
                onChange={(e) => field.onChange(Number(e.target.value))}
                placeholder="0"
                className="h-9"
              />
            )}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <span className="text-[15px] font-semibold text-foreground">¿Embarazada actualmente?</span>
          <Controller
            control={form.control}
            name="habitos.mujer.embarazadaActualmente.si"
            render={({ field }) => (
              <YesNoToggle
                value={field.value}
                onChange={field.onChange}
                size="sm"
              />
            )}
          />
          {embarazada ? (
            <Controller
              control={form.control}
              name="habitos.mujer.embarazadaActualmente.meses"
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder="Meses de gestación"
                  className="h-9"
                />
              )}
            />
          ) : null}
        </div>
        <div className="grid gap-2">
          <span className="text-[15px] font-semibold text-foreground">¿Lactancia?</span>
          <Controller
            control={form.control}
            name="habitos.mujer.lactancia.si"
            render={({ field }) => (
              <YesNoToggle
                value={field.value}
                onChange={field.onChange}
                size="sm"
              />
            )}
          />
          {lactancia ? (
            <Controller
              control={form.control}
              name="habitos.mujer.lactancia.meses"
              render={({ field }) => (
                <Input {...field} placeholder="Meses de lactancia" className="h-9" />
              )}
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-foreground/85">
          Método anticonceptivo actual
        </label>
        <Controller
          control={form.control}
          name="habitos.mujer.anticonceptivo"
          render={({ field }) => (
            <select
              {...field}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-[0.9375rem] text-foreground transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="">Seleccionar…</option>
              {ANTICONCEPTIVOS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      <div className="grid gap-2">
        <span className="text-[15px] font-semibold text-foreground">
          Anticonceptivos de emergencia (últimos 6 meses)
        </span>
        <Controller
          control={form.control}
          name="habitos.mujer.ae6m.si"
          render={({ field }) => (
            <YesNoToggle value={field.value} onChange={field.onChange} size="sm" />
          )}
        />
        {ae6m ? (
          <Controller
            control={form.control}
            name="habitos.mujer.ae6m.cuando"
            render={({ field }) => (
              <Input {...field} placeholder="¿Cuándo?" className="h-9" />
            )}
          />
        ) : null}
      </div>
    </>
  );
}

// ─── HÁBITOS DE PIEL · Sol + SPF ────────────────────────────────────────────

function SolSpfCard() {
  const { form } = useEvaluacionForm();
  const expo = useWatch({
    control: form.control,
    name: "habitos.exposicionSolar",
  });
  const retoque = useWatch({
    control: form.control,
    name: "habitos.retoquesSpf",
  });

  return (
    <SectionCard icon={SunIcon} title="Exposición solar y SPF" tone="copper">
      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-foreground/85">
          Exposición al sol
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(["nunca", "poca", "moderada", "excesiva"] as const).map((v) => (
            <Chip
              key={v}
              pressed={expo === v}
              onPressedChange={() =>
                form.setValue(
                  "habitos.exposicionSolar",
                  expo === v ? "" : v,
                  { shouldDirty: true },
                )
              }
              size="sm"
              tone="honey"
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-foreground/85">
          ¿Usa protector solar?
        </label>
        <Controller
          control={form.control}
          name="habitos.usaSpf"
          render={({ field }) => (
            <YesNoToggle value={field.value} onChange={field.onChange} size="sm" />
          )}
        />
      </div>
      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-foreground/85">
          Retoques al día
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(["No retoco", "1x", "2x", "3x+"] as const).map((v) => (
            <Chip
              key={v}
              pressed={retoque === v}
              onPressedChange={() =>
                form.setValue(
                  "habitos.retoquesSpf",
                  retoque === v ? "" : v,
                  { shouldDirty: true },
                )
              }
              size="sm"
              tone="honey"
            >
              {v}
            </Chip>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── HÁBITOS DE PIEL · Limpieza + maquillaje ────────────────────────────────

function LimpiezaMaquillajeCard() {
  const { form } = useEvaluacionForm();
  const lavado = useWatch({
    control: form.control,
    name: "habitos.lavadosDia",
  });
  const maqui = useWatch({ control: form.control, name: "habitos.maquillaje" });

  const herr = (useWatch({
    control: form.control,
    name: "habitos.herramientasMaquillaje",
  }) ?? []) as string[];
  const lavBrochas = useWatch({
    control: form.control,
    name: "habitos.lavaBrochasMes",
  });

  function toggleHerr(h: string) {
    if (herr.includes(h)) {
      form.setValue(
        "habitos.herramientasMaquillaje",
        herr.filter((v) => v !== h),
        { shouldDirty: true },
      );
    } else {
      form.setValue("habitos.herramientasMaquillaje", [...herr, h], {
        shouldDirty: true,
      });
    }
  }

  return (
    <SectionCard
      icon={SparklesIcon}
      title="Limpieza y maquillaje"
      tone="copper"
    >
      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-foreground/85">
          Lavados de rostro al día
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(["No lo lavo", "1x", "2x", "3x", "4x+"] as const).map((v) => (
            <Chip
              key={v}
              pressed={lavado === v}
              onPressedChange={() =>
                form.setValue("habitos.lavadosDia", lavado === v ? "" : v, {
                  shouldDirty: true,
                })
              }
              size="sm"
              tone="sage"
            >
              {v}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-foreground/85">
          ¿Usa maquillaje?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["si", "Sí"],
              ["no", "No"],
              ["ocasional", "Ocasionalmente"],
            ] as const
          ).map(([v, label]) => (
            <Chip
              key={v}
              pressed={maqui === v}
              onPressedChange={() =>
                form.setValue(
                  "habitos.maquillaje",
                  maqui === v
                    ? ""
                    : (v as EvaluacionFormValues["habitos"]["maquillaje"]),
                  { shouldDirty: true },
                )
              }
              size="sm"
              tone="rose"
            >
              {label}
            </Chip>
          ))}
        </div>
        {maqui === "si" || maqui === "ocasional" ? (
          <Controller
            control={form.control}
            name="habitos.maquillajeTipo"
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Tipo de maquillaje (base, polvo, máscara…)"
                className="h-9"
              />
            )}
          />
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-foreground/85">
          Herramientas
        </label>
        <div className="flex flex-wrap gap-1.5">
          {["Brochas", "Esponjas", "Ninguna"].map((h) => (
            <Chip
              key={h}
              pressed={herr.includes(h)}
              onPressedChange={() => toggleHerr(h)}
              size="sm"
              tone="rose"
            >
              {h}
            </Chip>
          ))}
        </div>
        <label className="mt-1 text-sm font-medium text-foreground/85">
          ¿Cuántas veces al mes las lava?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(["No las lavo", "1x", "2x", "3x", "4x+"] as const).map((v) => (
            <Chip
              key={v}
              pressed={lavBrochas === v}
              onPressedChange={() =>
                form.setValue(
                  "habitos.lavaBrochasMes",
                  lavBrochas === v ? "" : v,
                  { shouldDirty: true },
                )
              }
              size="sm"
              tone="sage"
            >
              {v}
            </Chip>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── HÁBITOS DE PIEL · Reactividad / queloide / cicatrización / reacción ────

function SkinReactivityCard() {
  const { form } = useEvaluacionForm();
  const queloide = useWatch({ control: form.control, name: "habitos.queloide" });
  const moretones = useWatch({
    control: form.control,
    name: "habitos.moretones",
  });
  const cic = useWatch({ control: form.control, name: "habitos.cicatrizacion" });
  const reaccion = useWatch({
    control: form.control,
    name: "habitos.reaccionProducto.tuvo",
  });

  return (
    <SectionCard
      icon={SparklesIcon}
      title="Cicatrización y reactividad"
      tone="copper"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <RadioChips
          label="¿Cicatriz queloide?"
          options={[
            ["si", "Sí"],
            ["no", "No"],
            ["no_se", "No lo sé"],
          ]}
          value={queloide ?? ""}
          onChange={(v) =>
            form.setValue(
              "habitos.queloide",
              queloide === v
                ? ""
                : (v as EvaluacionFormValues["habitos"]["queloide"]),
              { shouldDirty: true },
            )
          }
        />
        <RadioChips
          label="¿Tiende a moretones?"
          options={[
            ["si", "Sí"],
            ["no", "No"],
            ["no_recuerdo", "No recuerdo"],
          ]}
          value={moretones ?? ""}
          onChange={(v) =>
            form.setValue(
              "habitos.moretones",
              moretones === v
                ? ""
                : (v as EvaluacionFormValues["habitos"]["moretones"]),
              { shouldDirty: true },
            )
          }
        />
        <RadioChips
          label="Cicatrización"
          options={[
            ["buena", "Buena"],
            ["cicatrices", "Con cicatrices"],
            ["manchas", "Manchas"],
            ["no_se", "No lo sé"],
          ]}
          value={cic ?? ""}
          onChange={(v) =>
            form.setValue(
              "habitos.cicatrizacion",
              cic === v
                ? ""
                : (v as EvaluacionFormValues["habitos"]["cicatrizacion"]),
              { shouldDirty: true },
            )
          }
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-foreground/85">
          ¿Ha tenido reacciones a productos en el rostro?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["si", "Sí"],
              ["no", "No"],
              ["no_recuerdo", "No lo recuerdo"],
            ] as const
          ).map(([v, label]) => (
            <Chip
              key={v}
              pressed={reaccion === v}
              onPressedChange={() =>
                form.setValue(
                  "habitos.reaccionProducto.tuvo",
                  reaccion === v
                    ? ""
                    : (v as EvaluacionFormValues["habitos"]["reaccionProducto"]["tuvo"]),
                  { shouldDirty: true },
                )
              }
              size="sm"
              tone="rose"
            >
              {label}
            </Chip>
          ))}
        </div>
        {reaccion === "si" ? (
          <Controller
            control={form.control}
            name="habitos.reaccionProducto.detalle"
            render={({ field }) => (
              <Input
                {...field}
                placeholder="¿Cuáles productos? ¿Qué tipo de reacción?"
                className="h-9"
              />
            )}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}

interface RadioChipsProps {
  label: string;
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
  onChange: (v: string) => void;
}

function RadioChips({ label, options, value, onChange }: RadioChipsProps) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-foreground/85">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, txt]) => (
          <Chip
            key={v}
            pressed={value === v}
            onPressedChange={() => onChange(v)}
            size="sm"
            tone="sage"
          >
            {txt}
          </Chip>
        ))}
      </div>
    </div>
  );
}

// ─── HÁBITOS DE PIEL · Rutina facial AM/PM ──────────────────────────────────

function RutinaFacialCard() {
  const { form } = useEvaluacionForm();
  return (
    <SectionCard icon={SparklesIcon} title="Rutina facial actual" tone="copper">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-1.5">
          <label className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/85">
            <SunIcon className="size-3.5 text-[#D2A96A]" />
            Rutina de día (AM)
          </label>
          <Controller
            control={form.control}
            name="habitos.rutinaAm"
            render={({ field }) => (
              <Textarea
                {...field}
                rows={4}
                placeholder="Limpiador, vitamina C, hidratante, SPF…"
              />
            )}
          />
        </div>
        <div className="grid gap-1.5">
          <label className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/85">
            <MoonIcon className="size-3.5 text-[#5C6E6C]" />
            Rutina de noche (PM)
          </label>
          <Controller
            control={form.control}
            name="habitos.rutinaPm"
            render={({ field }) => (
              <Textarea
                {...field}
                rows={4}
                placeholder="Aceite limpiador, tónico, sérum, hidratante…"
              />
            )}
          />
        </div>
      </div>
      <p className="text-xs leading-relaxed text-foreground/75">
        Tip: incluí marcas y activos. Sirve para evitar incompatibilidades en
        el plan de cabina.
      </p>
    </SectionCard>
  );
}
