"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  LayersIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  ScanFaceIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SunIcon,
  TargetIcon,
} from "lucide-react";
import { toast } from "sonner";

import { upsertEvaluacionAction } from "@/actions/evaluaciones.actions";
import { FacialMap } from "@/components/evaluaciones/facial-map";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ClienteDetail } from "@/services/clientes.service";
import {
  ALTERATION_CODES,
  type AlterationCode,
  type Evaluacion,
  type PlanData,
  FRECUENCIAS,
  NUMERO_SESIONES,
  TRATAMIENTOS_RECOMENDADOS,
} from "@/types/evaluacion";

interface Props {
  cliente: ClienteDetail;
  evaluacion: Evaluacion | null;
}

export function ObjetivosTab({ cliente, evaluacion }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  if (!evaluacion) {
    return (
      <div className="grid place-items-center gap-3 rounded-2xl border bg-card p-10 text-center shadow-sm">
        <span className="flex size-12 items-center justify-center rounded-full bg-[#F4F1EC] text-[#BB7154]">
          <ClipboardListIcon className="size-5" />
        </span>
        <h3 className="font-heading text-base">
          Necesitas llenar la evaluación primero
        </h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Cuando completes anamnesis, estilo de vida y diagnóstico en la pestaña
          <span className="font-medium"> Evaluación</span>, vas a poder definir
          el objetivo y el plan de tratamiento desde aquí.
        </p>
      </div>
    );
  }

  const hasPlan =
    Boolean(evaluacion.plan.objetivoPrincipal) ||
    evaluacion.plan.tratamientos.length > 0 ||
    Boolean(evaluacion.plan.numeroSesiones) ||
    Boolean(evaluacion.plan.frecuencia) ||
    Boolean(evaluacion.plan.notasClinicas);

  return (
    <div className="grid gap-5">
      {/* Top action bar — primary CTA matches the header "Nueva cita"
          treatment so the Objetivos panel has the same visual anchor. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-medium tracking-tight text-[#8C4A30]">
            Objetivos clínicos
          </h2>
          <p className="text-sm text-foreground/75">
            {hasPlan
              ? "Plan activo derivado del diagnóstico de la clienta."
              : "Definí el objetivo y los tratamientos sugeridos para esta clienta."}
          </p>
        </div>
        <Button
          type="button"
          variant="cta"
          size="default"
          onClick={() => setEditing(true)}
          className="gap-1.5"
        >
          {hasPlan ? (
            <>
              <PencilIcon className="size-4" />
              Editar plan
            </>
          ) : (
            <>
              <PlusIcon className="size-4" />
              Crear plan
            </>
          )}
        </Button>
      </div>

      <ResumenClinicoCard evaluacion={evaluacion} />

      {evaluacion.diagnostico.mapaFacial.length > 0 ? (
        <SectionCard
          icon={MapPinIcon}
          title="Mapa facial"
          tone="copper"
          hint={`${evaluacion.diagnostico.mapaFacial.length} alteración${evaluacion.diagnostico.mapaFacial.length === 1 ? "" : "es"} marcada${evaluacion.diagnostico.mapaFacial.length === 1 ? "" : "s"} en el rostro.`}
        >
          <FacialMap mode="view" value={evaluacion.diagnostico.mapaFacial} />
        </SectionCard>
      ) : null}

      <SectionCard
        icon={TargetIcon}
        title="Plan de tratamiento"
        tone="copper"
      >
        {hasPlan ? (
          <PlanSummary plan={evaluacion.plan} />
        ) : (
          <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#F6E0D6] text-[#8C4A30]">
              <SparklesIcon className="size-4" />
            </span>
            <p className="text-[13px] font-medium">Sin plan definido todavía</p>
            <p className="text-sm text-foreground/75">
              Usa el botón <span className="font-medium">Crear plan</span> de
              arriba para empezar.
            </p>
          </div>
        )}
      </SectionCard>

      <PlanEditorSheet
        open={editing}
        onClose={() => setEditing(false)}
        plan={evaluacion.plan}
        onSave={(next) => {
          startTransition(async () => {
            const result = await upsertEvaluacionAction(
              cliente.id,
              { plan: next },
              evaluacion.version,
            );
            if (!result.success) {
              if (result.errors?.version?.includes("conflict")) {
                toast.error(
                  "Otro usuario actualizó esta evaluación. Refrescando…",
                );
                router.refresh();
                return;
              }
              toast.error(result.message ?? "No se pudo guardar el plan.");
              return;
            }
            setEditing(false);
            toast.success("Plan guardado.");
            router.refresh();
          });
        }}
      />
    </div>
  );
}

// ─── Resumen clínico ─────────────────────────────────────────────────────────

function ResumenClinicoCard({ evaluacion }: { evaluacion: Evaluacion }) {
  const { diagnostico, anamnesis } = evaluacion;
  const fototipoText = diagnostico.fitzpatrick
    ? `Fototipo ${romanize(diagnostico.fitzpatrick)}`
    : null;
  const glogauText = diagnostico.glogau
    ? `Glogau ${romanize(diagnostico.glogau)}`
    : null;
  const biotipoText = diagnostico.biotipo
    ? `Piel ${diagnostico.biotipo.toLowerCase()}`
    : null;

  const alteraciones: string[] = [
    ...diagnostico.sensaciones,
    ...diagnostico.altPigmento,
    ...diagnostico.altEpidermis,
    ...diagnostico.altFoliculo,
    ...(diagnostico.altVasculares.presenta
      ? diagnostico.altVasculares.tipos
      : []),
    ...(diagnostico.ojeras.presenta
      ? diagnostico.ojeras.tipos.map((t) => `Ojeras · ${t}`)
      : []),
  ];
  if (diagnostico.acne.activo && diagnostico.acne.grado) {
    alteraciones.unshift(`Acné Grado ${romanize(diagnostico.acne.grado)}`);
  }

  const mapPins = diagnostico.mapaFacial;
  const codeCounts = mapPins.reduce<Record<string, number>>((acc, p) => {
    if (!p?.code) return acc;
    acc[p.code] = (acc[p.code] ?? 0) + 1;
    return acc;
  }, {});
  const topCodes = Object.entries(codeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4) as Array<[AlterationCode, number]>;

  const alergias = anamnesis.alergias;

  return (
    <SectionCard
      icon={ScanFaceIcon}
      title="Resumen clínico"
      hint="Datos derivados automáticamente de la evaluación."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryColumn title="Diagnóstico de piel">
          <SummaryPill icon={ScanFaceIcon} text={biotipoText ?? "Sin biotipo"} />
          {fototipoText ? (
            <SummaryPill icon={SunIcon} text={fototipoText} />
          ) : null}
          {glogauText ? (
            <SummaryPill icon={LayersIcon} text={glogauText} />
          ) : null}
        </SummaryColumn>

        <SummaryColumn title="Alergias">
          {alergias.tiene ? (
            <>
              <SummaryPill
                icon={AlertTriangleIcon}
                tone="rose"
                text={
                  alergias.tipos.length > 0
                    ? `Con alergias · ${alergias.tipos.join(", ")}`
                    : "Con alergias"
                }
              />
              {alergias.detalle ? (
                <p className="text-sm text-foreground/75">
                  {alergias.detalle}
                </p>
              ) : null}
            </>
          ) : (
            <SummaryPill
              icon={ShieldCheckIcon}
              tone="sage"
              text="Sin alergias reportadas"
            />
          )}
        </SummaryColumn>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground/80">
          Alteraciones detectadas
        </p>
        {alteraciones.length === 0 ? (
          <p className="text-sm text-foreground/75">
            Sin alteraciones registradas en el diagnóstico.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {alteraciones.map((a, i) => (
              <span
                key={`${i}-${a}`}
                className="inline-flex items-center rounded-full bg-[#FBEFE7] px-3 py-1 text-sm font-medium text-[#8C4A30]"
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {topCodes.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground/80">
            Mapa facial · alteraciones más frecuentes
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {topCodes.map(([code, count]) => {
              const label =
                ALTERATION_CODES.find((c) => c.code === code)?.label ?? code;
              return (
                <li
                  key={code}
                  className="flex items-center gap-2 rounded-lg border border-border/40 bg-card px-2.5 py-1.5 text-sm"
                >
                  <span className="flex size-6 items-center justify-center rounded-md bg-[#BB7154] text-[10px] font-bold text-white">
                    {code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground/85">
                    {label}
                  </span>
                  <span className="text-xs font-medium text-foreground/75">
                    ×{count}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
}

interface SummaryColumnProps {
  title: string;
  children: React.ReactNode;
}

function SummaryColumn({ title, children }: SummaryColumnProps) {
  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-bold uppercase tracking-wider text-[#4F605C]">
        {title}
      </p>
      {/* `flex-wrap` so multiple pills sit inline (left-aligned) instead of
          stacking full-width — slimmer, more clinical look. */}
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

interface SummaryPillProps {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  tone?: "default" | "sage" | "rose";
}

function SummaryPill({ icon: Icon, text, tone = "default" }: SummaryPillProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-none",
        tone === "sage"
          ? "border-[#5C6E6C]/20 bg-[#E7ECEA]/60 text-[#4F605C]"
          : tone === "rose"
            ? "border-[#7B3D3D]/15 bg-[#F8EAE9]/55 text-[#7B3D3D]"
            : "border-border/60 bg-card text-foreground/80",
      )}
    >
      <Icon className="size-2.5 shrink-0 opacity-80" />
      <span className="truncate">{text}</span>
    </span>
  );
}

