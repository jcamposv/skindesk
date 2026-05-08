"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CameraIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FileTextIcon,
  FolderOpenIcon,
  HistoryIcon,
  LeafIcon,
  TargetIcon,
  WandSparklesIcon,
} from "lucide-react";

import { DatosPersonalesForm } from "@/components/clientes/datos-personales-form";
import { EmptyTab } from "@/components/clientes/empty-tab";
import {
  isTabKey,
  TABS,
  type TabKey,
} from "@/components/clientes/cliente-detail-tabs-config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ClienteDetail } from "@/services/clientes.service";

interface ClienteDetailTabsProps {
  cliente: ClienteDetail;
  initialTab?: TabKey;
}

export function ClienteDetailTabs({
  cliente,
  initialTab,
}: ClienteDetailTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [active, setActive] = useState<TabKey>(initialTab ?? "datos");

  const onChange = useCallback(
    (next: string) => {
      if (!isTabKey(next) || next === active) return;
      setActive(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "datos") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [active, pathname, router, searchParams],
  );

  const triggers = useMemo(
    () =>
      TABS.map(({ key, label, icon: Icon }) => (
        <TabsTrigger
          key={key}
          value={key}
          className={[
            // Layout
            "group/tab relative gap-1.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap",
            // Idle state — soft balsam-tinted muted text
            "text-muted-foreground/80 transition-colors",
            // Hover — cream tint surface, slightly warmer text
            "hover:bg-[#F4F1EC]/60 hover:text-foreground/90",
            // Active — balsam (sage) text + bolder weight
            "data-active:text-[#5C6E6C] data-active:font-semibold",
            // Override the default `after:bg-foreground` with our brand
            // balsam green so the underline matches the rest of the app.
            "after:bg-[#5C6E6C]!",
          ].join(" ")}
        >
          <Icon
            className={[
              "size-3.5 transition-colors",
              // Idle icon stays muted
              "opacity-70",
              // On active, icon becomes warm copper accent — same trick the
              // dashboard uses with the artemis/copper highlights.
              "group-data-active/tab:text-[#BB7154] group-data-active/tab:opacity-100",
            ].join(" ")}
          />
          {label}
        </TabsTrigger>
      )),
    [],
  );

  return (
    // `min-w-0` on every layer of the flex/grid stack ensures the page
    // itself never gets pushed wider than the viewport when the tab list
    // overflows on narrow screens — the scroll stays inside the tab bar.
    <Tabs
      value={active}
      onValueChange={onChange}
      className="min-w-0 overflow-hidden"
    >
      {/* Tab bar — internal horizontal scroll only when tabs don't fit. The
          right-edge fade hints at additional tabs without showing a scrollbar. */}
      <div className="relative min-w-0 border-b">
        <div className="-mx-1 overflow-x-auto px-1 scrollbar-thin">
          <TabsList variant="line" className="min-w-max gap-1">
            {triggers}
          </TabsList>
        </div>
        {/* Soft cream fade at the right edge — visual hint that the bar is
            scrollable on narrow viewports. Hidden on sm+ where everything fits. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden"
        />
      </div>

      <TabsContent value="datos" className="mt-5">
        <DatosPersonalesForm cliente={cliente} />
      </TabsContent>

      <TabsContent value="anamnesis" className="mt-5">
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
      </TabsContent>

      <TabsContent value="habitos" className="mt-5">
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
      </TabsContent>

      <TabsContent value="objetivos" className="mt-5">
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
      </TabsContent>

      <TabsContent value="rutinas" className="mt-5">
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
      </TabsContent>

      <TabsContent value="pagos" className="mt-5">
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
      </TabsContent>

      <TabsContent value="servicios" className="mt-5">
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
      </TabsContent>

      <TabsContent value="archivos" className="mt-5">
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
      </TabsContent>

      <TabsContent value="historial" className="mt-5">
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
      </TabsContent>

      <TabsContent value="fotos" className="mt-5">
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
      </TabsContent>
    </Tabs>
  );
}

