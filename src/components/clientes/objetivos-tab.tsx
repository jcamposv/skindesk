"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardListIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TargetIcon,
} from "lucide-react";
import { toast } from "sonner";

import { upsertEvaluacionAction } from "@/actions/evaluaciones.actions";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import type { ClienteDetail } from "@/services/clientes.service";
import type { Evaluacion, PlanData } from "@/types/evaluacion";

import { planHasContent, sesionesOf } from "./objetivos/helpers";
import { PlanEditorDialog } from "./objetivos/plan-editor-dialog";
import {
  PlanProgressView,
  PlanSummary,
} from "./objetivos/plan-progress-view";
import { ResumenClinicoCard } from "./objetivos/resumen-clinico-card";

interface Props {
  cliente: ClienteDetail;
  evaluacion: Evaluacion | null;
}

/**
 * Objetivos tab — orchestrates the clinical summary + plan editor + plan
 * progress view. Plan data lives inside `evaluaciones.plan` (jsonb) and
 * is updated through `upsertEvaluacionAction` with optimistic concurrency
 * via the evaluación's `version`.
 */
export function ObjetivosTab({ cliente, evaluacion }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  // Hooks must run unconditionally — keep them above the early return so the
  // call order is stable whether or not the evaluación exists yet.
  const persistedSesiones = evaluacion ? sesionesOf(evaluacion.plan) : [];
  const [optimisticSesiones, applyOptimisticToggle] = useOptimistic(
    persistedSesiones,
    (state, sesionId: string) =>
      state.map((s) =>
        s.id === sesionId ? { ...s, completada: !s.completada } : s,
      ),
  );

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
          Cuando completes anamnesis, estilo de vida y diagnóstico en la
          pestaña
          <span className="font-medium"> Evaluación</span>, vas a poder
          definir el objetivo y el plan de tratamiento desde aquí.
        </p>
      </div>
    );
  }

  // Narrow the non-null evaluación into a local so closures keep the
  // narrowing — TS only narrows for the immediate scope after early return.
  const evaluation = evaluacion;
  const hasPlan = planHasContent(evaluation.plan);
  const sesiones = optimisticSesiones;
  const hasSesiones = sesiones.length > 0;

  function savePlan(next: PlanData, onDone?: () => void) {
    startTransition(async () => {
      const result = await upsertEvaluacionAction(
        cliente.id,
        { plan: next },
        evaluation.version,
      );
      if (!result.success) {
        if (result.errors?.version?.includes("conflict")) {
          toast.error("Otro usuario actualizó esta evaluación. Refrescando…");
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
    // `useOptimistic` requires updates inside a transition so React can
    // discard them if the action errors before commit.
    startTransition(async () => {
      applyOptimisticToggle(sesionId);
      const nextSesiones = persistedSesiones.map((s) =>
        s.id === sesionId ? { ...s, completada: !s.completada } : s,
      );
      const result = await upsertEvaluacionAction(
        cliente.id,
        { plan: { ...evaluation.plan, sesiones: nextSesiones } },
        evaluation.version,
      );
      if (!result.success) {
        if (result.errors?.version?.includes("conflict")) {
          toast.error("Otro usuario actualizó esta evaluación. Refrescando…");
          router.refresh();
          return;
        }
        toast.error(result.message ?? "No se pudo guardar el plan.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5">
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

      <ResumenClinicoCard evaluacion={evaluation} />

      <SectionCard
        icon={TargetIcon}
        title={
          hasSesiones && evaluation.plan.nombrePlan
            ? evaluation.plan.nombrePlan
            : "Plan de tratamiento"
        }
        tone="copper"
      >
        {hasSesiones ? (
          <PlanProgressView
            plan={evaluation.plan}
            sesiones={sesiones}
            onToggleSesion={handleToggleSesion}
            pending={pending}
          />
        ) : hasPlan ? (
          <PlanSummary plan={evaluation.plan} />
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

      <PlanEditorDialog
        open={editing}
        onClose={() => setEditing(false)}
        plan={evaluation.plan}
        clienteName={cliente.profile.full_name ?? "Clienta"}
        onSave={(next) => savePlan(next, () => setEditing(false))}
        saving={pending}
      />
    </div>
  );
}
