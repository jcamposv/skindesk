"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  FolderOpenIcon,
  PlayCircleIcon,
  PauseCircleIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  createServicioAction,
  addSessionAction,
} from "@/actions/servicios.actions";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClienteDetail } from "@/services/clientes.service";
import type { StaffMember } from "@/services/staff.service";

import type { ProfesionalValue } from "./profesional-select";
import { AddServiceSheet } from "./add-service-sheet";
import { AddSessionDialog } from "./add-session-dialog";
import { CompactServiceCard } from "./compact-service-card";
import { ServiceCard } from "./service-card";
import { ServiceHistorySheet } from "./service-history-sheet";
import {
  SERVICE_TYPE_LABEL,
  type AssignedService,
  type ClienteRef,
  type ServiceStatus,
  type ServiceType,
} from "./types";
import { SERVICE_VISUAL, STATUS_VISUAL } from "./service-type-visual";

type Filter = "all" | ServiceType;

const FILTERS: Filter[] = ["all", "facial", "corporal", "laser", "other"];

interface ServiciosTabProps {
  cliente: ClienteDetail;
  initialServices: AssignedService[];
  /** Tenant staff used to populate the "Profesional responsable" dropdown. */
  staff: StaffMember[];
  /** Pre-selected professional when the wizard opens (typically the
   *  logged-in profesional). Carries the FK so we bind to a canonical
   *  staff record, not a name string. */
  currentProfesional: ProfesionalValue;
}

/**
 * Top-level "Mis servicios" tab.
 *
 * Layout strategy for per-clienta volume (typically <30 lifetime services):
 *  - Activos + Pausados → hero cards (rich visual, progress dots, tags)
 *  - Completados + Cancelados → compact row cards inside a collapsible
 *    "Histórico" section (default collapsed when ≥ 4 entries, expanded
 *    otherwise). Keeps the focus on what the cosmetóloga is doing NOW,
 *    while the timeline stays accessible.
 *
 * Data flow: `initialServices` is the server-fetched list. Mutations go
 * through `createServicioAction` / `addSessionAction`; on success we call
 * `router.refresh()` so RLS-scoped data is re-fetched. We don't mirror
 * server state in local state — keeps the source of truth clean.
 */
