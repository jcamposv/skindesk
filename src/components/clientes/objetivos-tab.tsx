"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  ClockIcon,
  LayersIcon,
  PencilIcon,
  PlusIcon,
  ScanFaceIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SunIcon,
  TargetIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { upsertEvaluacionAction } from "@/actions/evaluaciones.actions";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ClienteDetail } from "@/services/clientes.service";
import {
  ALTERATION_CODES,
  type AlterationCode,
  type Evaluacion,
  type PlanData,
  type PlanSesion,
  FRECUENCIAS,
  TRATAMIENTOS_RECOMENDADOS,
} from "@/types/evaluacion";

interface Props {
  cliente: ClienteDetail;
  evaluacion: Evaluacion | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSesion(index: number): PlanSesion {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${index}`,
    nombre: `Sesión ${index + 1}`,
    fecha: null,
    descripcion: "",
    completada: false,
  };
}

/** Always return an array — legacy plans pre-date `sesiones` so the field
 *  is optional/undefined on JSONB rows persisted before v2. */
function sesionesOf(plan: PlanData): PlanSesion[] {
  return Array.isArray(plan.sesiones) ? plan.sesiones : [];
}

function planHasContent(plan: PlanData): boolean {
  return (
    Boolean(plan.nombrePlan) ||
    Boolean(plan.objetivoPrincipal) ||
    plan.tratamientos.length > 0 ||
    Boolean(plan.numeroSesiones) ||
    Boolean(plan.frecuencia) ||
    Boolean(plan.notasClinicas) ||
    sesionesOf(plan).length > 0
  );
}

function formatDateLong(iso: string | null): string {
  if (!iso) return "Sin fecha";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isToday(iso: string | null): boolean {
  return iso != null && iso === todayISO();
}

function isPastDate(iso: string | null): boolean {
  if (!iso) return false;
  return iso < todayISO();
}

// ─── Main component ─────────────────────────────────────────────────────────

export function ObjetivosTab({ cliente, evaluacion }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

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

  // Narrow into a non-null local so closures below keep the narrowing —
  // TS only narrows for the immediate scope after an early return.
  const eval_ = evaluacion;
  const hasPlan = planHasContent(eval_.plan);
  const sesiones = sesionesOf(eval_.plan);
  const hasSesiones = sesiones.length > 0;

  // Single source of save logic — used by full editor save and the
  // per-session toggle below.
  function savePlan(next: PlanData, onDone?: () => void) {
    startTransition(async () => {
      const result = await upsertEvaluacionAction(
        cliente.id,
        { plan: next },
        eval_.version,
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
      onDone?.();
      router.refresh();
    });
  }

  function handleToggleSesion(sesionId: string) {
    const nextSesiones = sesiones.map((s) =>
      s.id === sesionId ? { ...s, completada: !s.completada } : s,
    );
    savePlan({ ...eval_.plan, sesiones: nextSesiones });
  }

  return (
    <div className="grid gap-5">
      {/* Top action bar */}
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

      <ResumenClinicoCard evaluacion={eval_} />

      <SectionCard
        icon={TargetIcon}
        title={
          hasSesiones && eval_.plan.nombrePlan
            ? eval_.plan.nombrePlan
            : "Plan de tratamiento"
        }
        tone="copper"
      >
        {hasSesiones ? (
          <PlanProgressView
            plan={eval_.plan}
            sesiones={sesiones}
            onToggleSesion={handleToggleSesion}
            pending={pending}
          />
        ) : hasPlan ? (
          <PlanSummary plan={eval_.plan} />
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
        plan={eval_.plan}
        clienteName={cliente.profile.full_name ?? "Clienta"}
        onSave={(next) => savePlan(next, () => setEditing(false))}
        saving={pending}
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
            Alteraciones más frecuentes
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

// ─── Plan progress view (v2 with sesiones) ─────────────────────────────────

interface PlanProgressViewProps {
  plan: PlanData;
  sesiones: PlanSesion[];
  onToggleSesion: (id: string) => void;
  pending: boolean;
}

function PlanProgressView({
  plan,
  sesiones,
  onToggleSesion,
  pending,
}: PlanProgressViewProps) {
  const completedCount = useMemo(
    () => sesiones.filter((s) => s.completada).length,
    [sesiones],
  );
  const total = sesiones.length;
  const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  return (
    <div className="grid gap-4">
      {/* Header row — objetivo + progress */}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          {plan.objetivoPrincipal ? (
            <p className="text-xs font-bold uppercase tracking-wider text-foreground/75">
              Objetivo
            </p>
          ) : null}
          {plan.objetivoPrincipal ? (
            <p className="mt-0.5 text-[15px] font-semibold text-foreground">
              {plan.objetivoPrincipal}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-foreground/75 tabular-nums">
            Progreso general ·{" "}
            <span className="font-semibold text-foreground">
              {completedCount} de {total} sesiones
            </span>
            {plan.frecuencia ? (
              <>
                <span className="mx-1.5 text-foreground/40">·</span>
                <span>{plan.frecuencia}</span>
              </>
            ) : null}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 self-start rounded-full px-3 py-1 text-xs font-bold tabular-nums",
            percent === 100
              ? "bg-[#E7ECEA] text-[#4F605C]"
              : "bg-[#F4F1EC] text-[#4F605C]",
          )}
        >
          {percent === 100 ? <CheckCircle2Icon className="size-3.5" /> : null}
          {percent}% completado
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-border/50"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-[#5C6E6C] transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Cronograma */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground/75">
          Cronograma de sesiones
        </p>
        <ol className="grid gap-2">
          {sesiones.map((s, idx) => (
            <SesionProgressRow
              key={s.id}
              sesion={s}
              order={idx + 1}
              disabled={pending}
              onToggle={() => onToggleSesion(s.id)}
            />
          ))}
        </ol>
      </div>

      {/* Optional plan-level meta */}
      {plan.tratamientos.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground/75">
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

      {plan.notasClinicas ? (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-foreground/75">
            Notas clínicas
          </p>
          <p className="rounded-xl bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground/85">
            {plan.notasClinicas}
          </p>
        </div>
      ) : null}
    </div>
  );
}

interface SesionProgressRowProps {
  sesion: PlanSesion;
  order: number;
  disabled: boolean;
  onToggle: () => void;
}

function SesionProgressRow({
  sesion,
  order,
  disabled,
  onToggle,
}: SesionProgressRowProps) {
  const done = sesion.completada;
  const today = isToday(sesion.fecha);
  const past = !done && isPastDate(sesion.fecha);
  // Visual tone:
  //  done  → sage card with check
  //  today → copper highlight
  //  past  → copper highlight (overdue)
  //  else  → muted card with the order number
  const tone: "done" | "today" | "future" = done
    ? "done"
    : today || past
      ? "today"
      : "future";

  const statusLabel = done
    ? formatDateLong(sesion.fecha)
    : today
      ? "Hoy"
      : past
        ? `Atrasada · ${formatDateLong(sesion.fecha)}`
        : formatDateLong(sesion.fecha);

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        tone === "done"
          ? "border-[#5C6E6C]/30 bg-[#E7ECEA]/40"
          : tone === "today"
            ? "border-[#BB7154]/40 bg-[#FBEFE7]/50"
            : "border-border/60 bg-card",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={
          done ? "Marcar como pendiente" : "Marcar como completada"
        }
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#5C6E6C]/40 disabled:opacity-60",
          tone === "done"
            ? "bg-[#5C6E6C] hover:bg-[#4F605C]"
            : tone === "today"
              ? "bg-[#BB7154] hover:bg-[#A56146]"
              : "bg-muted text-foreground/70 hover:bg-foreground/15",
        )}
      >
        {done ? (
          <CheckIcon className="size-4" strokeWidth={3} />
        ) : tone === "today" ? (
          <ClockIcon className="size-4" />
        ) : (
          <span className="text-xs font-bold tabular-nums">{order}</span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[15px] font-semibold",
            done ? "text-[#4F605C]" : "text-foreground",
          )}
        >
          {sesion.nombre || `Sesión ${order}`}
        </p>
        {sesion.descripcion ? (
          <p className="truncate text-xs text-foreground/75">
            {sesion.descripcion}
          </p>
        ) : null}
      </div>
      <span
        className={cn(
          "shrink-0 text-xs font-semibold tabular-nums",
          tone === "today" ? "text-[#8C4A30]" : "text-foreground/65",
        )}
      >
        {statusLabel}
      </span>
    </li>
  );
}

// ─── Legacy plan summary (no sesiones) ─────────────────────────────────────

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

// ─── Plan editor (Sheet · dynamic sessions table) ──────────────────────────

interface PlanEditorSheetProps {
  open: boolean;
  onClose: () => void;
  plan: PlanData;
  clienteName: string;
  onSave: (next: PlanData) => void;
  saving: boolean;
}

/**
 * Centered Dialog rather than a right-side Sheet — at the previous
 * `sm:max-w-3xl` Sheet width the multi-column session table squeezed
 * the inputs to single-letter widths (UX feedback from QA screenshot).
 * A centered dialog can grow to `sm:max-w-5xl` without fighting any
 * side panels, and at lg+ the four-column row finally breathes.
 *
 * Responsiveness: caps at `calc(100%-2rem)` from the base shadcn Dialog
 * styles, so on narrow viewports it still fills the screen minus a
 * comfortable gutter.
 */
function PlanEditorSheet({
  open,
  onClose,
  plan,
  clienteName,
  onSave,
  saving,
}: PlanEditorSheetProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent
        className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="border-b px-5 pt-5 pb-4 text-left">
          <DialogTitle className="font-heading text-lg font-semibold">
            {plan.sesiones && plan.sesiones.length > 0
              ? `Editar plan de sesiones · ${clienteName}`
              : `Crear plan de sesiones · ${clienteName}`}
          </DialogTitle>
        </DialogHeader>
        {/* Re-mount on open so the draft starts fresh each time without
            mirroring props via an effect (react-best-practices
            `rerender-derived-state-no-effect`). */}
        {open ? (
          <PlanEditorBody
            plan={plan}
            onSave={onSave}
            onClose={onClose}
            saving={saving}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface PlanEditorBodyProps {
  plan: PlanData;
  onSave: (next: PlanData) => void;
  onClose: () => void;
  saving: boolean;
}

function PlanEditorBody({
  plan,
  onSave,
  onClose,
  saving,
}: PlanEditorBodyProps) {
  // Lazy initializer: respect the saved cronograma when one exists, otherwise
  // open with a single empty row so the profesional starts from a blank
  // slate and adds sessions manually (user preference — auto-seeding from
  // the legacy `numeroSesiones` count was forcing rows they didn't want).
  const [draft, setDraft] = useState<PlanData>(() => {
    const sesiones = sesionesOf(plan);
    if (sesiones.length > 0) return { ...plan, sesiones };
    return { ...plan, sesiones: [makeSesion(0)] };
  });
  const [showAdvanced, setShowAdvanced] = useState(
    () => plan.tratamientos.length > 0 || Boolean(plan.notasClinicas),
  );

  const sesiones = draft.sesiones ?? [];

  function patch<K extends keyof PlanData>(key: K, value: PlanData[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function patchSesion<K extends keyof PlanSesion>(
    id: string,
    key: K,
    value: PlanSesion[K],
  ) {
    setDraft((prev) => ({
      ...prev,
      sesiones: (prev.sesiones ?? []).map((s) =>
        s.id === id ? { ...s, [key]: value } : s,
      ),
    }));
  }

  function addSesion() {
    setDraft((prev) => {
      const current = prev.sesiones ?? [];
      return { ...prev, sesiones: [...current, makeSesion(current.length)] };
    });
  }

  function removeSesion(id: string) {
    setDraft((prev) => ({
      ...prev,
      sesiones: (prev.sesiones ?? []).filter((s) => s.id !== id),
    }));
  }

  function toggleTratamiento(t: string) {
    setDraft((prev) => ({
      ...prev,
      tratamientos: prev.tratamientos.includes(t)
        ? prev.tratamientos.filter((v) => v !== t)
        : [...prev.tratamientos, t],
    }));
  }

  function handleSave() {
    // Auto-sync the derived legacy field for backward compatibility with
    // any read paths that still look at `numeroSesiones` (PDFs, etc.).
    const total = sesiones.length;
    onSave({
      ...draft,
      numeroSesiones: total > 0 ? `${total} ${total === 1 ? "sesión" : "sesiones"}` : "",
    });
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="grid gap-5">
          {/* Header inputs */}
          <div className="grid gap-3 md:grid-cols-3">
            <FieldLabel label="Nombre del plan">
              <Input
                value={draft.nombrePlan ?? ""}
                onChange={(e) => patch("nombrePlan", e.target.value)}
                placeholder="Plan facial antiedad"
                className="h-10"
              />
            </FieldLabel>
            <FieldLabel label="Objetivo del plan">
              <Input
                value={draft.objetivoPrincipal}
                onChange={(e) => patch("objetivoPrincipal", e.target.value)}
                placeholder="Reducir acné y mejorar textura"
                className="h-10"
              />
            </FieldLabel>
            <FieldLabel label="Frecuencia entre sesiones">
              <select
                value={draft.frecuencia}
                onChange={(e) => patch("frecuencia", e.target.value)}
                className="h-10 rounded-md border border-input bg-transparent px-3 text-[0.9375rem] text-foreground transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Seleccionar…</option>
                {FRECUENCIAS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>

          {/* Sessions table */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                Sesiones programadas · {sesiones.length}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={addSesion}
              >
                <PlusIcon className="size-3.5" />
                Agregar sesión
              </Button>
            </div>

            {sesiones.length === 0 ? (
              <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground/75">
                  Sin sesiones agregadas.
                </p>
                <p className="text-xs text-foreground/65">
                  Tocá <span className="font-medium">Agregar sesión</span>{" "}
                  para empezar el cronograma.
                </p>
              </div>
            ) : (
              <ul className="grid gap-2">
                {sesiones.map((s, idx) => (
                  <SesionEditorRow
                    key={s.id}
                    sesion={s}
                    order={idx + 1}
                    onPatch={(key, value) => patchSesion(s.id, key, value)}
                    onRemove={() => removeSesion(s.id)}
                    canRemove={sesiones.length > 1}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Advanced (collapsible): tratamientos + notas */}
          <div className="grid gap-2 rounded-xl border bg-card">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-foreground/85 hover:bg-muted/40"
            >
              <span className="flex items-center gap-1.5">
                <SparklesIcon className="size-4 text-[#8C4A30]" />
                Tratamientos sugeridos y notas clínicas
              </span>
              <ChevronDownIcon
                className={cn(
                  "size-4 text-foreground/60 transition-transform",
                  showAdvanced && "rotate-180",
                )}
              />
            </button>
            {showAdvanced ? (
              <div className="grid gap-4 border-t px-3 pb-3 pt-3">
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

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium text-foreground/85">
                    Notas clínicas / observaciones
                  </label>
                  <Textarea
                    value={draft.notasClinicas}
                    onChange={(e) => patch("notasClinicas", e.target.value)}
                    rows={3}
                    placeholder="Notas internas, consideraciones especiales, alertas para sesiones futuras…"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t bg-card/60 px-5 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="cta"
          onClick={handleSave}
          disabled={saving}
          className="gap-1.5"
        >
          <CheckCircle2Icon className="size-4" />
          {saving ? "Guardando…" : "Guardar plan"}
        </Button>
      </footer>
    </>
  );
}

interface SesionEditorRowProps {
  sesion: PlanSesion;
  order: number;
  onPatch: <K extends keyof PlanSesion>(key: K, value: PlanSesion[K]) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function SesionEditorRow({
  sesion,
  order,
  onPatch,
  onRemove,
  canRemove,
}: SesionEditorRowProps) {
  return (
    <li className="grid items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5 md:grid-cols-[40px_minmax(0,1.4fr)_minmax(0,150px)_minmax(0,1.6fr)_40px]">
      <span className="flex size-8 items-center justify-center justify-self-center rounded-full bg-gradient-to-br from-[#5C6E6C] to-[#4F605C] text-xs font-bold text-white tabular-nums">
        {order}
      </span>
      <Input
        value={sesion.nombre}
        onChange={(e) => onPatch("nombre", e.target.value)}
        placeholder={`Sesión ${order} · protocolo`}
        className="h-9"
        aria-label={`Nombre sesión ${order}`}
      />
      <div className="relative">
        <CalendarIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-foreground/55" />
        <input
          type="date"
          value={sesion.fecha ?? ""}
          onChange={(e) =>
            onPatch("fecha", e.target.value === "" ? null : e.target.value)
          }
          className="h-9 w-full rounded-md border border-input bg-transparent pl-7 pr-2 text-sm text-foreground tabular-nums focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={`Fecha sesión ${order}`}
        />
      </div>
      <Input
        value={sesion.descripcion}
        onChange={(e) => onPatch("descripcion", e.target.value)}
        placeholder="Descripción breve…"
        className="h-9"
        aria-label={`Descripción sesión ${order}`}
      />
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Quitar sesión ${order}`}
        className="text-foreground/65 hover:text-destructive disabled:opacity-30"
      >
        <Trash2Icon className="size-4" />
      </Button>
    </li>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-foreground/85">{label}</label>
      {children}
    </div>
  );
}

function romanize(n: number) {
  const map = ["", "I", "II", "III", "IV", "V", "VI"];
  return map[n] ?? String(n);
}

// `toast` is wired via sonner from a global `<Toaster />` in the staff
// layout. Importing here avoids a tree-shake regression if the package
// gets renamed at some point.
void toast;
