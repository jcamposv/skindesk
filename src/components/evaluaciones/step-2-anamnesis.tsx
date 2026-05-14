"use client";

import { useMemo } from "react";
import { Controller, useWatch } from "react-hook-form";
import {
  AlertTriangleIcon,
  BeakerIcon,
  HeartPulseIcon,
  PillIcon,
  SmilePlusIcon,
} from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import { cn } from "@/lib/utils";
import {
  ALERGIAS_TIPOS,
  CONDICIONES_APARATOLOGIA,
  PATOLOGIAS_GROUPS,
  PROCEDIMIENTOS_LABELS,
  PROFESIONALES_SALUD,
} from "@/types/evaluacion";

import { SectionCard } from "@/components/shared/section-card";
import { StepSectionNav, type StepSection } from "./step-section-nav";
import { useEvaluacionForm } from "./evaluacion-form-context";
import type { EvaluacionFormValues } from "./evaluacion-form-context";

export function Step2Anamnesis() {
  const { form } = useEvaluacionForm();
  // Watch only the fields the nav uses. Watching the whole `anamnesis`
  // object made the entire 1000-line step re-render on every keystroke;
  // narrowing keeps text-only edits to a single subcard.
  const [
    procedimientos,
    patologias,
    patologiasOtras,
    alergiasTiene,
    condicionesAparatologia,
    condicionesDetalle,
    med6m,
    medContinuo,
    medTopico,
    profesionales,
    observacion,
    ansiosaEs,
    estresFacil,
  ] = useWatch({
    control: form.control,
    name: [
      "anamnesis.procedimientos",
      "anamnesis.patologias",
      "anamnesis.patologiasOtras",
      "anamnesis.alergias.tiene",
      "anamnesis.condicionesAparatologia",
      "anamnesis.condicionesDetalle",
      "anamnesis.medicamento6m.tiene",
      "anamnesis.medicamentoContinuo.tiene",
      "anamnesis.medicamentoTopico.tiene",
      "anamnesis.profesionalesSalud",
      "anamnesis.observacionClinica",
      "anamnesis.ansiosa.es",
      "anamnesis.estresFacil",
    ],
  });

  const navSections = useMemo<StepSection[]>(
    () => [
      {
        id: "s2-procedimientos",
        label: "Procedimientos",
        done: (procedimientos?.length ?? 0) > 0,
      },
      {
        id: "s2-patologias",
        label: "Patologías",
        done: (patologias?.length ?? 0) > 0 || Boolean(patologiasOtras),
      },
      {
        id: "s2-alergias",
        label: "Alergias",
        done: alergiasTiene === true || alergiasTiene === false,
      },
      {
        id: "s2-aparatologia",
        label: "Aparatología",
        done:
          (condicionesAparatologia?.length ?? 0) > 0 ||
          Boolean(condicionesDetalle),
      },
      {
        id: "s2-medicamentos",
        label: "Medicación",
        done:
          med6m === true ||
          medContinuo === true ||
          medTopico === true ||
          (profesionales?.length ?? 0) > 0 ||
          Boolean(observacion),
      },
      {
        id: "s2-emocional",
        label: "Emocional",
        done: ansiosaEs === true || ansiosaEs === false || estresFacil === true || estresFacil === false,
      },
    ],
    [
      procedimientos,
      patologias,
      patologiasOtras,
      alergiasTiene,
      condicionesAparatologia,
      condicionesDetalle,
      med6m,
      medContinuo,
      medTopico,
      profesionales,
      observacion,
      ansiosaEs,
      estresFacil,
    ],
  );

  return (
    <div className="grid gap-5">
      <StepSectionNav sections={navSections} />
      <ProcedimientosCard />
      <PatologiasCard />
      <div className="grid gap-5 lg:grid-cols-2">
        <AlergiasCard />
        <CondicionesAparatologiaCard />
      </div>
      <MedicamentosCard />
      <SaludEmocionalCard />
    </div>
  );
}

// ─── Procedimientos previos ──────────────────────────────────────────────────

