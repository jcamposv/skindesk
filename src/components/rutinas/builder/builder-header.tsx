"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormContext, useWatch } from "react-hook-form";
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  DownloadIcon,
  MoonIcon,
  SendIcon,
  SunIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  assignRutinaToClienteAction,
  createRutinaAction,
  updateRutinaAction,
} from "@/actions/rutinas.actions";
import type { ActionState } from "@/types/supabase";
import { AssignRutinaDialog } from "@/components/rutinas/assign-rutina-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  RUTINA_MOMENTOS,
  type UpsertRutinaInput,
} from "@/schemas/rutinas.schema";

interface BuilderHeaderProps {
  /** Persisted rutina id, owned by the parent `RutinaBuilder` so the
   *  header and the phone preview see the same value. The header calls
   *  `onPersisted` after a fresh save so the preview can light up the
   *  "Descargar PDF" CTA. */
  rutinaId: string | null;
  onPersisted: (id: string) => void;
  clientes: Array<{ id: string; fullName: string }>;
  /** Display name of the preselected clienta — comes from the page server
   *  when the builder was opened via `?cliente=<id>` or for an existing
   *  assignment routine. Drives the confirmation chip in the assign
   *  dialog. */
  preselectedClienteName: string | null;
}

/**
 * Top toolbar. Reads from RHF context (no prop drilling), drives:
 *   · routine name input
 *   · momento toggle (AM / PM / Ambos)
 *   · Save to library (create or update via server action)
 *   · Assign to client (opens dialog)
 *
 * The RHF schema is the source of truth — every field is `register`-ed
 * here or in `BuilderMeta` so validation flows through `useForm`.
 */
