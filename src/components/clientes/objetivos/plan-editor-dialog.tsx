"use client";

import { useState } from "react";
import {
  CalendarIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  FRECUENCIAS,
  TRATAMIENTOS_RECOMENDADOS,
  type PlanData,
  type PlanSesion,
} from "@/types/evaluacion";

import { makeSesion, sesionesOf } from "./helpers";

interface PlanEditorDialogProps {
  open: boolean;
  onClose: () => void;
  plan: PlanData;
  clienteName: string;
  onSave: (next: PlanData) => void;
  saving: boolean;
}

/**
 * Centered Dialog (not a side Sheet) — multi-column session table needs
 * the horizontal real estate. Capped at `sm:max-w-5xl`; on narrow
 * viewports the base shadcn `Dialog` falls back to `calc(100%-2rem)`.
 */
export function PlanEditorDialog({
  open,
  onClose,
  plan,
  clienteName,
  onSave,
  saving,
}: PlanEditorDialogProps) {
  const hasExistingSesiones = (plan.sesiones?.length ?? 0) > 0;
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-5 pt-5 pb-4 text-left">
          <DialogTitle className="font-heading text-lg font-semibold">
            {hasExistingSesiones
              ? `Editar plan de sesiones · ${clienteName}`
              : `Crear plan de sesiones · ${clienteName}`}
          </DialogTitle>
        </DialogHeader>
        {/* Re-mount on open so the draft starts fresh each time without
            mirroring props into state via an effect (react-best-practices
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
    const total = sesiones.length;
    onSave({
      ...draft,
      // Sync the legacy text field so PDFs / older reads stay coherent.
      numeroSesiones:
        total > 0
          ? `${total} ${total === 1 ? "sesión" : "sesiones"}`
          : "",
    });
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="grid gap-5">
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
                  Tocá <span className="font-medium">Agregar sesión</span> para
                  empezar el cronograma.
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

          <div className="grid gap-2 rounded-xl border bg-card">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-foreground/85 hover:bg-muted/40"
              aria-expanded={showAdvanced}
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
  onPatch: <K extends keyof PlanSesion>(
    key: K,
    value: PlanSesion[K],
  ) => void;
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
    <li className="grid grid-cols-[36px_1fr_36px] items-center gap-x-2 gap-y-2 rounded-xl border border-border/60 bg-card p-2.5 md:grid-cols-[40px_minmax(0,1.4fr)_minmax(0,150px)_minmax(0,1.6fr)_40px]">
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
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Quitar sesión ${order}`}
        className="justify-self-center text-foreground/65 hover:text-destructive disabled:opacity-30 md:order-last"
      >
        <Trash2Icon className="size-4" />
      </Button>
      <div className="relative col-start-2 col-end-4 md:col-auto">
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
        className="col-start-2 col-end-4 h-9 md:col-auto"
        aria-label={`Descripción sesión ${order}`}
      />
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