// ─── Plan summary (read-only render) ────────────────────────────────────────

function PlanSummary({ plan }: { plan: PlanData }) {
  return (
    <div className="grid gap-4">
      {plan.objetivoPrincipal ? (
        <div className="rounded-xl border-l-2 border-[#BB7154] bg-[#FBF9F4] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/80">
            Objetivo del tratamiento
          </p>
          <p className="mt-1 text-[13.5px] text-foreground">
            {plan.objetivoPrincipal}
          </p>
        </div>
      ) : null}

      {plan.tratamientos.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground/80">
            Tratamientos sugeridos
          </p>
          <div className="flex flex-wrap gap-1.5">
            {plan.tratamientos.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full bg-[#E7ECEA] px-3 py-1 text-sm font-medium text-[#4F605C]"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {plan.numeroSesiones ? (
          <SmallStat label="Número de sesiones" value={plan.numeroSesiones} />
        ) : null}
        {plan.frecuencia ? (
          <SmallStat label="Frecuencia" value={plan.frecuencia} />
        ) : null}
      </div>

      {plan.notasClinicas ? (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-foreground/80">
            Notas clínicas
          </p>
          <p className="rounded-xl bg-muted/40 px-3 py-2 text-[13px] text-foreground/85">
            {plan.notasClinicas}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <p className="text-xs font-bold uppercase tracking-wider text-foreground/80">
        {label}
      </p>
      <p className="mt-0.5 text-[13.5px] font-medium text-foreground">{value}</p>
    </div>
  );
}

// ─── Plan editor (Sheet) ────────────────────────────────────────────────────

interface PlanEditorSheetProps {
  open: boolean;
  onClose: () => void;
  plan: PlanData;
  onSave: (next: PlanData) => void;
}

function PlanEditorSheet({
  open,
  onClose,
  plan,
  onSave,
}: PlanEditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b px-5 pt-5 pb-4">
          <SheetTitle className="text-base">Plan de tratamiento</SheetTitle>
        </SheetHeader>
        {/* Mount the editor only while open so the local draft starts fresh
            each time the sheet opens — no need to mirror props in an effect. */}
        {open ? (
          <PlanEditorBody plan={plan} onSave={onSave} onClose={onClose} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

interface PlanEditorBodyProps {
  plan: PlanData;
  onSave: (next: PlanData) => void;
  onClose: () => void;
}

function PlanEditorBody({ plan, onSave, onClose }: PlanEditorBodyProps) {
  const [draft, setDraft] = useState<PlanData>(plan);

  function toggleTratamiento(t: string) {
    setDraft((prev) =>
      prev.tratamientos.includes(t)
        ? { ...prev, tratamientos: prev.tratamientos.filter((v) => v !== t) }
        : { ...prev, tratamientos: [...prev.tratamientos, t] },
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-foreground/85">
              Objetivo del tratamiento
            </label>
            <Input
              value={draft.objetivoPrincipal}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  objetivoPrincipal: e.target.value,
                }))
              }
              placeholder="Reducir acné, nivelar tono, reafirmar…"
              className="h-10"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-foreground/85">
              Tratamientos en cabina sugeridos
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TRATAMIENTOS_RECOMENDADOS.map((t) => (
                <Chip
                  key={t}
                  pressed={draft.tratamientos.includes(t)}
                  onPressedChange={() => toggleTratamiento(t)}
                  size="sm"
                  tone="sage"
                >
                  {t}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-foreground/85">
                Número de sesiones
              </label>
              <select
                value={draft.numeroSesiones}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, numeroSesiones: e.target.value }))
                }
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Seleccionar…</option>
                {NUMERO_SESIONES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium text-foreground/85">
                Frecuencia
              </label>
              <select
                value={draft.frecuencia}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, frecuencia: e.target.value }))
                }
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Seleccionar…</option>
                {FRECUENCIAS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-foreground/85">
              Notas clínicas / observaciones
            </label>
            <Textarea
              value={draft.notasClinicas}
              onChange={(e) =>
                setDraft((p) => ({ ...p, notasClinicas: e.target.value }))
              }
              rows={4}
              placeholder="Notas internas, consideraciones especiales, alertas para sesiones futuras…"
            />
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t bg-card/60 px-5 py-3">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => onSave(draft)}
          className="gap-1.5"
        >
          <CheckCircle2Icon className="size-4" />
          Guardar plan
        </Button>
      </footer>
    </>
  );
}

function romanize(n: number) {
  const map = ["", "I", "II", "III", "IV", "V", "VI"];
  return map[n] ?? String(n);
}