export function ServiciosTab({
  cliente,
  initialServices,
  staff,
  currentProfesional,
}: ServiciosTabProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [addSessionForId, setAddSessionForId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [isPending, startTransition] = useTransition();

  const services = initialServices;

  const clienteRef: ClienteRef = useMemo(
    () => ({ tenantId: cliente.tenant_id, clienteId: cliente.id }),
    [cliente.tenant_id, cliente.id],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return services;
    return services.filter((s) => s.serviceType === filter);
  }, [services, filter]);

  const groups = useMemo(() => groupByStatus(filtered), [filtered]);

  const stats = useMemo(() => {
    const active = services.filter((s) => s.status === "active").length;
    const completed = services.filter((s) => s.status === "completed").length;
    const totalCompletedSessions = services.reduce(
      (acc, s) =>
        acc + s.sessions.filter((session) => session.status === "completed").length,
      0,
    );
    return { active, completed, totalCompletedSessions };
  }, [services]);

  const historyService = useMemo(
    () => services.find((s) => s.id === historyId) ?? null,
    [services, historyId],
  );

  async function handleSave(
    input: Parameters<typeof createServicioAction>[1],
  ): Promise<void> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await createServicioAction(cliente.id, input);
        if (!result.success) {
          toast.error(result.message ?? "No se pudo crear el servicio.");
          resolve();
          return;
        }
        toast.success(`${input.name} agregado al perfil.`, {
          description: `Primera sesión registrada · ${input.totalSessions} sesiones planificadas.`,
        });
        setAdding(false);
        router.refresh();
        resolve();
      });
    });
  }

  function handleAddSession(serviceId: string) {
    setAddSessionForId(serviceId);
  }

  async function handleSaveSession(
    serviceId: string,
    input: Parameters<typeof addSessionAction>[1],
    expectedServicioVersion: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await addSessionAction(
          serviceId,
          input,
          expectedServicioVersion,
        );
        if (!result.success) {
          if (result.errors?.version?.includes("conflict")) {
            toast.error(
              "Otro usuario actualizó este servicio. Refrescando…",
            );
            router.refresh();
            setAddSessionForId(null);
            resolve();
            return;
          }
          toast.error(result.message ?? "No se pudo registrar la sesión.");
          resolve();
          return;
        }
        const service = services.find((s) => s.id === serviceId);
        toast.success(`Sesión #${input.sessionNumber} registrada.`, {
          description: service
            ? `${service.name} · ${input.date}`
            : undefined,
        });
        setAddSessionForId(null);
        router.refresh();
        resolve();
      });
    });
  }

  const addSessionService = useMemo(
    () => services.find((s) => s.id === addSessionForId) ?? null,
    [services, addSessionForId],
  );

  const hasServices = services.length > 0;
  const historicCount = groups.completed.length + groups.cancelled.length;

  return (
    <div className="grid gap-5">
      <header className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#F4F1EC] text-[#BB7154]">
              <FolderOpenIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-lg font-medium tracking-tight">
                Mis servicios
              </h2>
              <p className="text-[12.5px] text-muted-foreground">
                Servicios contratados, progreso por sesión y formularios clínicos
                por tipo de tratamiento.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setAdding(true)}
            className="gap-1.5 bg-[#BB7154] text-white shadow-sm hover:bg-[#A56146] focus-visible:ring-[#BB7154]/40"
          >
            <PlusIcon className="size-4" />
            Agregar servicio
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Activos"
            value={stats.active}
            tone="bg-[#E7ECEA] text-[#4F605C]"
          />
          <StatTile
            label="Completados"
            value={stats.completed}
            tone="bg-[#F6E0D6] text-[#8C4A30]"
          />
          <StatTile
            label="Sesiones registradas"
            value={stats.totalCompletedSessions}
            tone="bg-[#F8EFD7] text-[#7C5E1F]"
          />
        </div>
      </header>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const isActive = filter === f;
          const visual = f !== "all" ? SERVICE_VISUAL[f] : null;
          const Icon = visual?.icon;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                isActive
                  ? "border-[#BB7154] bg-[#F6E0D6] font-medium text-[#8C4A30]"
                  : "border-border/60 bg-card text-muted-foreground hover:border-[#BB7154]/40 hover:bg-[#FBEFE7]/20",
              )}
            >
              {Icon ? <Icon className="size-3.5" /> : null}
              {f === "all" ? "Todos" : SERVICE_TYPE_LABEL[f]}
              <span
                className={cn(
                  "ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                  isActive ? "bg-white/80 text-[#8C4A30]" : "bg-muted/60",
                )}
              >
                {f === "all"
                  ? services.length
                  : services.filter((s) => s.serviceType === f).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Groups */}
      {hasServices && filtered.length > 0 ? (
        <div className="grid gap-6">
          {/* Active — hero cards */}
          {groups.active.length > 0 ? (
            <GroupSection
              icon={PlayCircleIcon}
              status="active"
              count={groups.active.length}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {groups.active.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onAddSession={handleAddSession}
                    onShowHistory={(id) => setHistoryId(id)}
                  />
                ))}
              </div>
            </GroupSection>
          ) : null}

          {/* Paused — hero cards too (still actionable) */}
          {groups.paused.length > 0 ? (
            <GroupSection
              icon={PauseCircleIcon}
              status="paused"
              count={groups.paused.length}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {groups.paused.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onAddSession={handleAddSession}
                    onShowHistory={(id) => setHistoryId(id)}
                  />
                ))}
              </div>
            </GroupSection>
          ) : null}

          {/* Histórico — compact rows in a collapsible. Default open when
              ≤3 items so it doesn't hide content unnecessarily; collapsed
              when historic is longer, to keep the page short. */}
          {historicCount > 0 ? (
            <Collapsible defaultOpen={historicCount <= 3}>
              <CollapsibleTrigger
                render={
                  <button
                    type="button"
                    className="group flex w-full items-center justify-between gap-3 rounded-xl border border-dashed bg-card/40 px-4 py-3 text-left transition-colors hover:bg-card/70"
                  />
                }
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F4F1EC] text-[#8C4A30]">
                    <FolderOpenIcon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-medium text-foreground">
                      Histórico
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {historicCount}{" "}
                      {historicCount === 1 ? "servicio" : "servicios"} ·
                      completados y cancelados
                    </span>
                  </span>
                </span>
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden">
                <div className="grid gap-2 pt-3">
                  {groups.completed.map((service) => (
                    <CompactServiceCard
                      key={service.id}
                      service={service}
                      onShowHistory={(id) => setHistoryId(id)}
                    />
                  ))}
                  {groups.cancelled.map((service) => (
                    <CompactServiceCard
                      key={service.id}
                      service={service}
                      onShowHistory={(id) => setHistoryId(id)}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : null}

          {/* Fallback for the rare case where the filter only yields historic
              and the active/paused groups are empty. */}
          {groups.active.length === 0 &&
          groups.paused.length === 0 &&
          historicCount === 0 ? (
            <EmptyState
              filtered
              onAdd={() => setAdding(true)}
              onClearFilter={() => setFilter("all")}
            />
          ) : null}
        </div>
      ) : (
        <EmptyState
          filtered={hasServices}
          onAdd={() => setAdding(true)}
          onClearFilter={() => setFilter("all")}
        />
      )}

      <AddServiceSheet
        open={adding}
        cliente={clienteRef}
        staff={staff}
        defaultProfesional={currentProfesional}
        onClose={() => setAdding(false)}
        onSave={handleSave}
        saving={isPending}
      />
      <AddSessionDialog
        service={addSessionService}
        cliente={clienteRef}
        staff={staff}
        onClose={() => setAddSessionForId(null)}
        onSave={handleSaveSession}
        saving={isPending}
      />
      <ServiceHistorySheet
        service={historyService}
        onClose={() => setHistoryId(null)}
      />
    </div>
  );
}

