"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { cn } from "@/lib/utils";

import {
  servicioCreateFormSchemaFor,
  type ServicioCreateInput,
  type ServicioCreateFormInput,
} from "@/schemas/servicios.schema";
import type { StaffMember } from "@/services/staff.service";

import type { ProfesionalValue } from "./profesional-select";
import { type CatalogItem } from "./catalog";
import {
  SERVICE_TYPE_LABEL,
  type ServiceType,
} from "./types";
import { Step1Type } from "./steps/step-1-type";
import { Step2Catalog } from "./steps/step-2-catalog";
import { Step3Global } from "./steps/step-3-global";
import { Step3Facial } from "./steps/step-3-facial";
import { Step3Corporal } from "./steps/step-3-corporal";
import { Step3Laser } from "./steps/step-3-laser";
import { Step3Other } from "./steps/step-3-other";
import { SERVICE_VISUAL } from "./service-type-visual";
import type { ClienteRef } from "./types";

interface AddServiceSheetProps {
  open: boolean;
  onClose: () => void;
  cliente: ClienteRef;
  staff: StaffMember[];
  defaultProfesional: ProfesionalValue;
  onSave: (input: ServicioCreateInput) => Promise<void> | void;
  saving?: boolean;
}

const STEPS = [
  {
    key: 1,
    label: "Tipo de servicio",
    description: "Elegí la categoría clínica.",
  },
  {
    key: 2,
    label: "Servicio específico",
    description: "Pickeá el tratamiento del catálogo.",
  },
  {
    key: 3,
    label: "Primera sesión",
    description: "Configura el detalle y registra la sesión.",
  },
] as const;

/**
 * Three-step wizard for assigning a new service.
 *
 * Steps 1 and 2 are plain state (no form needed — single picks). When the
 * user advances to step 3, a `<Step3FormShell>` mounts with its own RHF
 * instance, the schema dispatched on `serviceType`. Going back to step 1/2
 * unmounts the form (so a type-switch never carries stale clinical data).
 */
