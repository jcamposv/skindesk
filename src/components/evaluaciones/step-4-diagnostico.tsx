"use client";

import { useMemo } from "react";
import { Controller, useWatch } from "react-hook-form";
import {
  AtomIcon,
  EyeIcon,
  LayersIcon,
  ScanFaceIcon,
  ScissorsIcon,
  SparkleIcon,
  StickerIcon,
} from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/textarea";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import {
  ACNE_LESIONES,
  ALT_EPIDERMIS,
  ALT_FOLICULO,
  ALT_PIGMENTO,
  ALT_VASCULARES,
  BIOTIPOS,
  CICATRICES,
  FITZPATRICK,
  GLOGAU,
  OJERAS_TIPOS,
  SENSACIONES_PIEL,
} from "@/types/evaluacion";

import { FacialMap } from "./facial-map";
import { InfoTooltip } from "./info-tooltip";
import { Pictogram } from "./pictograms";
import { SectionCard } from "@/components/shared/section-card";
import { StepSectionNav, type StepSection } from "./step-section-nav";
import { useEvaluacionForm } from "./evaluacion-form-context";

const FITZPATRICK_DEF =
  "Escala que mide el tipo de piel según su respuesta al sol — del I (muy claro, siempre quema) al VI (muy oscuro, nunca quema).";
const GLOGAU_DEF =
  "Clasificación del fotoenvejecimiento. Grado I (sin arrugas, joven) hasta Grado IV (arrugas marcadas, queratosis actínica).";
const BIOTIPO_DEF =
  "Tipo cutáneo basado en producción sebácea: normal, mixta (zona T grasa), grasa, seca/alípica, sensible.";

/**
 * Step 4 — Diagnóstico de piel.
 *
 * Reorganized for clinical workflow:
 *  1. Mapa facial — hero, full-width. The cosmetóloga marks alteraciones
 *     ON THE PHOTO with the clinical codes (E, M, P, A, L, C, D, i, HPI, LS,
 *     R, T, J, CN, CA, CQ, CH, O). This consolidates what used to be 4
 *     separate redundant chip groups (vascular, pigmento, epidermis, folículo).
 *  2. Clasificación — biotipo + Fitzpatrick + Glogau in one card.
 *  3. Sensaciones + Acné side-by-side.
 *  4. Cicatrices.
 *  5. Alteraciones adicionales (consolidated chips for stuff not pinned).
 *  6. Observaciones.
 */
export function Step4Diagnostico() {
  const { form } = useEvaluacionForm();
  // Narrow watch: only the fields the nav uses, not the entire diagnostico.
  const [
    mapaFacial,
    biotipo,
    fitzpatrick,
    glogau,
    sensaciones,
    acneActivo,
    cicatrices,
    altPigmento,
    altEpidermis,
    altFoliculo,
    altVasculares,
    ojeras,
    observaciones,
  ] = useWatch({
    control: form.control,
    name: [
      "diagnostico.mapaFacial",
      "diagnostico.biotipo",
      "diagnostico.fitzpatrick",
      "diagnostico.glogau",
      "diagnostico.sensaciones",
      "diagnostico.acne.activo",
      "diagnostico.cicatrices",
      "diagnostico.altPigmento",
      "diagnostico.altEpidermis",
      "diagnostico.altFoliculo",
      "diagnostico.altVasculares.presenta",
      "diagnostico.ojeras.presenta",
      "diagnostico.observaciones",
    ],
  });

  const navSections = useMemo<StepSection[]>(
    () => [
      {
        id: "s4-mapa",
        label: "Mapa facial",
        done: (mapaFacial?.length ?? 0) > 0,
      },
      {
        id: "s4-clasificacion",
        label: "Clasificación",
        done: Boolean(biotipo) || fitzpatrick != null || glogau != null,
      },
      {
        id: "s4-sensaciones",
        label: "Sensaciones",
        done: (sensaciones?.length ?? 0) > 0,
      },
      {
        id: "s4-acne",
        label: "Acné",
        done: acneActivo === true || acneActivo === false,
      },
      {
        id: "s4-cicatrices",
        label: "Cicatrices",
        done: (cicatrices?.length ?? 0) > 0,
      },
      {
        id: "s4-adicionales",
        label: "Adicionales",
        done:
          (altPigmento?.length ?? 0) > 0 ||
          (altEpidermis?.length ?? 0) > 0 ||
          (altFoliculo?.length ?? 0) > 0 ||
          altVasculares === true ||
          ojeras === true,
      },
      {
        id: "s4-obs",
        label: "Observaciones",
        done: Boolean(observaciones),
      },
    ],
    [
      mapaFacial,
      biotipo,
      fitzpatrick,
      glogau,
      sensaciones,
      acneActivo,
      cicatrices,
      altPigmento,
      altEpidermis,
      altFoliculo,
      altVasculares,
      ojeras,
      observaciones,
    ],
  );

  return (
    <div className="grid gap-5">
      <StepSectionNav sections={navSections} />

      {/* === 1 · Mapa facial (HERO) ================================== */}
      <SectionCard
        id="s4-mapa"
        icon={StickerIcon}
        title="Mapa facial · marcado de alteraciones"
        hint="Seleccioná un código clínico → toca la zona indicada en el rostro."
        tone="copper"
      >
        <Controller
          control={form.control}
          name="diagnostico.mapaFacial"
          render={({ field }) => (
            <FacialMap
              value={field.value ?? []}
              onChange={field.onChange}
              mode="edit"
            />
          )}
        />
      </SectionCard>

      {/* === 2 · Clasificación clínica =============================== */}
      <ClasificacionCard />

      {/* === 3 · Sensaciones + Acné (2-col desktop) ================= */}
      <div className="grid gap-5 lg:grid-cols-2">
        <SensacionesCard />
        <AcneCard />
      </div>

      {/* === 4 · Cicatrices + Alteraciones adicionales ============== */}
      <div className="grid gap-5 lg:grid-cols-2">
        <CicatricesCard />
        <AlteracionesAdicionalesCard />
      </div>

      {/* === 5 · Observaciones ======================================= */}
      <ObservacionesCard />
    </div>
  );
}

