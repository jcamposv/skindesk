"use client";

import {
  DropletIcon,
  GaugeIcon,
  ImageIcon,
  LayersIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { BodyZonePicker } from "./maps/body-zone-picker";
import { FacialZonePicker } from "./maps/facial-zone-picker";
import { LaserZonePicker } from "./maps/laser-zone-picker";
import { ZoneMap } from "./maps/zone-map";
import {
  BODY_SILHOUETTE_BACK,
  LASER_MAP_ZONES_BACK,
} from "./maps/zones";
import {
  REACTION_LABEL,
  type AssignedService,
  type Session,
} from "./types";

interface SessionDetailExpandedProps {
  session: Session;
  serviceType: AssignedService["serviceType"];
}

/**
 * Read-only render of a session's full data — used inside the
 * `ServiceHistorySheet` collapsible rows. Two-column on lg+: map on the
 * left (so the user sees what zones were treated), full clinical detail on
 * the right.
 *
 * For "other" services there is no map — falls back to a single column.
 */
export function SessionDetailExpanded({
  session,
  serviceType,
}: SessionDetailExpandedProps) {
  const hasMap = serviceType !== "other";

  return (
    <div className="mt-3 grid gap-4 border-t border-border/60 pt-3">
      <div
        className={
          hasMap
            ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-5"
            : "grid gap-4"
        }
      >
        {hasMap ? (
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Zonas tratadas en esta sesión
            </p>
            <SessionMapReadOnly session={session} serviceType={serviceType} />
          </div>
        ) : null}

        <div className="grid content-start gap-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Detalle clínico
          </p>
          <SessionFieldsTable session={session} serviceType={serviceType} />
        </div>
      </div>

      {session.beforePaths.length > 0 || session.afterPaths.length > 0 ? (
        <div className="grid gap-3">
          {session.beforePaths.length > 0 ? (
            <PhotoStrip
              label="Antes"
              tone="before"
              paths={session.beforePaths}
              urls={session.beforeUrls}
            />
          ) : null}
          {session.afterPaths.length > 0 ? (
            <PhotoStrip
              label="Después"
              tone="after"
              paths={session.afterPaths}
              urls={session.afterUrls}
            />
          ) : null}
        </div>
      ) : null}

      {session.recommendations ? (
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Recomendaciones para casa
          </p>
          <p className="rounded-md bg-muted/40 px-3 py-2 text-[12px] italic text-foreground/80">
            “{session.recommendations}”
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ─── Map (read-only) ────────────────────────────────────────────────────────

function SessionMapReadOnly({
  session,
  serviceType,
}: {
  session: Session;
  serviceType: AssignedService["serviceType"];
}) {
  const { payload } = session;

  if (serviceType === "facial" && payload.type === "facial") {
    return (
      <FacialZonePicker
        selected={payload.data.zones}
        onToggle={() => {}}
        readOnly
      />
    );
  }
  if (serviceType === "corporal" && payload.type === "corporal") {
    return (
      <BodyZonePicker
        selected={payload.data.zones}
        onToggle={() => {}}
        readOnly
      />
    );
  }
  if (serviceType === "laser" && payload.type === "laser") {
    if (payload.data.view === "back") {
      return (
        <ZoneMap
          variant="body"
          silhouette={BODY_SILHOUETTE_BACK}
          zones={LASER_MAP_ZONES_BACK}
          selected={payload.data.zones}
          onToggle={() => {}}
          readOnly
        />
      );
    }
    return (
      <LaserZonePicker
        selected={payload.data.zones}
        onToggle={() => {}}
        readOnly
      />
    );
  }
  return null;
}

// ─── Fields table per service type ──────────────────────────────────────────

function SessionFieldsTable({
  session,
  serviceType,
}: {
  session: Session;
  serviceType: AssignedService["serviceType"];
}) {
  const { payload } = session;

  if (serviceType === "facial" && payload.type === "facial") {
    const f = payload.data;
    return (
      <dl className="grid gap-2">
        <Row icon={LayersIcon} label="Tipo de piel" value={f.skinType} />
        <Row icon={LayersIcon} label="Condición" value={f.skinCondition} />
        <Row
          icon={GaugeIcon}
          label="Sensibilidad / Acné / Hidratación"
          value={`${f.sensitivity}/5 · ${f.acne}/5 · ${f.hydration}/5`}
        />
        <Row
          icon={GaugeIcon}
          label="Aparatología"
          value={f.devices.join(", ")}
        />
        <Row
          icon={DropletIcon}
          label="Productos"
          value={f.products.join(", ")}
        />
        <Row
          icon={DropletIcon}
          label="Activos"
          value={f.actives.join(", ")}
        />
        <Row icon={LayersIcon} label="Protocolo" value={f.protocol} />
        <Row
          icon={GaugeIcon}
          label="Reacción"
          value={REACTION_LABEL[f.reaction]}
        />
        {session.notes ? (
          <Row icon={LayersIcon} label="Notas técnicas" value={session.notes} />
        ) : null}
        <Row
          icon={GaugeIcon}
          label="Duración"
          value={`${session.durationMin} min`}
        />
      </dl>
    );
  }

  if (serviceType === "corporal" && payload.type === "corporal") {
    const c = payload.data;
    return (
      <dl className="grid gap-2">
        <Row icon={LayersIcon} label="Técnica" value={c.technique} />
        <Row
          icon={GaugeIcon}
          label="Aparatología"
          value={c.devices.join(", ")}
        />
        <Row
          icon={LayersIcon}
          label="Medidas"
          value={
            c.measurementsBefore || c.measurementsAfter
              ? `${c.measurementsBefore || "—"} → ${c.measurementsAfter || "—"}`
              : ""
          }
        />
        {c.weight ? (
          <Row icon={LayersIcon} label="Peso" value={`${c.weight} kg`} />
        ) : null}
        <Row
          icon={GaugeIcon}
          label="Dolor / Inflamación / Fibrosis"
          value={`${c.pain}/5 · ${c.inflammation}/5 · ${c.fibrosis}/5`}
        />
        <Row
          icon={GaugeIcon}
          label="Celulitis / Retención"
          value={`${c.cellulite}/5 · ${c.fluidRetention}/5`}
        />
        <Row
          icon={DropletIcon}
          label="Productos / activos"
          value={c.productsOrActives.join(", ")}
        />
        <Row icon={LayersIcon} label="Observaciones" value={c.observations} />
        {c.postOp ? (
          <>
            <Row
              icon={LayersIcon}
              label="Post-op · cirugía"
              value={c.postOp.surgeryType}
            />
            <Row
              icon={LayersIcon}
              label="Post-op · médico"
              value={c.postOp.doctorName}
            />
            <Row
              icon={GaugeIcon}
              label="Post-op · inflamación"
              value={`${c.postOp.swelling}/5`}
            />
            <Row
              icon={LayersIcon}
              label="Post-op · drenaje"
              value={c.postOp.drainageNotes}
            />
          </>
        ) : null}
        {session.notes ? (
          <Row icon={LayersIcon} label="Notas técnicas" value={session.notes} />
        ) : null}
        <Row
          icon={GaugeIcon}
          label="Duración"
          value={`${session.durationMin} min`}
        />
      </dl>
    );
  }

  if (serviceType === "laser" && payload.type === "laser") {
    const l = payload.data;
    return (
      <dl className="grid gap-2">
        <Row
          icon={GaugeIcon}
          label="Vista"
          value={l.view === "front" ? "Frente" : "Espalda"}
        />
        <Row icon={GaugeIcon} label="Fluencia" value={l.fluence} />
        <Row icon={GaugeIcon} label="Ancho de pulso" value={l.pulseWidth} />
        <Row icon={GaugeIcon} label="Longitud de onda" value={l.wavelength} />
        <Row icon={GaugeIcon} label="Disparos" value={l.shotCount} />
        <Row icon={GaugeIcon} label="Potencia" value={l.powerLevel} />
        <Row
          icon={GaugeIcon}
          label="Reacción / Dolor"
          value={`${REACTION_LABEL[l.reaction]} · ${l.pain}/5`}
        />
        {l.reductionPct ? (
          <Row
            icon={GaugeIcon}
            label="% reducción"
            value={`${l.reductionPct}%`}
          />
        ) : null}
        {l.nextParams ? (
          <Row
            icon={LayersIcon}
            label="Parámetros próxima sesión"
            value={l.nextParams}
          />
        ) : null}
        {session.notes ? (
          <Row icon={LayersIcon} label="Notas técnicas" value={session.notes} />
        ) : null}
        <Row
          icon={GaugeIcon}
          label="Duración"
          value={`${session.durationMin} min`}
        />
      </dl>
    );
  }

  if (serviceType === "other" && payload.type === "other") {
    const o = payload.data;
    return (
      <dl className="grid gap-2">
        <Row icon={LayersIcon} label="Categoría" value={o.category} />
        <Row icon={LayersIcon} label="Objetivo" value={o.objective} />
        <Row icon={LayersIcon} label="Zona tratada" value={o.treatedArea} />
        <Row
          icon={GaugeIcon}
          label="Aparatología"
          value={o.devices.join(", ")}
        />
        <Row
          icon={DropletIcon}
          label="Productos / activos"
          value={o.products.join(", ")}
        />
        <Row icon={LayersIcon} label="Protocolo" value={o.protocolNotes} />
        {session.notes ? (
          <Row icon={LayersIcon} label="Notas técnicas" value={session.notes} />
        ) : null}
        <Row
          icon={GaugeIcon}
          label="Duración"
          value={`${session.durationMin} min`}
        />
      </dl>
    );
  }

  return null;
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  if (!value || value.trim() === "") return null;
  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-2 rounded-md border border-border/40 bg-card/60 px-2.5 py-1.5">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted/60 text-muted-foreground">
        <Icon className="size-2.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
          {label}
        </p>
        <p className="text-[12px] text-foreground/85">{value}</p>
      </div>
    </div>
  );
}

// ─── Photo strip (read-only thumbs from signed URLs) ────────────────────────

function PhotoStrip({
  label,
  tone,
  paths,
  urls = [],
}: {
  label: string;
  tone: "before" | "after";
  paths: string[];
  urls?: string[];
}) {
  const toneClasses =
    tone === "before"
      ? "border-[#5C6E6C]/30 bg-[#E7ECEA]/40 text-[#4F605C]"
      : "border-[#BB7154]/30 bg-[#FBEFE7]/40 text-[#8C4A30]";

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Fotos · {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {paths.map((path, i) => {
          const url = urls[i];
          return (
            <div
              key={path}
              className={cn(
                "size-16 overflow-hidden rounded-lg border",
                toneClasses,
              )}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={`Foto ${label.toLowerCase()} ${i + 1}`}
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center">
                  <ImageIcon className="size-4" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