export function BuilderHeader({
  rutinaId,
  onPersisted,
  clientes,
  preselectedClienteName,
}: BuilderHeaderProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    trigger,
    setFocus,
    formState,
  } = useFormContext<UpsertRutinaInput>();
  const momento = useWatch<UpsertRutinaInput, "momento">({ name: "momento" });
  // Live subscription so the readiness indicator and disabled state stay
  // in sync as the user types / adds steps.
  const nameLive = useWatch<UpsertRutinaInput, "name">({ name: "name" });
  const stepsLive = useWatch<UpsertRutinaInput, "steps">({ name: "steps" });
  // When the builder was opened from the cliente detail page
  // (`?cliente=<id>`), the form arrives with `clienteId` pre-filled. We
  // pass it to the dialog so the picker disappears entirely.
  const preselectedCliente = useWatch<UpsertRutinaInput, "clienteId">({
    name: "clienteId",
  });
  const [pending, startTransition] = useTransition();
  const [assignOpen, setAssignOpen] = useState(false);
  // Parent owns the persisted id (it's also read by the phone preview).
  // The header just reads + notifies upward via `onPersisted`.
  const persistedId = rutinaId;

  const nameError = formState.errors.name?.message;
  const nameMissing = !nameLive || nameLive.trim().length < 2;
  const stepsMissing = (stepsLive?.length ?? 0) === 0;
  const ready = !nameMissing && !stepsMissing;
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const { ref: rhfNameRef, ...rhfNameRest } = register("name");

  function focusFirstIssue(): boolean {
    if (nameMissing) {
      setFocus("name");
      nameInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return true;
    }
    if (stepsMissing) {
      // The steps zone is below the header; scroll to it so the user sees
      // the "no steps yet" empty state.
      document
        .getElementById("rutina-steps-anchor")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
    return false;
  }

  function persist() {
    if (focusFirstIssue()) {
      // Force RHF to surface the inline message on `name` too.
      void trigger("name");
      return;
    }
    handleSubmit(async (values) => {
      startTransition(async () => {
        const action = persistedId
          ? updateRutinaAction(persistedId, values)
          : createRutinaAction(values);
        const res = await action;
        if (!res.success) {
          toast.error(res.message ?? "No se pudo guardar la rutina.");
          return;
        }
        const wasFresh = !persistedId;
        toast.success(res.message ?? "Rutina guardada.");
        const id = res.data?.rutinaId ?? persistedId;
        if (id && wasFresh) {
          onPersisted(id);
          // The URL swap from `/rutinas/nueva` → `/rutinas/<id>/editar`
          // happens here; `router.refresh()` below picks up the new tree.
          history.replaceState(null, "", `${ROUTES.rutinas}/${id}/editar`);
        }
        router.refresh();
      });
    })();
  }

  /**
   * Silent save used by the assign dialog. No toast (the dialog's
   * "Rutina asignada" toast is the single confirmation), no
   * `router.refresh()` (the assign action revalidates the page itself).
   * Returns the rutina id, or `null` on failure. Accepts an optional
   * `overrides` patch applied to the form right before saving — used by
   * the cliente-context flow to inject the message + clientId picked in
   * the dialog without forcing the user to re-type them in the form.
   */
  async function persistSilent(
    overrides?: Partial<UpsertRutinaInput>,
  ): Promise<string | null> {
    if (overrides) {
      for (const [key, value] of Object.entries(overrides)) {
        setValue(key as keyof UpsertRutinaInput, value as never, {
          shouldDirty: true,
        });
      }
    }
    return new Promise((resolve) => {
      handleSubmit(
        async (values) => {
          const action = persistedId
            ? updateRutinaAction(persistedId, values)
            : createRutinaAction(values);
          const res = await action;
          if (!res.success) {
            toast.error(res.message ?? "No se pudo guardar la rutina.");
            resolve(null);
            return;
          }
          const id = res.data?.rutinaId ?? persistedId;
          if (id && !persistedId) {
            onPersisted(id);
            history.replaceState(null, "", `${ROUTES.rutinas}/${id}/editar`);
          }
          resolve(id ?? null);
        },
        () => resolve(null),
      )();
    });
  }

  /**
   * Owns the save + assign side effects fired by the dialog. There are
   * two distinct flows here:
   *
   *  1. **Template flow** — the builder was opened via `/rutinas/nueva`
   *     with no `?cliente=<id>`. Form kind is `template`. We persist the
   *     template (or skip if already saved), then call
   *     `assignRutinaToClienteAction` which clones it into a fresh
   *     `assignment` rutina for the picked clienta.
   *
   *  2. **Cliente-context flow** — the builder was opened from a
   *     clienta detail page (`?cliente=<id>`). Form kind is `assignment`
   *     with `clienteId` already pre-filled. The save IS the assignment;
   *     no extra clone step is needed. Calling
   *     `assignRutinaToClienteAction` here would fail with "Plantilla no
   *     encontrada" because that action only accepts templates.
   */
  async function handleAssignSubmit(
    clienteId: string,
    message: string,
  ): Promise<ActionState<{ rutinaId: string }>> {
    const formKind = getValues("kind");

    if (formKind === "assignment") {
      const id = await persistSilent({
        clienteId,
        clientMessage: message,
      });
      if (!id) {
        return { success: false, message: "No se pudo guardar la rutina." };
      }
      return {
        success: true,
        message: "Rutina asignada a la clienta.",
        data: { rutinaId: id },
      };
    }

    // Template flow — save the template if it isn't persisted, then clone
    // it into a new assignment for the picked clienta.
    let id = persistedId;
    if (!id) {
      id = await persistSilent();
      if (!id) {
        return { success: false, message: "No se pudo guardar la rutina." };
      }
    }
    return assignRutinaToClienteAction(id, clienteId, message);
  }

  async function handleAssignClick() {
    // Validate up-front so the user sees missing-field hints BEFORE the
    // dialog opens. Persistence is deferred to the dialog's confirm step
    // so there's no premature "Rutina guardada" toast — the single
    // "Rutina asignada" toast at the end is the only confirmation.
    if (focusFirstIssue()) {
      void trigger("name");
      return;
    }
    const ok = await trigger();
    if (!ok) {
      focusFirstIssue();
      return;
    }
    if (getValues("steps").length === 0) {
      focusFirstIssue();
      return;
    }
    setAssignOpen(true);
  }

  return (
    <header className="flex flex-col gap-2 border-b bg-card px-5 py-3 shadow-[0_1px_6px_rgba(0,0,0,.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Volver"
            render={<Link href={ROUTES.rutinas} />}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              {persistedId ? "Editar rutina" : "Nueva rutina"}
              <span
                aria-hidden="true"
                className="text-[#BB7154]"
                title="Campo requerido"
              >
                *
              </span>
            </span>
            <Input
              {...rhfNameRest}
              ref={(el) => {
                rhfNameRef(el);
                nameInputRef.current = el;
              }}
              placeholder="Nombre de la rutina (ej: Rutina AM piel mixta)"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "rutina-name-error" : undefined}
              className={cn(
                "h-8 min-w-[260px] border-0 bg-transparent px-0 font-heading text-base font-medium focus-visible:ring-0",
                nameError && "text-destructive placeholder:text-destructive/60",
              )}
            />
            {nameError ? (
              <span
                id="rutina-name-error"
                className="flex items-center gap-1 text-[11px] font-medium text-destructive"
              >
                <AlertCircleIcon className="size-3" />
                {String(nameError)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="radiogroup"
            aria-label="Momento del día"
            className="inline-flex items-center rounded-md border bg-muted/40 p-0.5"
          >
            {RUTINA_MOMENTOS.map((m) => (
              <MomentToggle
                key={m}
                value={m}
                active={momento === m}
                onSelect={() =>
                  setValue("momento", m, { shouldDirty: true })
                }
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => persist()}
            disabled={pending}
          >
            {pending ? "Guardando…" : "Guardar en biblioteca"}
          </Button>
          {persistedId ? (
            // PDF route streams the rendered document; using a plain anchor
            // keeps it out of the React-PDF client bundle entirely. The
            // route is server-only so the heavy renderer never reaches the
            // browser. Disabled-by-omission when the rutina isn't saved
            // yet — the route fetches by id and would 404 anyway.
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              render={
                <a
                  href={`${ROUTES.rutinas}/${persistedId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <DownloadIcon className="size-3.5" />
              PDF
            </Button>
          ) : null}
          <Button
            type="button"
            variant="cta"
            size="sm"
            className="gap-1.5"
            onClick={handleAssignClick}
            disabled={pending}
          >
            <SendIcon className="size-3.5" />
            Asignar a clienta
          </Button>
        </div>
      </div>

      {/* Readiness microcopy — explains what's missing BEFORE the user
          clicks save/assign. Disappears when everything is filled. */}
      {!ready ? (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <AlertCircleIcon className="size-3.5 text-[#BB7154]" />
          <span>Para guardar necesitas:</span>
          {nameMissing ? (
            <span className="rounded-full bg-[#FBEFE7] px-2 py-0.5 font-medium text-[#8C4A30]">
              Nombre
            </span>
          ) : null}
          {stepsMissing ? (
            <span className="rounded-full bg-[#FBEFE7] px-2 py-0.5 font-medium text-[#8C4A30]">
              Al menos 1 paso
            </span>
          ) : null}
        </div>
      ) : null}

      <AssignRutinaDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        preselectedClienteId={preselectedCliente || undefined}
        preselectedClienteName={preselectedClienteName ?? undefined}
        clientes={clientes}
        onSubmit={handleAssignSubmit}
      />
    </header>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

interface MomentToggleProps {
  value: "am" | "pm" | "both";
  active: boolean;
  onSelect: () => void;
}

function MomentToggle({ value, active, onSelect }: MomentToggleProps) {
  const label =
    value === "am" ? "AM" : value === "pm" ? "PM" : "Ambos";
  const Icon =
    value === "am" ? SunIcon : value === "pm" ? MoonIcon : null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-semibold transition-colors",
        active
          ? value === "am"
            ? "bg-[#C47A2B] text-white"
            : value === "pm"
              ? "bg-[#6B4FA0] text-white"
              : "bg-[#5C6E6C] text-white"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {Icon ? <Icon className="size-3" /> : null}
      {label}
    </button>
  );
}