// ─── 2 · Clasificación clínica (biotipo + Fitzpatrick + Glogau) ──────────────

function ClasificacionCard() {
  const { form } = useEvaluacionForm();
  const biotipo = useWatch({
    control: form.control,
    name: "diagnostico.biotipo",
  });
  const fitz = useWatch({
    control: form.control,
    name: "diagnostico.fitzpatrick",
  });
  const glogau = useWatch({
    control: form.control,
    name: "diagnostico.glogau",
  });

  return (
    <SectionCard
      id="s4-clasificacion"
      icon={ScanFaceIcon}
      title="Clasificación clínica de la piel"
      tone="sage"
    >
      {/* Biotipo */}
      <div className="grid gap-2">
        <div className="flex items-center gap-1.5">
          <h4 className="text-[12.5px] font-medium">Biotipo cutáneo</h4>
          <InfoTooltip content={BIOTIPO_DEF} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BIOTIPOS.map((b) => (
            <Chip
              key={b}
              pressed={biotipo === b}
              onPressedChange={() =>
                form.setValue(
                  "diagnostico.biotipo",
                  biotipo === b ? "" : b,
                  { shouldDirty: true },
                )
              }
              size="md"
              tone="sage"
            >
              {b}
            </Chip>
          ))}
        </div>
      </div>

      {/* Fitzpatrick */}
      <div className="grid gap-2">
        <div className="flex items-center gap-1.5">
          <h4 className="text-[12.5px] font-medium">Fototipo · Fitzpatrick</h4>
          <InfoTooltip content={FITZPATRICK_DEF} />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {FITZPATRICK.map((f) => {
            const active = fitz === f.num;
            return (
              <button
                key={f.num}
                type="button"
                onClick={() =>
                  form.setValue(
                    "diagnostico.fitzpatrick",
                    active ? null : f.num,
                    { shouldDirty: true },
                  )
                }
                className={
                  active
                    ? "rounded-xl border-2 border-[#5C6E6C] bg-[#F4F1EC]/60 p-2.5 text-center shadow-sm"
                    : "rounded-xl border border-border/60 bg-card p-2.5 text-center transition-colors hover:border-foreground/20"
                }
              >
                <div
                  className="mb-1.5 h-6 rounded-md"
                  style={{ backgroundColor: f.color }}
                />
                <div
                  className={
                    active
                      ? "text-xs font-bold text-[#5C6E6C]"
                      : "text-xs font-bold text-foreground"
                  }
                >
                  {romanize(f.num)}
                </div>
                <div className="mt-0.5 text-[9.5px] leading-tight text-muted-foreground">
                  {f.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Glogau */}
      <div className="grid gap-2">
        <div className="flex items-center gap-1.5">
          <h4 className="text-[12.5px] font-medium">Fotoenvejecimiento · Glogau</h4>
          <InfoTooltip content={GLOGAU_DEF} />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {GLOGAU.map((g) => {
            const active = glogau === g.grado;
            return (
              <button
                key={g.grado}
                type="button"
                onClick={() =>
                  form.setValue(
                    "diagnostico.glogau",
                    active ? null : g.grado,
                    { shouldDirty: true },
                  )
                }
                className={
                  active
                    ? "rounded-xl border-2 border-[#5C6E6C] bg-[#F4F1EC]/60 p-3 text-left"
                    : "rounded-xl border border-border/60 bg-card p-3 text-left transition-colors hover:border-foreground/20"
                }
              >
                <div className="text-[11px] font-bold text-[#5C6E6C]">
                  Grado {romanize(g.grado)}
                </div>
                <div className="text-[12px] font-semibold">{g.edad}</div>
                <div className="text-[10.5px] text-muted-foreground">
                  {g.nivel}
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-foreground/70">
                  {g.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── 3a · Sensaciones piel ─────────────────────────────────────────────────

function SensacionesCard() {
  const { form } = useEvaluacionForm();
  const list = (useWatch({
    control: form.control,
    name: "diagnostico.sensaciones",
  }) ?? []) as string[];
  function toggle(v: string) {
    if (list.includes(v)) {
      form.setValue(
        "diagnostico.sensaciones",
        list.filter((s) => s !== v),
        { shouldDirty: true },
      );
    } else {
      form.setValue("diagnostico.sensaciones", [...list, v], {
        shouldDirty: true,
      });
    }
  }
  return (
    <SectionCard
      id="s4-sensaciones"
      icon={EyeIcon}
      title="¿Cómo siente su piel diariamente?"
      hint="Seleccioná todas las que apliquen."
      tone="aqua"
    >
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {SENSACIONES_PIEL.map((s) => (
          <Chip
            key={s}
            pressed={list.includes(s)}
            onPressedChange={() => toggle(s)}
            size="sm"
            tone="sage"
          >
            {s}
          </Chip>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── 3b · Acné con pictogramas ──────────────────────────────────────────────

function AcneCard() {
  const { form } = useEvaluacionForm();
  const activo = useWatch({
    control: form.control,
    name: "diagnostico.acne.activo",
  });
  const grado = useWatch({
    control: form.control,
    name: "diagnostico.acne.grado",
  });
  const lesiones = (useWatch({
    control: form.control,
    name: "diagnostico.acne.lesiones",
  }) ?? []) as string[];

  const ACNE_DESC: Record<number, string> = {
    1: "Comedones, mínima inflamación",
    2: "Pápulas y pústulas, inflamación moderada",
    3: "Lesiones extensas, riesgo cicatricial",
    4: "Nódulos y quistes, manejo médico",
  };

  function toggleLesion(v: string) {
    if (lesiones.includes(v)) {
      form.setValue(
        "diagnostico.acne.lesiones",
        lesiones.filter((l) => l !== v),
        { shouldDirty: true },
      );
    } else {
      form.setValue("diagnostico.acne.lesiones", [...lesiones, v], {
        shouldDirty: true,
      });
    }
  }

  return (
    <SectionCard
      id="s4-acne"
      icon={AtomIcon}
      title="Acné · grado y tipo"
      tone="rose"
    >
      <div className="flex items-center gap-3">
        <span className="text-[12.5px] font-medium">¿Presenta acné activo?</span>
        <Controller
          control={form.control}
          name="diagnostico.acne.activo"
          render={({ field }) => (
            <YesNoToggle
              value={field.value}
              onChange={field.onChange}
              size="sm"
            />
          )}
        />
      </div>
      {activo ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[1, 2, 3, 4].map((n) => {
              const active = grado === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    form.setValue(
                      "diagnostico.acne.grado",
                      active ? null : n,
                      { shouldDirty: true },
                    )
                  }
                  className={
                    active
                      ? "flex flex-col items-center gap-1 rounded-xl border-2 border-[#C58F8A] bg-[#F8EAE9] p-2.5 text-center"
                      : "flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-card p-2.5 text-center transition-colors hover:border-foreground/20"
                  }
                >
                  <Pictogram
                    name={`acne-${n}` as "acne-1" | "acne-2" | "acne-3" | "acne-4"}
                    className="size-9"
                  />
                  <div className="text-[11px] font-bold text-[#7B3D3D]">
                    Grado {romanize(n)}
                  </div>
                  <p className="text-[9.5px] leading-tight text-foreground/70">
                    {ACNE_DESC[n]}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="grid gap-1.5">
            <label className="text-[11.5px] font-medium text-muted-foreground">
              Tipo de lesión presente
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ACNE_LESIONES.map((l) => (
                <Chip
                  key={l}
                  pressed={lesiones.includes(l)}
                  onPressedChange={() => toggleLesion(l)}
                  size="sm"
                  tone="rose"
                >
                  {l}
                </Chip>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </SectionCard>
  );
}

// ─── 4 · Cicatrices con pictogramas ────────────────────────────────────────

function CicatricesCard() {
  const { form } = useEvaluacionForm();
  const list = (useWatch({
    control: form.control,
    name: "diagnostico.cicatrices",
  }) ?? []) as string[];

  function toggle(v: string) {
    if (list.includes(v)) {
      form.setValue(
        "diagnostico.cicatrices",
        list.filter((s) => s !== v),
        { shouldDirty: true },
      );
    } else {
      form.setValue("diagnostico.cicatrices", [...list, v], {
        shouldDirty: true,
      });
    }
  }

  // Map each cicatriz tipo to its pictogram name.
  const PICTO_BY_TIPO: Record<string, "scar-icepick" | "scar-rolling" | "scar-boxcar" | "scar-keloid"> = {
    Icepick: "scar-icepick",
    Rolling: "scar-rolling",
    Boxcar: "scar-boxcar",
    "Hipertrófica / Queloide": "scar-keloid",
  };

  return (
    <SectionCard
      id="s4-cicatrices"
      icon={ScissorsIcon}
      title="Cicatrices presentes"
      tone="honey"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {CICATRICES.map((c) => {
          const active = list.includes(c.tipo);
          const picto = PICTO_BY_TIPO[c.tipo];
          return (
            <button
              key={c.tipo}
              type="button"
              onClick={() => toggle(c.tipo)}
              className={
                active
                  ? "flex flex-col items-center gap-1 rounded-xl border-2 border-[#D2A96A] bg-[#F8EFD7] p-2.5 text-center"
                  : "flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-card p-2.5 text-center transition-colors hover:border-foreground/20"
              }
            >
              {picto ? (
                <Pictogram name={picto} className="size-9" />
              ) : null}
              <div className="text-[11.5px] font-semibold text-[#7C5E1F]">
                {c.tipo}
              </div>
              <p className="text-[9.5px] leading-tight text-foreground/70">
                {c.desc}
              </p>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ─── 5 · Alteraciones adicionales (consolidated) ────────────────────────────
// What used to be 5 separate chip groups (vasculares, ojeras, pigmento,
// epidermis, folículo) lives here. Many overlap with the mapa facial codes;
// this card is for things the cosmetóloga wants to record but didn't pin.

function AlteracionesAdicionalesCard() {
  const { form } = useEvaluacionForm();
  const altPigmento = (useWatch({
    control: form.control,
    name: "diagnostico.altPigmento",
  }) ?? []) as string[];
  const altEpidermis = (useWatch({
    control: form.control,
    name: "diagnostico.altEpidermis",
  }) ?? []) as string[];
  const altFoliculo = (useWatch({
    control: form.control,
    name: "diagnostico.altFoliculo",
  }) ?? []) as string[];
  const vasculares = (useWatch({
    control: form.control,
    name: "diagnostico.altVasculares.tipos",
  }) ?? []) as string[];
  const vascPresenta = useWatch({
    control: form.control,
    name: "diagnostico.altVasculares.presenta",
  });
  const ojeras = (useWatch({
    control: form.control,
    name: "diagnostico.ojeras.tipos",
  }) ?? []) as string[];
  const ojerasPresenta = useWatch({
    control: form.control,
    name: "diagnostico.ojeras.presenta",
  });

  function toggleArr(
    key: "altPigmento" | "altEpidermis" | "altFoliculo",
    list: string[],
    v: string,
  ) {
    const next = list.includes(v) ? list.filter((s) => s !== v) : [...list, v];
    if (key === "altPigmento")
      form.setValue("diagnostico.altPigmento", next, { shouldDirty: true });
    else if (key === "altEpidermis")
      form.setValue("diagnostico.altEpidermis", next, { shouldDirty: true });
    else
      form.setValue("diagnostico.altFoliculo", next, { shouldDirty: true });
  }

  function toggleSubArr(
    key: "altVasculares" | "ojeras",
    list: string[],
    v: string,
  ) {
    const next = list.includes(v) ? list.filter((s) => s !== v) : [...list, v];
    if (key === "altVasculares")
      form.setValue("diagnostico.altVasculares.tipos", next, {
        shouldDirty: true,
      });
    else
      form.setValue("diagnostico.ojeras.tipos", next, {
        shouldDirty: true,
      });
  }

  return (
    <SectionCard
      id="s4-adicionales"
      icon={LayersIcon}
      title="Alteraciones adicionales"
      hint="Lo que aplique pero no se pueda pinear visualmente en el mapa."
      tone="aqua"
    >
      {/* Pigmento */}
      <SubGroup label="Pigmento">
        <div className="flex flex-wrap gap-1.5">
          {ALT_PIGMENTO.map((v) => (
            <Chip
              key={v}
              pressed={altPigmento.includes(v)}
              onPressedChange={() =>
                toggleArr("altPigmento", altPigmento, v)
              }
              size="sm"
              tone="honey"
            >
              {v}
            </Chip>
          ))}
        </div>
      </SubGroup>

      {/* Epidermis */}
      <SubGroup label="Epidermis">
        <div className="flex flex-wrap gap-1.5">
          {ALT_EPIDERMIS.map((v) => (
            <Chip
              key={v}
              pressed={altEpidermis.includes(v)}
              onPressedChange={() =>
                toggleArr("altEpidermis", altEpidermis, v)
              }
              size="sm"
              tone="sage"
            >
              {v}
            </Chip>
          ))}
        </div>
      </SubGroup>

      {/* Folículo */}
      <SubGroup label="Folículo polisebáceo">
        <div className="flex flex-wrap gap-1.5">
          {ALT_FOLICULO.map((v) => (
            <Chip
              key={v}
              pressed={altFoliculo.includes(v)}
              onPressedChange={() =>
                toggleArr("altFoliculo", altFoliculo, v)
              }
              size="sm"
              tone="rose"
            >
              {v}
            </Chip>
          ))}
        </div>
      </SubGroup>

      {/* Vasculares (Y/N + chips) */}
      <SubGroup
        label="Vasculares"
        right={
          <Controller
            control={form.control}
            name="diagnostico.altVasculares.presenta"
            render={({ field }) => (
              <YesNoToggle
                value={field.value}
                onChange={field.onChange}
                size="sm"
              />
            )}
          />
        }
      >
        {vascPresenta ? (
          <div className="flex flex-wrap gap-1.5">
            {ALT_VASCULARES.map((v) => (
              <Chip
                key={v}
                pressed={vasculares.includes(v)}
                onPressedChange={() =>
                  toggleSubArr("altVasculares", vasculares, v)
                }
                size="sm"
                tone="rose"
              >
                {v}
              </Chip>
            ))}
          </div>
        ) : null}
      </SubGroup>

      {/* Ojeras (Y/N + chips) */}
      <SubGroup
        label="Ojeras"
        right={
          <Controller
            control={form.control}
            name="diagnostico.ojeras.presenta"
            render={({ field }) => (
              <YesNoToggle
                value={field.value}
                onChange={field.onChange}
                size="sm"
              />
            )}
          />
        }
      >
        {ojerasPresenta ? (
          <div className="flex flex-wrap gap-1.5">
            {OJERAS_TIPOS.map((v) => (
              <Chip
                key={v}
                pressed={ojeras.includes(v)}
                onPressedChange={() => toggleSubArr("ojeras", ojeras, v)}
                size="sm"
                tone="rose"
              >
                {v}
              </Chip>
            ))}
          </div>
        ) : null}
      </SubGroup>
    </SectionCard>
  );
}

function SubGroup({
  label,
  right,
  children,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {right}
      </div>
      {children}
    </div>
  );
}

// ─── 6 · Observaciones ──────────────────────────────────────────────────────

function ObservacionesCard() {
  const { form } = useEvaluacionForm();
  return (
    <SectionCard
      id="s4-obs"
      icon={SparkleIcon}
      title="Observaciones del diagnóstico"
      tone="sage"
    >
      <Controller
        control={form.control}
        name="diagnostico.observaciones"
        render={({ field }) => (
          <Textarea
            {...field}
            rows={4}
            placeholder="Notas adicionales del diagnóstico, observaciones clínicas, condiciones observadas durante la exploración…"
          />
        )}
      />
    </SectionCard>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────────

function romanize(n: number) {
  const map = ["", "I", "II", "III", "IV", "V", "VI"];
  return map[n] ?? String(n);
}