export function AddServiceSheet({
  open,
  onClose,
  cliente,
  staff,
  defaultProfesional,
  onSave,
  saving = false,
}: AddServiceSheetProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex h-[92vh] w-[calc(100%-1rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none duration-100",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          {open ? (
            <AddServiceBody
              cliente={cliente}
              staff={staff}
              defaultProfesional={defaultProfesional}
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

// ─── Dialog body ────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function inDaysISO(days: number) {
  return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

function AddServiceBody({
  cliente,
  staff,
  defaultProfesional,
  onClose,
  onSave,
  saving,
}: {
  cliente: ClienteRef;
  staff: StaffMember[];
  defaultProfesional: ProfesionalValue;
  onClose: () => void;
  onSave: (input: ServicioCreateInput) => Promise<void> | void;
  saving: boolean;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [catalogKey, setCatalogKey] = useState<string | null>(null);
  const [catalogItem, setCatalogItem] = useState<CatalogItem | null>(null);

  function handleTypeChange(next: ServiceType) {
    setServiceType(next);
    setCatalogKey(null);
    setCatalogItem(null);
  }

  function handleCatalogChange(key: string, item: CatalogItem) {
    setCatalogKey(key);
    setCatalogItem(item);
  }

  const canAdvancePicker =
    (step === 1 && serviceType != null) ||
    (step === 2 && catalogKey != null);

  return (
    <>
      <header className="flex items-start justify-between gap-3 border-b px-5 pt-4 pb-3 lg:px-6 lg:pt-5">
        <div className="min-w-0">
          <DialogPrimitive.Title className="font-heading text-base font-medium tracking-tight">
            Agregar servicio
          </DialogPrimitive.Title>
          <p className="text-[12px] text-muted-foreground">
            Asigná un tratamiento a la clienta y registra la primera sesión.
          </p>
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

      {/* Mobile / tablet horizontal stepper */}
      <div className="border-b px-5 py-3 lg:hidden">
        <HorizontalStepper
          step={step}
          serviceType={serviceType}
          item={catalogItem}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 [grid-template-rows:minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden border-r bg-[#FBF9F4]/60 lg:flex lg:flex-col">
          <VerticalRail step={step} serviceType={serviceType} item={catalogItem} />
        </aside>

        {step === 3 && serviceType && catalogItem ? (
          <Step3FormShell
            cliente={cliente}
            staff={staff}
            defaultProfesional={defaultProfesional}
            serviceType={serviceType}
            catalogKey={catalogKey ?? ""}
            catalogItem={catalogItem}
            saving={saving}
            onBack={() => setStep(2)}
            onSave={onSave}
          />
        ) : (
          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5 lg:px-7 lg:py-6">
              {step === 1 ? (
                <Step1Type value={serviceType} onChange={handleTypeChange} />
              ) : null}
              {step === 2 && serviceType ? (
                <Step2Catalog
                  serviceType={serviceType}
                  value={catalogKey}
                  onChange={handleCatalogChange}
                />
              ) : null}
            </div>
            <footer className="flex items-center justify-between gap-2 border-t bg-card/80 px-5 py-3 lg:px-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  step === 1 ? onClose() : setStep((s) => (s - 1) as 1)
                }
                className="gap-1.5"
              >
                <ArrowLeftIcon className="size-3.5" />
                {step === 1 ? "Cancelar" : "Atrás"}
              </Button>
              <div className="hidden text-[11.5px] text-muted-foreground sm:block">
                Paso <span className="font-semibold text-foreground">{step}</span>{" "}
                de 3
              </div>
              <Button
                type="button"
                variant="cta"
                size="sm"
                onClick={() => setStep((s) => (s + 1) as 2 | 3)}
                disabled={!canAdvancePicker}
                className="gap-1.5"
              >
                Continuar
                <ArrowRightIcon className="size-3.5" />
              </Button>
            </footer>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Step 3 form shell — owns the RHF instance ──────────────────────────────

function Step3FormShell({
  cliente,
  staff,
  defaultProfesional,
  serviceType,
  catalogKey,
  catalogItem,
  saving,
  onBack,
  onSave,
}: {
  cliente: ClienteRef;
  staff: StaffMember[];
  defaultProfesional: ProfesionalValue;
  serviceType: ServiceType;
  catalogKey: string;
  catalogItem: CatalogItem;
  saving: boolean;
  onBack: () => void;
  onSave: (input: ServicioCreateInput) => Promise<void> | void;
}) {
  const schema = servicioCreateFormSchemaFor(serviceType);
  const start = todayISO();
  const next = inDaysISO(14);

  // Form is typed loose because the schema is dispatched at runtime on
  // `serviceType`. The zod resolver does the real validation; see same
  // pattern in `add-session-dialog.tsx`.
  const form = useForm({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues: buildDefaults(
      serviceType,
      catalogKey,
      catalogItem,
      defaultProfesional,
      start,
      next,
      // The factory returns a discriminated union — TS infers the form
      // type from the first variant unless we widen here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any,
  });

  function onValid(values: unknown) {
    void onSave(values as ServicioCreateInput);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onValid)}
        className="flex min-h-0 min-w-0 flex-col"
      >
        <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5 lg:px-7 lg:py-6">
          <div className="grid gap-5">
            <Step3Global staff={staff} />

            {/* Laser diagnosis is rendered at the root of the wizard form. */}
            {serviceType === "laser" ? (
              <Step3Laser
                cliente={cliente}
                pathPrefix="firstSession"
                showDiagnosis
              />
            ) : null}
            {serviceType === "facial" ? (
              <Step3Facial cliente={cliente} pathPrefix="firstSession" />
            ) : null}
            {serviceType === "corporal" ? (
              <Step3Corporal
                cliente={cliente}
                isPostOp={Boolean(catalogItem.isPostOp)}
                pathPrefix="firstSession"
              />
            ) : null}
            {serviceType === "other" ? (
              <Step3Other cliente={cliente} pathPrefix="firstSession" />
            ) : null}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t bg-card/80 px-5 py-3 lg:px-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            className="gap-1.5"
          >
            <ArrowLeftIcon className="size-3.5" />
            Atrás
          </Button>
          <div className="hidden text-[11.5px] text-muted-foreground sm:block">
            Paso <span className="font-semibold text-foreground">3</span> de 3
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={saving}
            className="gap-1.5 bg-[#5C6E6C] text-white shadow-sm hover:bg-[#4F605C]"
          >
            <CheckCircle2Icon className="size-3.5" />
            {saving ? "Guardando…" : "Guardar servicio"}
          </Button>
        </footer>
      </form>
    </Form>
  );
}

function buildDefaults(
  serviceType: ServiceType,
  catalogKey: string,
  catalogItem: CatalogItem,
  defaultProfesional: ProfesionalValue,
  start: string,
  next: string,
): ServicioCreateFormInput {
  const meta = {
    name: catalogItem.name,
    catalogKey,
    startDate: start,
    totalSessions: catalogItem.defaultSessions,
    frequency: "quincenal" as const,
    status: "active" as const,
    notes: "",
    packageAmount: 0,
    professionalId: defaultProfesional.professionalId,
    professionalLabel: defaultProfesional.professionalLabel,
    nextAppointment: next,
    tags: [],
    isPostOp: Boolean(catalogItem.isPostOp),
  };

  const sesionMeta = {
    sessionNumber: 1,
    date: start,
    durationMin: serviceType === "laser" ? 30 : 60,
    professionalId: defaultProfesional.professionalId,
    professionalLabel: defaultProfesional.professionalLabel,
    status: "completed" as const,
    notes: "",
    beforePaths: [],
    afterPaths: [],
    recommendations: "",
    nextSuggestion: next,
  };

  switch (serviceType) {
    case "facial":
      return {
        ...meta,
        serviceType: "facial",
        laserDiagnosis: null,
        firstSession: {
          ...sesionMeta,
          payload: {
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
          },
        },
      };
    case "corporal":
      return {
        ...meta,
        serviceType: "corporal",
        laserDiagnosis: null,
        firstSession: {
          ...sesionMeta,
          payload: {
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
          },
        },
      };
    case "laser":
      return {
        ...meta,
        serviceType: "laser",
        laserDiagnosis: {
          fitzpatrick: "",
          hairColor: "",
          hairThickness: "",
          equipment: "",
          contraindications: "",
          observations: "",
        },
        firstSession: {
          ...sesionMeta,
          payload: {
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
          },
        },
      };
    case "other":
      return {
        ...meta,
        serviceType: "other",
        laserDiagnosis: null,
        firstSession: {
          ...sesionMeta,
          payload: {
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
          },
        },
      };
  }
}

// ─── Vertical rail (lg+) ────────────────────────────────────────────────────

function VerticalRail({
  step,
  serviceType,
  item,
}: {
  step: 1 | 2 | 3;
  serviceType: ServiceType | null;
  item: CatalogItem | null;
}) {
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-5 py-6">
      <ol className="flex flex-col gap-1" aria-label="Progreso del asistente">
        {STEPS.map((s) => {
          const isDone = step > s.key;
          const isActive = step === s.key;
          return (
            <li key={s.key}>
              <div
                className={cn(
                  "relative flex items-start gap-3 rounded-xl px-3 py-2.5",
                  isActive && "bg-card shadow-sm",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-opacity",
                    isActive ? "bg-[#BB7154] opacity-100" : "opacity-0",
                  )}
                />
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                    isActive && "bg-[#BB7154] text-white",
                    isDone && "bg-[#5C6E6C] text-white",
                    !isActive && !isDone && "bg-muted text-muted-foreground",
                  )}
                >
                  {isDone ? <CheckCircle2Icon className="size-3.5" /> : s.key}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[12.5px] font-medium leading-tight",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                    {s.description}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-border/60" aria-hidden />

      <div className="grid gap-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Tu selección
        </p>
        <SummaryRow
          label="Tipo"
          value={serviceType ? SERVICE_TYPE_LABEL[serviceType] : null}
        />
        <SummaryRow label="Servicio" value={item?.name ?? null} />
      </div>

      {serviceType ? (
        <div className="mt-auto">
          {(() => {
            const visual = SERVICE_VISUAL[serviceType];
            const Icon = visual.icon;
            return (
              <div
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border p-3",
                  visual.iconBg,
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/60",
                    visual.iconColor,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-[11px] font-medium leading-tight",
                      visual.iconColor,
                    )}
                  >
                    {SERVICE_TYPE_LABEL[serviceType]}
                  </p>
                  <p className="text-[10px] text-foreground/60">
                    Form clínico adaptado a este tipo.
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <p
        className={cn(
          "text-[12.5px] leading-tight",
          value ? "text-foreground" : "italic text-muted-foreground/50",
        )}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

// ─── Horizontal stepper (mobile / tablet) ───────────────────────────────────

function HorizontalStepper({
  step,
  serviceType,
  item,
}: {
  step: 1 | 2 | 3;
  serviceType: ServiceType | null;
  item: CatalogItem | null;
}) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Pasos">
      {STEPS.map((s, i) => {
        const isDone = step > s.key;
        const isActive = step === s.key;
        const isFuture = step < s.key;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-1.5">
            <div className="flex w-full items-center gap-1.5">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                  isActive && "bg-[#BB7154] text-white",
                  isDone && "bg-[#5C6E6C] text-white",
                  isFuture && "bg-muted text-muted-foreground",
                )}
              >
                {isDone ? <CheckCircle2Icon className="size-3.5" /> : s.key}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[11px] font-medium leading-tight",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {s.key === 1 && serviceType
                    ? SERVICE_TYPE_LABEL[serviceType]
                    : null}
                  {s.key === 2 && item ? item.name : null}
                  {s.key === 3 && step === 3 ? "Configura el detalle" : null}
                </p>
              </div>
            </div>
            {i < STEPS.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "hidden h-px flex-1 sm:block",
                  isDone ? "bg-[#5C6E6C]" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

