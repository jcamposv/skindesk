"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CameraIcon,
  ChevronDownIcon,
  FolderOpenIcon,
  HistoryIcon,
  WandSparklesIcon,
} from "lucide-react";

import {
  isTabKey,
  TAB_GROUPS,
  TABS,
  type TabKey,
} from "@/components/clientes/cliente-detail-tabs-config";
import { DatosPersonalesForm } from "@/components/clientes/datos-personales-form";
import { EmptyTab } from "@/components/clientes/empty-tab";
import { EvaluacionTab } from "@/components/clientes/evaluacion-tab";
import { ObjetivosTab } from "@/components/clientes/objetivos-tab";
import { PagosTab } from "@/components/clientes/pagos/pagos-tab";
import { ServiciosTab } from "@/components/clientes/servicios/servicios-tab";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ClienteDetail } from "@/services/clientes.service";
import type { StaffMember } from "@/services/staff.service";
import type { ProfesionalValue } from "@/components/clientes/servicios/profesional-select";
import type { AssignedService } from "@/components/clientes/servicios/types";
import type { PaymentPlanSummary } from "@/services/pagos.service";
import type { Evaluacion } from "@/types/evaluacion";

interface ClienteDetailTabsProps {
  cliente: ClienteDetail;
  evaluacion: Evaluacion | null;
  servicios: AssignedService[];
  staff: StaffMember[];
  /** Plain object keyed by servicioId (the page serialized the Map). */
  initialPaymentPlans: Record<string, PaymentPlanSummary>;
  currentProfesional: ProfesionalValue;
  initialTab?: TabKey;
}

/**
 * Adaptive tab navigation for the cliente detail view.
 *
 * Three layouts share a single `active` state:
 *
 * 1. Mobile (< sm)  → "Section" button + bottom Sheet picker
 * 2. Tablet (sm-lg) → Pills with `flex-wrap` (no scroll, breaks into rows)
 * 3. Desktop (≥ lg) → Sticky vertical rail on the left, content on the right
 *
 * No horizontal scroll on any viewport, and the desktop rail mirrors the
 * primary sidebar's visual language so the detail view feels native.
 *
 * We don't use `@/components/ui/tabs` here — base-ui's underline-only `after`
 * styles fight the rail accent we want, so the panel/trigger UI is hand-rolled
 * with proper ARIA roles. Keyboard nav: `Tab` focuses each trigger, `Enter`
 * activates. Arrow-key roving could be added later if there's a need.
 */
