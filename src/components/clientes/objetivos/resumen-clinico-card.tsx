"use client";

import {
  AlertTriangleIcon,
  LayersIcon,
  ScanFaceIcon,
  ShieldCheckIcon,
  SunIcon,
} from "lucide-react";

import { SectionCard } from "@/components/shared/section-card";
import { cn } from "@/lib/utils";
import {
  ALTERATION_CODES,
  type AlterationCode,
  type Evaluacion,
} from "@/types/evaluacion";

import { romanize } from "./helpers";

/**
 * Read-only summary of the clienta's clinical state, derived entirely from
 * the evaluación payload. Lives in its own file so the objetivos tab stays
 * focused on plan orchestration.
 */
export function ResumenClinicoCard({ evaluacion }: { evaluacion: Evaluacion }) {
  const { diagnostico, anamnesis } = evaluacion;
  const fototipoText = diagnostico.fitzpatrick
    ? `Fototipo ${romanize(diagnostico.fitzpatrick)}`
    : null;
  const glogauText = diagnostico.glogau
    ? `Glogau ${romanize(diagnostico.glogau)}`
    : null;
  const biotipoText = diagnostico.biotipo
    ? `Piel ${diagnostico.biotipo.toLowerCase()}`
    : null;

  const alteraciones: string[] = [
    ...diagnostico.sensaciones,
    ...diagnostico.altPigmento,
    ...diagnostico.altEpidermis,
    ...diagnostico.altFoliculo,
    ...(diagnostico.altVasculares.presenta
      ? diagnostico.altVasculares.tipos
      : []),
    ...(diagnostico.ojeras.presenta
      ? diagnostico.ojeras.tipos.map((t) => `Ojeras · ${t}`)
      : []),
  ];
  if (diagnostico.acne.activo && diagnostico.acne.grado) {
    alteraciones.unshift(`Acné Grado ${romanize(diagnostico.acne.grado)}`);
  }

  const codeCounts = diagnostico.mapaFacial.reduce<Record<string, number>>(
    (acc, p) => {
      if (!p?.code) return acc;
      acc[p.code] = (acc[p.code] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const topCodes = Object.entries(codeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4) as Array<[AlterationCode, number]>;

  const alergias = anamnesis.alergias;

  return (
    <SectionCard
      icon={ScanFaceIcon}
      title="Resumen clínico"
      hint="Datos derivados automáticamente de la evaluación."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryColumn title="Diagnóstico de piel">
          <SummaryPill icon={ScanFaceIcon} text={biotipoText ?? "Sin biotipo"} />
          {fototipoText ? (
            <SummaryPill icon={SunIcon} text={fototipoText} />
          ) : null}
          {glogauText ? (
            <SummaryPill icon={LayersIcon} text={glogauText} />
          ) : null}
        </SummaryColumn>

        <SummaryColumn title="Alergias">
          {alergias.tiene ? (
            <>
              <SummaryPill
                icon={AlertTriangleIcon}
                tone="rose"
                text={
                  alergias.tipos.length > 0
                    ? `Con alergias · ${alergias.tipos.join(", ")}`
                    : "Con alergias"
                }
              />
              {alergias.detalle ? (
                <p className="text-sm text-foreground/75">{alergias.detalle}</p>
              ) : null}
            </>
          ) : (
            <SummaryPill
              icon={ShieldCheckIcon}
              tone="sage"
              text="Sin alergias reportadas"
            />
          )}
        </SummaryColumn>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground/80">
          Alteraciones detectadas
        </p>
        {alteraciones.length === 0 ? (
          <p className="text-sm text-foreground/75">
            Sin alteraciones registradas en el diagnóstico.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {alteraciones.map((a, i) => (
              <span
                key={`${i}-${a}`}
                className="inline-flex items-center rounded-full bg-[#FBEFE7] px-3 py-1 text-sm font-medium text-[#8C4A30]"
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {topCodes.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground/80">
            Alteraciones más frecuentes
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {topCodes.map(([code, count]) => {
              const label =
                ALTERATION_CODES.find((c) => c.code === code)?.label ?? code;
              return (
                <li
                  key={code}
                  className="flex items-center gap-2 rounded-lg border border-border/40 bg-card px-2.5 py-1.5 text-sm"
                >
                  <span className="flex size-6 items-center justify-center rounded-md bg-[#BB7154] text-[10px] font-bold text-white">
                    {code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground/85">
                    {label}
                  </span>
                  <span className="text-xs font-medium text-foreground/75">
                    ×{count}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
}

interface SummaryColumnProps {
  title: string;
  children: React.ReactNode;
}

function SummaryColumn({ title, children }: SummaryColumnProps) {
  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-bold uppercase tracking-wider text-[#4F605C]">
        {title}
      </p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

interface SummaryPillProps {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  tone?: "default" | "sage" | "rose";
}

function SummaryPill({ icon: Icon, text, tone = "default" }: SummaryPillProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-none",
        tone === "sage"
          ? "border-[#5C6E6C]/20 bg-[#E7ECEA]/60 text-[#4F605C]"
          : tone === "rose"
            ? "border-[#7B3D3D]/15 bg-[#F8EAE9]/55 text-[#7B3D3D]"
            : "border-border/60 bg-card text-foreground/80",
      )}
    >
      <Icon className="size-2.5 shrink-0 opacity-80" />
      <span className="truncate">{text}</span>
    </span>
  );
}
