"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { CheckCircle2Icon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import {
  listServiciosForClienteCitaAction,
  type CitaServicioOption,
  type SlotSuggestion,
} from "@/actions/citas.actions";

import { SlotAvailability } from "./slot-availability";

import {
  citaCreateSchema,
  type CitaCreateInput,
  type CitaStatus,
  type CitaUpdateInput,
} from "@/schemas/citas.schema";
import type { ClientePickerItem } from "@/services/clientes.service";
import type { StaffMember } from "@/services/staff.service";
import type { AgendaCita } from "@/services/citas.service";

const STATUS_OPTIONS: { value: CitaStatus; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "confirmada", label: "Confirmada" },
  { value: "completada", label: "Completada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "ausente", label: "No asistió" },
];

export type CitaDialogState =
  | {
      mode: "create";
      defaults: {
        startAt: string;
        endAt: string;
        /** Pre-fill the professional column (resource-view slot click). */
        professionalId?: string;
        /** Pre-fill the clienta (opens from a clienta page). */
        clienteId?: string;
      };
    }
  | { mode: "edit"; cita: AgendaCita };

interface CitaDialogProps {
  state: CitaDialogState;
  clientes: ClientePickerItem[];
  staff: StaffMember[];
  currentProfesional: { id: string; full_name: string };
  saving: boolean;
  onClose: () => void;
  onCreate: (input: CitaCreateInput) => Promise<void> | void;
  onUpdate: (
    id: string,
    input: CitaUpdateInput,
    expectedVersion: number,
  ) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

export function CitaDialog({
  state,
  clientes,
  staff,
  currentProfesional,
  saving,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: CitaDialogProps) {
  return (
    <Sheet open onOpenChange={(o) => (o ? null : onClose())}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <CitaDialogBody
          state={state}
          clientes={clientes}
          staff={staff}
          currentProfesional={currentProfesional}
          saving={saving}
          onClose={onClose}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </SheetContent>
    </Sheet>
  );
}

function CitaDialogBody({
  state,
  clientes,
  staff,
  currentProfesional,
  saving,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: CitaDialogProps) {
  const isEdit = state.mode === "edit";
  const initialCita = isEdit ? state.cita : null;

  const createDefaults = state.mode === "create" ? state.defaults : null;

  // Inference does the work — passing the type explicitly fights RHF's
  // new 3-generic signature (Values / Context / TransformedValues) and
  // re-introduces the `as any` resolver dance.
  const form = useForm({
    resolver: zodResolver(citaCreateSchema),
    defaultValues: {
      clienteId:
        initialCita?.clienteId ?? createDefaults?.clienteId ?? "",
      servicioId: initialCita?.servicioId ?? null,
      professionalId:
        initialCita?.professionalId ??
        createDefaults?.professionalId ??
        currentProfesional.id ??
        null,
      professionalLabel:
        initialCita?.professionalId == null
          ? initialCita?.professionalName ?? ""
          : "",
      title: initialCita?.title ?? "",
      startAt: initialCita?.startAt ?? createDefaults?.startAt ?? "",
      endAt: initialCita?.endAt ?? createDefaults?.endAt ?? "",
      status: (initialCita?.status ?? "pendiente") as CitaStatus,
      notes: initialCita?.notes ?? "",
      cancellationReason: initialCita?.cancellationReason ?? "",
    },
  });

  // `values` is the parsed (output) shape of `citaCreateSchema` — cast at
  // the boundary so the action signatures stay strict without sprinkling
  // generics through the JSX above. Handlers already return Promise<void>.
  async function onValid(values: unknown) {
    const input = values as CitaCreateInput;
    if (isEdit) {
      await onUpdate(state.cita.id, input, state.cita.version);
    } else {
      await onCreate(input);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onValid)}
        className="flex h-full min-h-0 flex-col"
      >
        <SheetHeader className="gap-0.5 border-b px-5 pt-4 pb-3">
          <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            {isEdit ? "Editar cita" : "Nueva cita"}
          </p>
          <SheetTitle>
            {isEdit ? state.cita.title : "Agendar cita"}
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            {isEdit
              ? "Actualizá los datos o eliminá la cita del calendario."
              : "Completá los datos para agendar la cita."}
          </SheetDescription>
        </SheetHeader>

        <div className="grid flex-1 min-h-0 gap-4 overflow-y-auto px-5 py-4">
          <FormField
            control={form.control}
            name="clienteId"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel
                  htmlFor="cita-cliente"
                  className="text-[11px] font-medium text-muted-foreground"
                >
                  Clienta
                </FormLabel>
                <select
                  id="cita-cliente"
                  autoFocus
                  aria-invalid={fieldState.invalid || undefined}
                  aria-describedby={
                    fieldState.error ? "cita-cliente-error" : undefined
                  }
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="h-10 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">Seleccionar clienta…</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
                <FormMessage id="cita-cliente-error" />
              </FormItem>
            )}
          />

          <DateAndTimeFields form={form} />

          <SlotAvailabilityWatcher
            form={form}
            excludeCitaId={isEdit ? state.cita.id : undefined}
          />

          <FormField
            control={form.control}
            name="professionalId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-medium text-muted-foreground">
                  Profesional responsable
                </FormLabel>
                <select
                  value={(field.value as string | null) ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : e.target.value)
                  }
                  className="h-10 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">Sin asignar</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-medium text-muted-foreground">
                  Estado
                </FormLabel>
                <div
                  role="radiogroup"
                  aria-label="Estado de la cita"
                  className="flex flex-wrap gap-1.5"
                  onKeyDown={(e) => {
                    // Arrow-key navigation between status pills (WCAG
                    // radiogroup pattern). Left/Up → previous, Right/Down
                    // → next; wraps at the edges.
                    if (
                      e.key !== "ArrowLeft" &&
                      e.key !== "ArrowRight" &&
                      e.key !== "ArrowUp" &&
                      e.key !== "ArrowDown"
                    )
                      return;
                    e.preventDefault();
                    const idx = STATUS_OPTIONS.findIndex(
                      (o) => o.value === field.value,
                    );
                    const dir =
                      e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
                    const next =
                      (idx + dir + STATUS_OPTIONS.length) %
                      STATUS_OPTIONS.length;
                    field.onChange(STATUS_OPTIONS[next].value);
                  }}
                >
                  {STATUS_OPTIONS.map((s) => {
                    const isActive = field.value === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        // Only the active radio is in the tab order — Tab
                        // moves into the group once, arrows move between.
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => field.onChange(s.value)}
                        className={cn(
                          "min-h-9 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB7154]/40",
                          isActive
                            ? "border-[#BB7154] bg-[#F6E0D6] text-[#8C4A30]"
                            : "border-border/60 bg-card text-muted-foreground hover:border-[#BB7154]/40",
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* C16 · Optional service link. Watches `clienteId`, fetches her
              services on change. Empty when no clienta is picked yet. */}
          <ServicioPickerField form={form} />

          {/* C15 · cancellation_reason — only visible when status is cancelada.
              The zod superRefine enforces required-when + blank-when-not. */}
          <CancellationReasonField form={form} />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-medium text-muted-foreground">
                  Título (opcional)
                </FormLabel>
                <Input
                  value={(field.value as string) ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder="Ej. Limpieza profunda · primera sesión"
                  className="h-10"
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] font-medium text-muted-foreground">
                  Notas internas (opcional)
                </FormLabel>
                <textarea
                  value={(field.value as string) ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                  rows={2}
                  placeholder="Recordatorio interno, preparación previa…"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <footer className="mt-auto flex items-center justify-between gap-2 border-t bg-card/80 px-5 py-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="gap-1.5"
            >
              Cancelar
            </Button>
            {isEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDelete(state.cita.id)}
                className="gap-1.5 border-[#C58F8A]/40 text-[#7A3F3C] hover:bg-[#FBE4E0]/40"
              >
                <Trash2Icon className="size-3.5" />
                Eliminar
              </Button>
            ) : null}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={saving}
            className="gap-1.5 bg-[#5C6E6C] text-white shadow-sm hover:bg-[#4F605C]"
          >
            <CheckCircle2Icon className="size-3.5" />
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Agendar"}
          </Button>
        </footer>
      </form>
    </Form>
  );
}

// ─── Service picker (optional link) ────────────────────────────────────────

/** Optional servicio link for the cita. Watches `clienteId` — when it
 *  changes, refetches the clienta's services. Hidden when no clienta is
 *  selected (the picker would be empty anyway). The cita stays valid
 *  with `servicioId = null` for one-off consultas. */
function ServicioPickerField({
  form,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: ReturnType<typeof useForm<any>>;
}) {
  const clienteId = useWatch({ control: form.control, name: "clienteId" }) as
    | string
    | undefined;
  const [options, setOptions] = useState<CitaServicioOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clienteId) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await listServiciosForClienteCitaAction(clienteId);
      if (cancelled) return;
      setLoading(false);
      if (res.success && res.data) setOptions(res.data);
      else setOptions([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  if (!clienteId) return null;

  return (
    <FormField
      control={form.control}
      name="servicioId"
      render={({ field }) => (
        <FormItem>
          <FormLabel
            htmlFor="cita-servicio"
            className="text-[11px] font-medium text-muted-foreground"
          >
            Servicio (opcional)
          </FormLabel>
          <select
            id="cita-servicio"
            value={(field.value as string | null) ?? ""}
            onChange={(e) =>
              field.onChange(e.target.value === "" ? null : e.target.value)
            }
            disabled={loading}
            className="h-10 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">
              {loading
                ? "Cargando servicios…"
                : options.length === 0
                  ? "Sin servicios para esta clienta"
                  : "Sin asociar a un servicio"}
            </option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.status === "completed" || s.status === "cancelled"
                  ? ` · ${s.status}`
                  : ""}
              </option>
            ))}
          </select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// ─── Cancellation reason (conditional field) ───────────────────────────────

/** Renders the cancellation reason textarea only when status is
 *  `cancelada`. Watched separately so the rest of the form doesn't
 *  re-render on every keystroke of the reason. */
function CancellationReasonField({
  form,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: ReturnType<typeof useForm<any>>;
}) {
  const status = useWatch({ control: form.control, name: "status" }) as
    | CitaStatus
    | undefined;
  if (status !== "cancelada") return null;
  return (
    <FormField
      control={form.control}
      name="cancellationReason"
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel
            htmlFor="cita-cancel-reason"
            className="text-[11px] font-medium text-muted-foreground"
          >
            Motivo de cancelación
          </FormLabel>
          <textarea
            id="cita-cancel-reason"
            rows={2}
            value={(field.value as string) ?? ""}
            onChange={(e) => field.onChange(e.target.value)}
            aria-invalid={fieldState.invalid || undefined}
            placeholder="Ej. La clienta avisó por WhatsApp que no podía venir."
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// ─── Date + time picker block (replaces the two datetime-local inputs) ─────

/** Single date input + two time inputs that read/write the form's
 *  `startAt` / `endAt` ISO fields. Citas live on one day, so we only need
 *  to pick the day once — saves vertical space and is the same pattern as
 *  shadcn's date-and-time picker. */
function DateAndTimeFields({
  form,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: ReturnType<typeof useForm<any>>;
}) {
  const startAt = useWatch({ control: form.control, name: "startAt" }) as
    | string
    | undefined;
  const endAt = useWatch({ control: form.control, name: "endAt" }) as
    | string
    | undefined;

  const startParts = splitLocal(startAt ?? "");
  const endParts = splitLocal(endAt ?? "");
  // Day is shared — pull from start; fall back to end if start is empty.
  const day = startParts.date || endParts.date;

  function handleDayChange(nextDay: string) {
    if (!nextDay) return;
    form.setValue(
      "startAt",
      combineLocal(nextDay, startParts.time || endParts.time || "09:00"),
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue(
      "endAt",
      combineLocal(nextDay, endParts.time || startParts.time || "10:00"),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  function handleStartTimeChange(nextTime: string) {
    form.setValue("startAt", combineLocal(day, nextTime), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleEndTimeChange(nextTime: string) {
    form.setValue("endAt", combineLocal(day, nextTime), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <div className="grid gap-3">
      <FormField
        control={form.control}
        name="startAt"
        render={() => (
          <FormItem>
            <FormLabel
              htmlFor="cita-day"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Día
            </FormLabel>
            <Input
              id="cita-day"
              type="date"
              value={day}
              onChange={(e) => handleDayChange(e.target.value)}
              className="h-10"
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormItem>
          <FormLabel
            htmlFor="cita-start-time"
            className="text-[11px] font-medium text-muted-foreground"
          >
            Inicio
          </FormLabel>
          <Input
            id="cita-start-time"
            type="time"
            value={startParts.time}
            onChange={(e) => handleStartTimeChange(e.target.value)}
            className="h-10"
          />
        </FormItem>
        <FormField
          control={form.control}
          name="endAt"
          render={() => (
            <FormItem>
              <FormLabel
                htmlFor="cita-end-time"
                className="text-[11px] font-medium text-muted-foreground"
              >
                Fin
              </FormLabel>
              <Input
                id="cita-end-time"
                type="time"
                value={endParts.time}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                className="h-10"
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

/** Wires the watched form fields into <SlotAvailability> and writes back
 *  via setValue when the user clicks a suggestion chip. Kept separate so
 *  the watch subscription only re-renders this subtree, not the whole
 *  dialog body. */
function SlotAvailabilityWatcher({
  form,
  excludeCitaId,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: ReturnType<typeof useForm<any>>;
  excludeCitaId?: string;
}) {
  const startAt = useWatch({ control: form.control, name: "startAt" }) as
    | string
    | undefined;
  const endAt = useWatch({ control: form.control, name: "endAt" }) as
    | string
    | undefined;
  const professionalId = useWatch({
    control: form.control,
    name: "professionalId",
  }) as string | null | undefined;

  const handlePick = useCallback(
    (slot: SlotSuggestion) => {
      form.setValue("startAt", slot.startAt, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("endAt", slot.endAt, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form],
  );

  return (
    <SlotAvailability
      startAt={startAt ?? ""}
      endAt={endAt ?? ""}
      professionalId={professionalId ?? null}
      excludeCitaId={excludeCitaId}
      onPickSuggestion={handlePick}
    />
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** ISO datetime → `{ date: "YYYY-MM-DD", time: "HH:mm" }` for the split
 *  date + time inputs. Uses local TZ (matches what the user sees). */
function splitLocal(iso: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

/** `YYYY-MM-DD` + `HH:mm` (both local) → full ISO. Returns "" if either
 *  half is missing so a partially-edited form doesn't produce a garbage
 *  timestamp the schema would reject. */
function combineLocal(date: string, time: string): string {
  if (!date || !time) return "";
  const d = new Date(`${date}T${time}`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