export function ClienteDetailTabs({
  cliente,
  evaluacion,
  servicios,
  staff,
  initialPaymentPlans,
  currentProfesional,
  initialTab,
}: ClienteDetailTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [active, setActive] = useState<TabKey>(initialTab ?? "datos");
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleChange = useCallback(
    (next: string) => {
      if (!isTabKey(next) || next === active) {
        setPickerOpen(false);
        return;
      }
      setActive(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "datos") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      setPickerOpen(false);
    },
    [active, pathname, router, searchParams],
  );

  const activeTab = TABS.find((t) => t.key === active) ?? TABS[0];

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* === MOBILE picker (< sm) ============================================ */}
      <div className="sm:hidden">
        <MobileTabPicker
          tabs={TABS}
          active={activeTab.key}
          onChange={handleChange}
          open={pickerOpen}
          setOpen={setPickerOpen}
        />
      </div>

      {/* === TABLET pills (sm – lg) ========================================== */}
      <nav
        aria-label="Secciones de la clienta"
        className="hidden flex-wrap gap-1.5 sm:flex lg:hidden"
        role="tablist"
        aria-orientation="horizontal"
      >
        {TABS.map((tab) => (
          <PillButton
            key={tab.key}
            tab={tab}
            isActive={tab.key === active}
            onClick={() => handleChange(tab.key)}
          />
        ))}
      </nav>

      {/* === DESKTOP rail (≥ lg) ============================================ */}
      <aside className="hidden lg:sticky lg:top-4 lg:block lg:self-start">
        <nav
          aria-label="Secciones de la clienta"
          aria-orientation="vertical"
          role="tablist"
          className="rounded-2xl border bg-[#FBF9F4]/50 p-2"
        >
          <div className="flex flex-col gap-3">
            {TAB_GROUPS.map((group, gi) => (
              <div key={group.label} className="flex flex-col gap-0.5">
                <p
                  className={cn(
                    "px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70",
                    gi === 0 ? "pt-1" : "pt-2",
                  )}
                >
                  {group.label}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {group.tabs.map((tab) => (
                    <li key={tab.key}>
                      <RailButton
                        tab={tab}
                        isActive={tab.key === active}
                        onClick={() => handleChange(tab.key)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      </aside>

      {/* === BODY ============================================================ */}
      <section
        role="tabpanel"
        id={`tabpanel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="min-w-0"
      >
        {active === "datos" ? <DatosPersonalesForm cliente={cliente} /> : null}
        {active === "evaluacion" ? (
          <EvaluacionTab cliente={cliente} initialEvaluacion={evaluacion} />
        ) : null}
        {active === "objetivos" ? (
          <ObjetivosTab cliente={cliente} evaluacion={evaluacion} />
        ) : null}
        {active === "rutinas" ? (
          <EmptyTab
            icon={WandSparklesIcon}
            title="Rutinas asignadas"
            description="Rutinas activas, productos recomendados, frecuencia, instrucciones especiales e historial de rutinas anteriores."
            preview={[
              "Rutina activa de mañana y noche",
              "Productos asignados y dosis",
              "Recordatorios automáticos",
              "Historial de cambios y motivos",
            ]}
          />
        ) : null}
        {active === "pagos" ? (
          <PagosTab
            services={servicios}
            initialPlans={initialPaymentPlans}
          />
        ) : null}
        {active === "servicios" ? (
          <ServiciosTab
            cliente={cliente}
            initialServices={servicios}
            staff={staff}
            currentProfesional={currentProfesional}
          />
        ) : null}
        {active === "archivos" ? (
          <EmptyTab
            icon={FolderOpenIcon}
            title="Archivos"
            description="Documentos firmados, consentimientos, recetas y otros archivos clínicos asociados a la clienta."
            preview={[
              "Consentimientos firmados",
              "Recetas y derivaciones",
              "Resultados de laboratorio",
              "Archivos compartidos por la clienta",
            ]}
          />
        ) : null}
        {active === "historial" ? (
          <EmptyTab
            icon={HistoryIcon}
            title="Historial"
            description="Línea de tiempo cronológica de citas, sesiones, notas, mensajes y cambios — el registro completo del recorrido de tu clienta."
            preview={[
              "Citas, sesiones y no-show",
              "Notas técnicas por evento",
              "Cambios de plan y motivos",
              "Mensajes y recordatorios enviados",
            ]}
          />
        ) : null}
        {active === "fotos" ? (
          <EmptyTab
            icon={CameraIcon}
            title="Fotos de evolución"
            description="Galería visual antes/después organizada por sesión, con comparador lateral y zoom para mostrarle a tu clienta el progreso real."
            preview={[
              "Galería ordenada por sesión",
              "Comparador antes / después",
              "Vistas frontal, perfil y oblicua",
              "Compartir álbum con la clienta",
            ]}
          />
        ) : null}
      </section>
    </div>
  );
}

// =============================================================================
// Mobile picker
// =============================================================================

interface MobileTabPickerProps {
  tabs: typeof TABS;
  active: TabKey;
  onChange: (next: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

function MobileTabPicker({
  tabs,
  active,
  onChange,
  open,
  setOpen,
}: MobileTabPickerProps) {
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];
  const ActiveIcon = activeTab.icon;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-[#F4F1EC]/40"
            aria-haspopup="dialog"
            aria-expanded={open}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F4F1EC] text-[#BB7154]">
            <ActiveIcon className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Sección
            </span>
            <span className="truncate text-sm font-medium text-foreground">
              {activeTab.label}
            </span>
          </span>
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="flex max-h-[85vh] flex-col gap-0 rounded-t-2xl p-0"
      >
        <SheetHeader className="border-b px-5 pt-5 pb-4">
          <SheetTitle className="text-base">Secciones de la clienta</SheetTitle>
        </SheetHeader>
        <div
          role="tablist"
          aria-orientation="vertical"
          className="flex-1 overflow-y-auto px-2 py-2"
        >
          {TAB_GROUPS.map((group, gi) => (
            <div key={group.label} className={gi === 0 ? "" : "pt-3"}>
              <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.tabs.map((tab) => (
                  <li key={tab.key}>
                    <RailButton
                      tab={tab}
                      isActive={tab.key === active}
                      onClick={() => onChange(tab.key)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// =============================================================================
// Tablet pill button
// =============================================================================

interface TabButtonProps {
  tab: (typeof TABS)[number];
  isActive: boolean;
  onClick: () => void;
}

function PillButton({ tab, isActive, onClick }: TabButtonProps) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${tab.key}`}
      aria-selected={isActive}
      aria-controls={`tabpanel-${tab.key}`}
      tabIndex={0}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB7154]/30 focus-visible:ring-offset-2",
        isActive
          ? "border-[#BB7154]/30 bg-[#F6E0D6] font-medium text-[#8C4A30] shadow-[inset_0_-1px_0_rgba(187,113,84,0.1)]"
          : "border-border/60 bg-card text-muted-foreground hover:border-foreground/20 hover:bg-[#F4F1EC]/50 hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-3.5 transition-colors",
          isActive ? "text-[#BB7154]" : "opacity-70",
        )}
      />
      {tab.label}
    </button>
  );
}

// =============================================================================
// Desktop / Mobile rail button (shared row component)
// =============================================================================

function RailButton({ tab, isActive, onClick }: TabButtonProps) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${tab.key}`}
      aria-selected={isActive}
      aria-controls={`tabpanel-${tab.key}`}
      tabIndex={0}
      onClick={onClick}
      className={cn(
        "group/rail relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB7154]/30",
        isActive
          ? "bg-card font-medium text-[#8C4A30] shadow-sm"
          : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
      )}
    >
      {/* Left accent stripe in copper — primary brand action color. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-opacity",
          isActive ? "bg-[#BB7154] opacity-100" : "opacity-0",
        )}
      />
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
          isActive
            ? "bg-[#F6E0D6] text-[#BB7154]"
            : "text-muted-foreground/80 group-hover/rail:bg-[#F4F1EC]/40",
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 truncate text-left">{tab.label}</span>
    </button>
  );
}
