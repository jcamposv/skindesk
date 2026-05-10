"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ClipboardListIcon, LeafIcon, ScanFaceIcon } from "lucide-react";
import { toast } from "sonner";

import { upsertEvaluacionAction } from "@/actions/evaluaciones.actions";
import { Step2Anamnesis } from "@/components/evaluaciones/step-2-anamnesis";
import { Step3Habitos } from "@/components/evaluaciones/step-3-habitos";
import { Step4Diagnostico } from "@/components/evaluaciones/step-4-diagnostico";
import {
  useAutosave,
  type AutosaveStatus,
} from "@/components/evaluaciones/use-autosave";
import {
  EvaluacionFormContext,
  type EvaluacionFormValues,
} from "@/components/evaluaciones/evaluacion-form-context";
import { AutosaveIndicator } from "@/components/shared/autosave-indicator";
import { cn } from "@/lib/utils";
import type { ClienteDetail } from "@/services/clientes.service";
import { emptyEvaluacion, type Evaluacion } from "@/types/evaluacion";

const SUBTABS = [
  { key: "anamnesis", label: "Anamnesis", icon: ClipboardListIcon },
  { key: "estilo", label: "Estilo de vida", icon: LeafIcon },
  { key: "diagnostico", label: "Diagnóstico de la piel", icon: ScanFaceIcon },
] as const;

type SubTabKey = (typeof SUBTABS)[number]["key"];

interface Props {
  cliente: ClienteDetail;
  /** Server-loaded evaluación. Null when the clienta has none yet — the
   *  first autosave will lazily upsert one via the server action. */
  initialEvaluacion: Evaluacion | null;
  profesionalNombre?: string;
}

/**
 * Evaluation tab embedded in the cliente detail. Holds the shared form,
 * autosaves to Supabase via `upsertEvaluacionAction`, and renders the active
 * sub-tab body. Sub-tab chooser is sticky so it stays in context while the
 * user scrolls long sections.
 */