function ProcedimientosCard() {
  const { form } = useEvaluacionForm();
  const procedimientos = useWatch({
    control: form.control,
    name: "anamnesis.procedimientos",
  });

  const procs = (procedimientos ?? []) as EvaluacionFormValues["anamnesis"]["procedimientos"];

  const isSelected = (key: string) => procs.some((p) => p.key === key);
  const fechaFor = (key: string) =>
    procs.find((p) => p.key === key)?.fecha ?? "";

  function toggleProc(key: string, label: string) {
    if (isSelected(key)) {
      form.setValue(
        "anamnesis.procedimientos",
        procs.filter((p) => p.key !== key),
        { shouldDirty: true },
      );
    } else {
      form.setValue(
        "anamnesis.procedimientos",
        [...procs, { key, label }],
        { shouldDirty: true },
      );
    }
  }

  function setProcFecha(key: string, fecha: string) {
    form.setValue(
      "anamnesis.procedimientos",
      procs.map((p) => (p.key === key ? { ...p, fecha } : p)),
      { shouldDirty: true },
    );
  }

  return (
    <SectionCard
      id="s2-procedimientos"
      icon={BeakerIcon}
      title="Procedimientos estéticos previos"
      hint="Marcá los que apliquen e indicá cuándo aproximadamente fue el último."
      tone="sage"
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Object.entries(PROCEDIMIENTOS_LABELS).map(([key, label]) => {
          const selected = isSelected(key);
          return (
            <div
              key={key}
              className={cn(
                "flex flex-col gap-1.5 rounded-xl border bg-card px-3 py-2.5 transition-colors",
                selected
                  ? "border-[#5C6E6C]/40 bg-[#F4F1EC]/40"
                  : "border-border/60",
              )}
            >
              <Chip
                pressed={selected}
                onPressedChange={() => toggleProc(key, label)}
                size="sm"
                tone="sage"
              >
                {label}
              </Chip>
              {selected ? (
                <Input
                  value={fechaFor(key)}
                  onChange={(e) => setProcFecha(key, e.target.value)}
                  placeholder="Ej: 2024 · 6 meses"
                  className="h-9 text-sm"
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ─── Patologías ──────────────────────────────────────────────────────────────

function PatologiasCard() {
  const { form } = useEvaluacionForm();
  const patologias = useWatch({
    control: form.control,
    name: "anamnesis.patologias",
  }) as string[] | undefined;

  const list = patologias ?? [];

  function toggle(value: string) {
    if (list.includes(value)) {
      form.setValue(
        "anamnesis.patologias",
        list.filter((v) => v !== value),
        { shouldDirty: true },
      );
    } else {
      form.setValue("anamnesis.patologias", [...list, value], {
        shouldDirty: true,
      });
    }
  }

  return (
    <SectionCard
      id="s2-patologias"
      icon={HeartPulseIcon}
      title="Patologías y enfermedades"
      hint="Seleccioná todas las que apliquen — agrupadas por sistema corporal."
      tone="rose"
    >
      <div className="grid divide-y divide-border/40">
        {PATOLOGIAS_GROUPS.map((g, gi) => (
          <div key={g.group} className={cn("grid gap-2", gi === 0 ? "pb-3" : "py-3 last:pb-0")}>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#7B3D3D]">
              <span className="size-1.5 rounded-full bg-[#7B3D3D]" />
              {g.group}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((p) => (
                <Chip
                  key={p}
                  pressed={list.includes(p)}
                  onPressedChange={() => toggle(p)}
                  size="sm"
                  tone="rose"
                >
                  {p}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-foreground/85">
          Otras condiciones (especificar)
        </label>
        <Controller
          control={form.control}
          name="anamnesis.patologiasOtras"
          render={({ field }) => (
            <Input
              {...field}
              placeholder="Otras condiciones relevantes…"
              className="h-10"
            />
          )}
        />
      </div>
    </SectionCard>
  );
}

// ─── Alergias ────────────────────────────────────────────────────────────────

function AlergiasCard() {
  const { form } = useEvaluacionForm();
  const tiene = useWatch({
    control: form.control,
    name: "anamnesis.alergias.tiene",
  });
  const tipos = (useWatch({
    control: form.control,
    name: "anamnesis.alergias.tipos",
  }) ?? []) as string[];

  function toggleTipo(t: string) {
    if (tipos.includes(t)) {
      form.setValue(
        "anamnesis.alergias.tipos",
        tipos.filter((v) => v !== t),
        { shouldDirty: true },
      );
    } else {
      form.setValue("anamnesis.alergias.tipos", [...tipos, t], {
        shouldDirty: true,
      });
    }
  }

  return (
    <SectionCard
      id="s2-alergias"
      icon={AlertTriangleIcon}
      title="Alergias conocidas"
      tone="honey"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[15px] font-semibold text-foreground">¿Padece alguna alergia?</span>
        <Controller
          control={form.control}
          name="anamnesis.alergias.tiene"
          render={({ field }) => (
            <YesNoToggle
              value={field.value}
              onChange={field.onChange}
              size="sm"
            />
          )}
        />
      </div>
      {tiene ? (
        <div className="rounded-xl bg-[#FBF9F4] p-4">
          <p className="mb-2 text-sm font-semibold text-foreground">
            ¿A qué es alérgica?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ALERGIAS_TIPOS.map((t) => (
              <Chip
                key={t}
                pressed={tipos.includes(t)}
                onPressedChange={() => toggleTipo(t)}
                size="sm"
                tone="rose"
              >
                {t}
              </Chip>
            ))}
          </div>
          <div className="mt-3 grid gap-1.5">
            <label className="text-sm font-medium text-foreground/85">
              Especificar
            </label>
            <Controller
              control={form.control}
              name="anamnesis.alergias.detalle"
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder="Ej: Penicilina, látex, nueces…"
                  className="h-10"
                />
              )}
            />
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

// ─── Condiciones / aparatología ─────────────────────────────────────────────

function CondicionesAparatologiaCard() {
  const { form } = useEvaluacionForm();
  const list = (useWatch({
    control: form.control,
    name: "anamnesis.condicionesAparatologia",
  }) ?? []) as string[];

  function toggle(value: string) {
    if (list.includes(value)) {
      form.setValue(
        "anamnesis.condicionesAparatologia",
        list.filter((v) => v !== value),
        { shouldDirty: true },
      );
    } else {
      form.setValue("anamnesis.condicionesAparatologia", [...list, value], {
        shouldDirty: true,
      });
    }
  }

  const showWarn =
    list.includes("Marcapasos") ||
    list.includes("Placas / tornillos") ||
    list.includes("Implantes faciales/corporales");

  return (
    <SectionCard
      id="s2-aparatologia"
      icon={AlertTriangleIcon}
      title="Condiciones y dispositivos"
      hint="Importante para uso de aparatología."
      tone="honey"
    >
      <div className="flex flex-wrap gap-1.5">
        {CONDICIONES_APARATOLOGIA.map((c) => (
          <Chip
            key={c}
            pressed={list.includes(c)}
            onPressedChange={() => toggle(c)}
            size="sm"
            tone="honey"
          >
            {c}
          </Chip>
        ))}
      </div>
      {showWarn ? (
        <div className="flex items-start gap-2 rounded-xl bg-[#F8EFD7] px-3 py-2.5 text-sm leading-relaxed text-[#5E4615]">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>Atención:</strong> esta condición puede contraindicar
            radiofrecuencia, alta frecuencia, electroporación y otras corrientes.
            Verificá con el médico tratante.
          </p>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-foreground/85">
          Detalle de implantes / dispositivos
        </label>
        <Controller
          control={form.control}
          name="anamnesis.condicionesDetalle"
          render={({ field }) => (
            <Input
              {...field}
              placeholder="Detalle…"
              className="h-10"
            />
          )}
        />
      </div>
    </SectionCard>
  );
}

// ─── Medicamentos + profesionales ───────────────────────────────────────────

function MedicamentosCard() {
  const { form } = useEvaluacionForm();
  const profs = (useWatch({
    control: form.control,
    name: "anamnesis.profesionalesSalud",
  }) ?? []) as string[];

  function toggleProf(p: string) {
    if (profs.includes(p)) {
      form.setValue(
        "anamnesis.profesionalesSalud",
        profs.filter((v) => v !== p),
        { shouldDirty: true },
      );
    } else {
      form.setValue("anamnesis.profesionalesSalud", [...profs, p], {
        shouldDirty: true,
      });
    }
  }

  return (
    <SectionCard
      id="s2-medicamentos"
      icon={PillIcon}
      title="Medicamentos y tratamientos"
      tone="sage"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <MedicamentoSwitch
          label="¿Tratamiento médico en los últimos 6 meses?"
          tieneFieldName="anamnesis.medicamento6m.tiene"
          cualFieldName="anamnesis.medicamento6m.cual"
        />
        <MedicamentoSwitch
          label="¿Medicamento de uso continuo?"
          tieneFieldName="anamnesis.medicamentoContinuo.tiene"
          cualFieldName="anamnesis.medicamentoContinuo.cual"
        />
        <MedicamentoSwitch
          label="¿Medicamento tópico (crema/gel)?"
          tieneFieldName="anamnesis.medicamentoTopico.tiene"
          cualFieldName="anamnesis.medicamentoTopico.cual"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-foreground/85">
          ¿Está bajo tratamiento con algún profesional de la salud?
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PROFESIONALES_SALUD.map((p) => (
            <Chip
              key={p}
              pressed={profs.includes(p)}
              onPressedChange={() => toggleProf(p)}
              size="sm"
              tone="sage"
            >
              {p}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-foreground/85">
          Observación o diagnóstico relevante
        </label>
        <Controller
          control={form.control}
          name="anamnesis.observacionClinica"
          render={({ field }) => (
            <Textarea
              {...field}
              rows={2}
              placeholder="Diagnósticos relevantes, condiciones especiales, medicamentos específicos…"
            />
          )}
        />
      </div>
    </SectionCard>
  );
}

interface MedicamentoSwitchProps {
  label: string;
  tieneFieldName:
    | "anamnesis.medicamento6m.tiene"
    | "anamnesis.medicamentoContinuo.tiene"
    | "anamnesis.medicamentoTopico.tiene";
  cualFieldName:
    | "anamnesis.medicamento6m.cual"
    | "anamnesis.medicamentoContinuo.cual"
    | "anamnesis.medicamentoTopico.cual";
}

function MedicamentoSwitch({
  label,
  tieneFieldName,
  cualFieldName,
}: MedicamentoSwitchProps) {
  const { form } = useEvaluacionForm();
  const tiene = useWatch({ control: form.control, name: tieneFieldName });

  return (
    <div className="grid gap-2 rounded-xl border border-border/60 p-3">
      <span className="text-[15px] font-semibold text-foreground">{label}</span>
      <Controller
        control={form.control}
        name={tieneFieldName}
        render={({ field }) => (
          <YesNoToggle
            value={field.value}
            onChange={field.onChange}
            size="sm"
          />
        )}
      />
      {tiene ? (
        <Controller
          control={form.control}
          name={cualFieldName}
          render={({ field }) => (
            <Input
              {...field}
              placeholder="¿Cuál?"
              className="h-9"
            />
          )}
        />
      ) : null}
    </div>
  );
}

// ─── Salud emocional ────────────────────────────────────────────────────────

function SaludEmocionalCard() {
  const { form } = useEvaluacionForm();
  const ansiosa = useWatch({
    control: form.control,
    name: "anamnesis.ansiosa.es",
  });

  return (
    <SectionCard
      id="s2-emocional"
      icon={SmilePlusIcon}
      title="Salud emocional"
      tone="aqua"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <span className="text-[15px] font-semibold text-foreground">
            ¿Se considera una persona ansiosa?
          </span>
          <Controller
            control={form.control}
            name="anamnesis.ansiosa.es"
            render={({ field }) => (
              <YesNoToggle
                value={field.value}
                onChange={field.onChange}
                size="sm"
              />
            )}
          />
          {ansiosa ? (
            <Controller
              control={form.control}
              name="anamnesis.ansiosa.detalle"
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder="Especificar…"
                  className="h-9"
                />
              )}
            />
          ) : null}
        </div>
        <div className="grid gap-2">
          <span className="text-[15px] font-semibold text-foreground">
            ¿Se estresa fácilmente?
          </span>
          <Controller
            control={form.control}
            name="anamnesis.estresFacil"
            render={({ field }) => (
              <YesNoToggle
                value={field.value}
                onChange={field.onChange}
                size="sm"
              />
            )}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-foreground/85">
          Nivel de estrés diario · 1 (poco) — 10 (en exceso)
        </label>
        <Controller
          control={form.control}
          name="anamnesis.estresNivel"
          render={({ field }) => (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-foreground/75">Poco</span>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const active = field.value === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => field.onChange(n)}
                    className={
                      active
                        ? "flex size-9 items-center justify-center rounded-md bg-[#5C6E6C] text-sm font-bold text-white"
                        : "flex size-9 items-center justify-center rounded-md border border-border/70 bg-card text-sm font-semibold text-foreground/80 transition-colors hover:border-[#5C6E6C]/40 hover:text-foreground"
                    }
                  >
                    {n}
                  </button>
                );
              })}
              <span className="text-xs font-medium text-foreground/75">
                En exceso
              </span>
            </div>
          )}
        />
      </div>
    </SectionCard>
  );
}
