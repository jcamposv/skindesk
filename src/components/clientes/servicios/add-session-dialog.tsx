"use client";

import { useMemo } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useFormContext } from "react-hook-form";
import { CheckCircle2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  sesionFormSchemaFor,
  type AddSesionInput,
} from "@/schemas/servicios.schema";
import type { StaffMember } from "@/services/staff.service";

import { ProfesionalSelect } from "./profesional-select";
import {
  SERVICE_TYPE_LABEL,
  type AssignedService,
  type ClienteRef,
} from "./types";
import { Step3Facial } from "./steps/step-3-facial";
import { Step3Corporal } from "./steps/step-3-corporal";
import { Step3Laser } from "./steps/step-3-laser";
import { Step3Other } from "./steps/step-3-other";
import { SERVICE_VISUAL } from "./service-type-visual";

interface AddSessionDialogProps {
  /** When non-null, dialog is open for this service. */
  service: AssignedService | null;
  cliente: ClienteRef;
  /** Tenant staff used to populate the "Profesional responsable" dropdown. */
  staff: StaffMember[];
  onClose: () => void;
  /** Parent invokes the server action with this payload. */
  onSave: (
    serviceId: string,
    input: AddSesionInput,
    expectedServicioVersion: number,
  ) => Promise<void> | void;
  saving?: boolean;
}

/**
 * Dialog to register a new session for an existing service. The form is
 * driven by React Hook Form + zodResolver against
 * `sesionFormSchemaFor(service.serviceType)` — per-type strict schema
 * picked at mount time so the form data has a concrete (non-union) shape.
 *
 * Body only mounts while `service` is non-null, so each visit starts with
 * a fresh form instance (clean defaults, no stale per-field errors).
 */
