"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CameraIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FileTextIcon,
  FolderOpenIcon,
  HistoryIcon,
  LeafIcon,
  TargetIcon,
  WandSparklesIcon,
} from "lucide-react";

import {
  isTabKey,
  TABS,
  type TabKey,
} from "@/components/clientes/cliente-detail-tabs-config";
import { DatosPersonalesForm } from "@/components/clientes/datos-personales-form";
import { EmptyTab } from "@/components/clientes/empty-tab";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ClienteDetail } from "@/services/clientes.service";

interface ClienteDetailTabsProps {
  cliente: ClienteDetail;
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
          <ul className="flex flex-col gap-0.5">
            {TABS.map((tab) => (
              <li key={tab.key}>
                <RailButton
                  tab={tab}
                  isActive={tab.key === active}
                  onClick={() => handleChange(tab.key)}
                />
              </li>
            ))}
          </ul>
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
        {active === "anamnesis" ? (
          <EmptyTab
            icon={ClipboardListIcon}
            title="Anamnesis"
            description="La historia clínica completa de tu clienta — antecedentes médicos, alergias, medicación actual, embarazos, intervenciones previas y todo lo que necesitás antes de un tratamiento."
            preview={[
              "Antecedentes médicos y alergias",
              "Medicación actual y suplementos",
              "Tratamientos estéticos previos",
              "Contraindicaciones y banderas rojas",
            ]}
          />
        ) : null}
        {active === "habitos" ? (
          <EmptyTab
            icon={LeafIcon}
            title="Hábitos"
            description="Rutina diaria de skincare, alimentación, sueño, exposición solar, consumo de agua y todo lo que influye en la salud de la piel."
            preview={[
              "Rutina actual de skincare",
              "Hidratación, alimentación y sueño",
              "Exposición solar y uso de SPF",
              "Estrés, hormonas y ciclo menstrual",
            ]}
          />
        ) : null}
        {active === "objetivos" ? (
          <EmptyTab
            icon={TargetIcon}
            title="Objetivos estéticos"
            description="Valoración inicial, expectativas, áreas a tratar y objetivos del plan estético — la base para diseñar la propuesta personalizada."
            preview={[
              "Áreas de interés y prioridades",
              "Expectativas y objetivos a 3-6 meses",
              "Fototipo, tipo de piel y diagnóstico",
              "Plan estético sugerido",
            ]}
          />
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
          <EmptyTab
            icon={CreditCardIcon}
            title="Plan de pagos"
            description="Pagos realizados, saldo pendiente, próximos vencimientos y resumen financiero del paquete o las sesiones contratadas."
            preview={[
              "Saldo y próximos vencimientos",
              "Pagos realizados con comprobantes",
              "Cuotas, paquetes y sesiones",
              "Estado de cobro por sesión",
            ]}
          />
        ) : null}
        {active === "servicios" ? (
          <EmptyTab
            icon={FolderOpenIcon}
            title="Mis servicios"
            description="Servicios contratados, sesiones consumidas vs. restantes, fechas de aplicación y notas por sesión."
            preview={[
              "Paquetes contratados y vigencia",
              "Sesiones realizadas vs. restantes",
              "Notas técnicas por sesión",
              "Próxima sesión programada",
            ]}
          />
        ) : null}
        {active === "archivos" ? (
          <EmptyTab
            icon={FileTextIcon}
            title="Archivos"
            description="Consentimientos firmados, laboratorios, recetas, PDFs y cualquier documento clínico relevante — todo en un solo lugar y siempre encriptado."
            preview={[
              "Consentimientos informados",
              "Estudios y laboratorios",
              "Recetas y prescripciones médicas",
              "Otros documentos PDF",
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
        <ul
          role="tablist"
          aria-orientation="vertical"
          className="flex-1 overflow-y-auto px-2 py-2"
        >
          {tabs.map((tab) => (
            <li key={tab.key}>
              <RailButton
                tab={tab}
                isActive={tab.key === active}
                onClick={() => onChange(tab.key)}
              />
            </li>
          ))}
        </ul>
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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5C6E6C]/30 focus-visible:ring-offset-2",
        isActive
          ? "border-[#5C6E6C]/30 bg-[#F4F1EC] font-medium text-[#5C6E6C] shadow-[inset_0_-1px_0_rgba(92,110,108,0.08)]"
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
        "group/rail relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5C6E6C]/30",
        isActive
          ? "bg-card font-medium text-[#5C6E6C] shadow-sm"
          : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
      )}
    >
      {/* Left accent stripe — same balsam tone as the underline used to be. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-opacity",
          isActive ? "bg-[#5C6E6C] opacity-100" : "opacity-0",
        )}
      />
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
          isActive
            ? "bg-[#F4F1EC] text-[#BB7154]"
            : "text-muted-foreground/80 group-hover/rail:bg-[#F4F1EC]/40",
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 truncate text-left">{tab.label}</span>
    </button>
  );
}