export function EvaluacionTab({
  cliente,
  initialEvaluacion,
  profesionalNombre = "Profesional",
}: Props) {
  const [active, setActive] = useState<SubTabKey>("anamnesis");

  const initial = useMemo<EvaluacionFormValues>(() => {
    if (initialEvaluacion) {
      return {
        datos: initialEvaluacion.datos,
        anamnesis: initialEvaluacion.anamnesis,
        habitos: initialEvaluacion.habitos,
        diagnostico: initialEvaluacion.diagnostico,
        plan: initialEvaluacion.plan,
      };
    }
    const seeded = emptyEvaluacion(
      cliente.id,
      cliente.profile.full_name ?? "Sin nombre",
      profesionalNombre,
    );
    return {
      datos: seeded.datos,
      anamnesis: seeded.anamnesis,
      habitos: seeded.habitos,
      diagnostico: seeded.diagnostico,
      plan: seeded.plan,
    };
  }, [
    initialEvaluacion,
    cliente.id,
    cliente.profile.full_name,
    profesionalNombre,
  ]);

  const form = useForm<EvaluacionFormValues>({
    defaultValues: initial,
    mode: "onBlur",
  });

  const router = useRouter();

  // Snapshot of the last successfully persisted values per section. We
  // diff against this on each save to send ONLY the sections that
  // actually changed, avoiding wasteful 25KB JSONB rewrites on every
  // keystroke. Uses JSON serialization for equality — the section shapes
  // are pure data (no Dates, no functions) so this is exact.
  const lastSavedRef = useRef<{
    [K in keyof EvaluacionFormValues]: string;
  }>({
    datos: JSON.stringify(initial.datos),
    anamnesis: JSON.stringify(initial.anamnesis),
    habitos: JSON.stringify(initial.habitos),
    diagnostico: JSON.stringify(initial.diagnostico),
    plan: JSON.stringify(initial.plan),
  });

  // Optimistic-concurrency cursor. Starts from whatever version we read on
  // the server; bumps after each successful save. If a concurrent editor
  // bumps it ahead of us, the action returns a 409-style conflict and we
  // refresh + reset the cursor.
  const versionRef = useRef<number | undefined>(initialEvaluacion?.version);

  const autosave = useAutosave<EvaluacionFormValues>({
    form,
    enabled: cliente.id,
    onSave: async (values) => {
      // Build a section-level diff against the last persisted snapshot.
      const patch: {
        datos?: typeof values.datos;
        anamnesis?: typeof values.anamnesis;
        habitos?: typeof values.habitos;
        diagnostico?: typeof values.diagnostico;
        plan?: typeof values.plan;
      } = {};
      const nextSerialized: Partial<typeof lastSavedRef.current> = {};

      const sections = [
        "datos",
        "anamnesis",
        "habitos",
        "diagnostico",
        "plan",
      ] as const;
      for (const key of sections) {
        const serialized = JSON.stringify(values[key]);
        if (serialized !== lastSavedRef.current[key]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (patch as any)[key] = values[key];
          nextSerialized[key] = serialized;
        }
      }

      // Nothing changed since the last save — skip the round-trip entirely.
      if (Object.keys(patch).length === 0) return;

      const result = await upsertEvaluacionAction(
        cliente.id,
        patch,
        versionRef.current,
      );

      if (!result.success) {
        // Concurrent edit detected → toast + refresh so the user sees the
        // freshest server data; their dirty form values stay in RHF and
        // they can save on top of the new baseline.
        if (result.errors?.version?.includes("conflict")) {
          toast.error(
            "Otro usuario actualizó esta evaluación. Refrescando…",
          );
          router.refresh();
          throw new Error("version_conflict");
        }
        toast.error(result.message ?? "No se pudo guardar la evaluación.");
        // Throw so useAutosave keeps the form in `dirty` state — the user
        // sees "Cambios sin guardar" and can retry via "Guardar ahora".
        throw new Error("save_failed");
      }

      // Persist the new snapshot + bump the cursor.
      Object.assign(lastSavedRef.current, nextSerialized);
      if (result.data?.version != null) {
        versionRef.current = result.data.version;
      }
    },
  });

  // Guard against losing in-flight changes.
  useEffect(() => {
    const isPending =
      autosave.status === "dirty" || autosave.status === "saving";
    if (!isPending) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [autosave.status]);

  const ctxValue = useMemo(
    () => ({
      form,
      cliente: {
        id: cliente.id,
        nombre: cliente.profile.full_name ?? "Sin nombre",
        email: cliente.profile.email,
        avatarUrl: cliente.profile.avatar_url,
        birthDate: cliente.birth_date,
        lastAppointmentAt: cliente.last_appointment_at,
      },
      profesionalNombre,
    }),
    [form, cliente, profesionalNombre],
  );

  return (
    <EvaluacionFormContext.Provider value={ctxValue}>
      <div className="grid gap-4">
        <StickySubTabs
          active={active}
          onChange={setActive}
          autosave={autosave.status}
          lastSavedAt={autosave.lastSavedAt}
          onSaveNow={autosave.saveNow}
        />

        <div
          key={active}
          className="motion-safe:animate-[wizard-slide-in_220ms_cubic-bezier(0.2,0.7,0.2,1)] min-w-0"
        >
          {active === "anamnesis" ? <Step2Anamnesis /> : null}
          {active === "estilo" ? <Step3Habitos /> : null}
          {active === "diagnostico" ? <Step4Diagnostico /> : null}
        </div>
      </div>
    </EvaluacionFormContext.Provider>
  );
}

// ─── Sticky sub-tabs bar ────────────────────────────────────────────────────

interface StickySubTabsProps {
  active: SubTabKey;
  onChange: (k: SubTabKey) => void;
  autosave: AutosaveStatus;
  lastSavedAt: Date | null;
  onSaveNow: () => void;
}

function StickySubTabs({
  active,
  onChange,
  autosave,
  lastSavedAt,
  onSaveNow,
}: StickySubTabsProps) {
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-border/60 bg-background/85 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Secciones de la evaluación"
          className="inline-flex items-center gap-0.5 rounded-xl bg-muted/60 p-1 shadow-inner ring-1 ring-border/40"
        >
          {SUBTABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(t.key)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5C6E6C]/30",
                  isActive
                    ? "bg-card font-medium text-[#5C6E6C] shadow-sm"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-3.5",
                    isActive ? "text-[#BB7154]" : "opacity-70",
                  )}
                />
                {t.label}
              </button>
            );
          })}
        </div>

        <AutosaveIndicator
          status={autosave}
          lastSavedAt={lastSavedAt}
          onSaveNow={onSaveNow}
        />
      </div>
    </div>
  );
}