export function AddSessionDialog({
  service,
  cliente,
  staff,
  onClose,
  onSave,
  saving = false,
}: AddSessionDialogProps) {
  return (
    <Dialog open={service != null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex h-[92vh] w-[calc(100%-1rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          {service ? (
            <AddSessionBody
              service={service}
              cliente={cliente}
              staff={staff}
              onClose={onClose}
              onSave={onSave}
              saving={saving}
            />
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

// ─── Body ───────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function inDaysISO(days: number) {
  return new Date(Date.now() + days * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
}

function defaultPayloadFor(serviceType: AssignedService["serviceType"]) {
  switch (serviceType) {
    case "facial":
      return {
        type: "facial",
        data: {
          zones: [],
          skinType: "",
          skinCondition: "",
          sensitivity: 0,
          acne: 0,
          hydration: 0,
          products: [],
          actives: [],
          devices: [],
          protocol: "",
          reaction: "sin-reaccion",
          recommendations: "",
        },
      };
    case "corporal":
      return {
        type: "corporal",
        data: {
          zones: [],
          measurementsBefore: "",
          measurementsAfter: "",
          pain: 0,
          inflammation: 0,
          fibrosis: 0,
          cellulite: 0,
          fluidRetention: 0,
          technique: "",
          devices: [],
          productsOrActives: [],
          observations: "",
          recommendations: "",
        },
      };
    case "laser":
      return {
        type: "laser",
        data: {
          view: "front",
          zones: [],
          fluence: "",
          pulseWidth: "",
          wavelength: "",
          shotCount: "",
          powerLevel: "",
          reaction: "sin-reaccion",
          pain: 0,
          reductionPct: "",
          nextParams: "",
          postCare: "",
        },
      };
    case "other":
      return {
        type: "other",
        data: {
          category: "",
          objective: "",
          treatedArea: "",
          protocolNotes: "",
          products: [],
          devices: [],
          recommendations: "",
        },
      };
  }
}

function defaultDurationFor(
  serviceType: AssignedService["serviceType"],
): number {
  return serviceType === "laser" ? 30 : 60;
}

function AddSessionBody({
  service,
  cliente,
  staff,
  onClose,
  onSave,
  saving,
}: {
  service: AssignedService;
  cliente: ClienteRef;
  staff: StaffMember[];
  onClose: () => void;
  onSave: (
    serviceId: string,
    input: AddSesionInput,
    expectedServicioVersion: number,
  ) => Promise<void> | void;
  saving: boolean;
}) {
  const completedCount = service.sessions.filter(
    (s) => s.status === "completed",
  ).length;
  const nextSessionNumber = completedCount + 1;
  const isAtLimit = nextSessionNumber > service.totalSessions;

  const schema = useMemo(
    () => sesionFormSchemaFor(service.serviceType),
    [service.serviceType],
  );

  // Form is typed loose (`any`) because the resolved schema is dispatched
  // at runtime on `serviceType`. Each mount's runtime shape is one concrete
  // variant of `SesionFormInput`, but TS can't narrow the discriminated
  // union from a switch return. The zod resolver does the real validation;
  // the cast at `onSave` puts the well-formed shape back on the wire.
  const form = useForm({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues: {
      sessionNumber: nextSessionNumber,
      date: todayISO(),
      durationMin: defaultDurationFor(service.serviceType),
      professionalId: service.professionalId,
      professionalLabel: service.professionalLabel,
      status: "completed",
      notes: "",
      beforePaths: [],
      afterPaths: [],
      recommendations: "",
      nextSuggestion: inDaysISO(14),
      payload: defaultPayloadFor(service.serviceType),
    },
  });

  function onValid(values: unknown) {
    void onSave(service.id, values as AddSesionInput, service.version);
  }

  const visual = SERVICE_VISUAL[service.serviceType];
  const Icon = visual.icon;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onValid)}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <header className="flex items-start justify-between gap-3 border-b px-5 pt-4 pb-3 lg:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                visual.iconBg,
                visual.iconColor,
              )}
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/75">
                {SERVICE_TYPE_LABEL[service.serviceType]}
              </p>
              <DialogPrimitive.Title className="font-heading text-base font-medium tracking-tight">
                {isAtLimit
                  ? `Servicio completado · ${service.totalSessions} de ${service.totalSessions}`
                  : `Sesión ${nextSessionNumber} de ${service.totalSessions}`}
              </DialogPrimitive.Title>
              <p className="truncate text-sm text-foreground/75">
                {service.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <XIcon className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 lg:px-6">
          {isAtLimit ? (
            <div className="grid place-items-center gap-2 rounded-2xl border border-dashed bg-card/40 px-6 py-10 text-center">
              <p className="text-[13px] font-medium text-foreground">
                Este servicio ya alcanzó el total de sesiones planificadas.
              </p>
              <p className="max-w-md text-sm text-foreground/75">
                Si quieres extender el paquete, edita el total de sesiones en el
                detalle del servicio antes de registrar más.
              </p>
            </div>
          ) : (
            <div className="grid gap-5">
              <SessionMetaBlock staff={staff} />

              {service.serviceType === "facial" ? (
                <Step3Facial cliente={cliente} />
              ) : null}
              {service.serviceType === "corporal" ? (
                <Step3Corporal
                  cliente={cliente}
                  isPostOp={Boolean(service.isPostOp)}
                />
              ) : null}
              {service.serviceType === "laser" ? (
                <Step3Laser cliente={cliente} showDiagnosis={false} />
              ) : null}
              {service.serviceType === "other" ? (
                <Step3Other cliente={cliente} />
              ) : null}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t bg-card/80 px-5 py-3 lg:px-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="gap-1.5"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isAtLimit || saving}
            className="gap-1.5 bg-[#5C6E6C] text-white shadow-sm hover:bg-[#4F605C]"
          >
            <CheckCircle2Icon className="size-3.5" />
            {saving ? "Guardando…" : "Guardar sesión"}
          </Button>
        </footer>
      </form>
    </Form>
  );
}

// ─── Session meta block (date / professional / nextSuggestion) ──────────────
// `durationMin` is rendered inside each per-type form (visually adjacent to
// its clinical context — pain, reaction, etc.).

function SessionMetaBlock({ staff }: { staff: StaffMember[] }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useFormContext<any>();

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/75">
        Datos de la sesión
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-foreground/80">
                Fecha de la sesión
              </FormLabel>
              <Input
                type="date"
                value={(field.value as string) ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                className="h-9"
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <Controller
          control={form.control}
          name="professionalId"
          render={({ field }) => (
            <ProfesionalSelect
              label="Profesional responsable"
              staff={staff}
              value={{
                professionalId: field.value as string | null,
                professionalLabel:
                  (form.watch("professionalLabel") as string) ?? "",
              }}
              onChange={(next) => {
                field.onChange(next.professionalId);
                form.setValue("professionalLabel", next.professionalLabel, {
                  shouldDirty: true,
                });
              }}
            />
          )}
        />
        <FormField
          control={form.control}
          name="nextSuggestion"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-foreground/80">
                Próxima cita sugerida
              </FormLabel>
              <Input
                type="date"
                value={(field.value as string) ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                className="h-9"
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