// ─── Group header ───────────────────────────────────────────────────────────

function GroupSection({
  icon: Icon,
  status,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  status: ServiceStatus;
  count: number;
  children: React.ReactNode;
}) {
  const visual = STATUS_VISUAL[status];
  return (
    <section className="grid gap-3">
      <header className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full border",
            visual.classes,
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <h3 className="font-heading text-[13px] font-medium tracking-tight text-foreground">
          {visual.label}
        </h3>
        <span className="text-[11px] text-muted-foreground">
          · {count} {count === 1 ? "servicio" : "servicios"}
        </span>
        <span aria-hidden className="ml-2 h-px flex-1 bg-border/60" />
      </header>
      {children}
    </section>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function groupByStatus(services: AssignedService[]) {
  return services.reduce(
    (acc, s) => {
      acc[s.status].push(s);
      return acc;
    },
    {
      active: [] as AssignedService[],
      paused: [] as AssignedService[],
      completed: [] as AssignedService[],
      cancelled: [] as AssignedService[],
    },
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card/60 px-4 py-3">
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl text-base font-bold",
          tone,
        )}
      >
        {value}
      </span>
      <div className="min-w-0">
        <p className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-[12.5px] text-foreground/85">
          {value === 0
            ? "Sin servicios todavía"
            : `${value} ${value === 1 ? "registro" : "registros"}`}
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  filtered,
  onAdd,
  onClearFilter,
}: {
  filtered: boolean;
  onAdd: () => void;
  onClearFilter: () => void;
}) {
  return (
    <div className="grid place-items-center gap-3 rounded-2xl border border-dashed bg-card/60 p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-[#F6E0D6] text-[#8C4A30]">
        <SparklesIcon className="size-5" />
      </span>
      <div className="grid gap-1">
        <h3 className="font-heading text-base">
          {filtered ? "No hay servicios de este tipo." : "Aún no hay servicios asignados."}
        </h3>
        <p className="max-w-md text-[12.5px] text-muted-foreground">
          {filtered
            ? "Cambiá el filtro o agregá un servicio nuevo para esta clienta."
            : "Cuando agregues un servicio vas a poder registrar sesiones, controlar el avance y guardar fotos antes/después."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filtered ? (
          <Button type="button" variant="outline" size="sm" onClick={onClearFilter}>
            Ver todos
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={onAdd}
          className="gap-1.5 bg-[#BB7154] text-white shadow-sm hover:bg-[#A56146]"
        >
          <PlusIcon className="size-4" />
          Agregar servicio
        </Button>
      </div>
    </div>
  );
}
