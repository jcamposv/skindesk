"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  ClipboardCheckIcon,
  MailIcon,
  MoreVerticalIcon,
  NotebookPenIcon,
  PhoneIcon,
  ScanFaceIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";

import { NuevaCitaButton } from "@/components/citas/nueva-cita-button";
import { ClienteStatusBadge } from "@/components/clientes/cliente-status-badge";
import { AvatarUpload } from "@/components/shared/avatar-upload";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ClienteDetail } from "@/services/clientes.service";
import type { StaffMember } from "@/services/staff.service";
import type { Evaluacion } from "@/types/evaluacion";

interface ClienteDetailHeaderProps {
  cliente: ClienteDetail;
  evaluacion: Evaluacion | null;
  staff: StaffMember[];
  currentProfesional: { id: string; full_name: string };
}

const BIRTH_FMT = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function ageFromBirth(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

function formatBirth(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  return BIRTH_FMT.format(d);
}

export function ClienteDetailHeader({
  cliente,
  evaluacion,
  staff,
  currentProfesional,
}: ClienteDetailHeaderProps) {
  const name = cliente.profile.full_name ?? "Sin nombre";
  const age = ageFromBirth(cliente.birth_date);
  const birth = formatBirth(cliente.birth_date);

  return (
    <header className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      {/* Top utility strip — back link + actions live inside the card. */}
      <div className="flex items-center justify-between border-b bg-[#FBF6F0]/70 px-3 py-1.5 sm:px-4">
        <Link
          href={ROUTES.clientes}
          className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-foreground text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Volver a clientas
        </Link>
        <Button variant="ghost" size="icon-sm" aria-label="Más acciones">
          <MoreVerticalIcon />
        </Button>
      </div>

      {/* Main row */}
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] lg:items-center lg:gap-5">
        {/* Identity */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
          <AvatarUpload
            profileId={cliente.profile.id}
            currentUrl={cliente.profile.avatar_url}
            currentPath={cliente.profile.avatar_path}
            name={name}
            size="lg"
            ringClassName="ring-4 ring-[#F6E0D6] ring-offset-2 ring-offset-card"
            clienteId={cliente.id}
          />
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading break-words text-xl font-medium tracking-tight sm:text-2xl">
                {name}
              </h1>
              <ClienteStatusBadge status={cliente.status} />
              <EvaluacionChip evaluacion={evaluacion} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground/75">
              {age != null ? (
                <span className="inline-flex items-center gap-1">
                  <SparklesIcon className="size-3 text-[#BB7154]" />
                  {age} años
                  {birth ? (
                    <span className="text-foreground/70"> · {birth}</span>
                  ) : null}
                </span>
              ) : null}
              <a
                href={`mailto:${cliente.profile.email}`}
                className="inline-flex min-w-0 max-w-full items-center gap-1 transition-colors hover:text-foreground"
              >
                <MailIcon className="size-3 shrink-0" />
                <span className="truncate">{cliente.profile.email}</span>
              </a>
              {cliente.profile.phone ? (
                <a
                  href={`tel:${cliente.profile.phone}`}
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  <PhoneIcon className="size-3 shrink-0" />
                  {cliente.profile.phone}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {/* Stats column — semantic 3-up */}
        <HeaderStats cliente={cliente} evaluacion={evaluacion} />

        {/* Primary CTA */}
        <div className="flex justify-end lg:self-center">
          <NuevaCitaButton
            cliente={{
              id: cliente.id,
              fullName: cliente.profile.full_name ?? "Clienta",
            }}
            staff={staff}
            currentProfesional={currentProfesional}
          />
        </div>
      </div>
    </header>
  );
}

// ─── Evaluation progress chip (next to name) ────────────────────────────────

function EvaluacionChip({
  evaluacion,
}: {
  evaluacion: Evaluacion | null;
}) {
  const { done, total } = computeEvalProgress(evaluacion ?? undefined);
  if (total === 0) return null;
  const complete = done === total;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1",
        complete
          ? "bg-[#E7ECEA] text-[#4F605C] ring-[#5C6E6C]/20"
          : done > 0
            ? "bg-[#F6E0D6] text-[#8C4A30] ring-[#BB7154]/25"
            : "bg-muted text-muted-foreground ring-border",
      )}
    >
      <ClipboardCheckIcon className="size-3" />
      Eval {done}/{total}
      {complete ? <CheckIcon className="size-2.5" strokeWidth={3} /> : null}
    </span>
  );
}

// ─── Stats column ───────────────────────────────────────────────────────────

interface HeaderStatsProps {
  cliente: ClienteDetail;
  evaluacion: Evaluacion | null;
}

function HeaderStats({ cliente, evaluacion }: HeaderStatsProps) {
  const skinSummary = useMemo(
    () => skinTypeFrom(evaluacion ?? undefined),
    [evaluacion],
  );
  const notesPreview = cliente.notes
    ? cliente.notes.replace(/\s+/g, " ").trim()
    : null;

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-[#E5DDD3]/50 sm:grid-cols-3">
      <Stat
        icon={ScanFaceIcon}
        label="Tipo de piel"
        primary={skinSummary.primary}
        secondary={skinSummary.secondary}
        tone={skinSummary.tone}
      />
      <Stat
        icon={CalendarIcon}
        label="Próxima cita"
        primary={formatNext(cliente.next_appointment_at)}
        secondary={
          cliente.last_appointment_at
            ? `Última: ${formatLast(cliente.last_appointment_at)}`
            : null
        }
        tone={cliente.next_appointment_at ? "sage" : "muted"}
      />
      <Stat
        icon={NotebookPenIcon}
        label="Notas rápidas"
        primary={notesPreview ?? "Sin notas"}
        tone={notesPreview ? "default" : "muted"}
        clamp
      />
    </div>
  );
}

interface StatProps {
  icon: LucideIcon;
  label: string;
  primary: string;
  secondary?: string | null;
  tone?: "default" | "sage" | "copper" | "muted";
  /** Allow long primary text to wrap to 2 lines instead of truncating. */
  clamp?: boolean;
}

function Stat({
  icon: Icon,
  label,
  primary,
  secondary,
  tone = "default",
  clamp,
}: StatProps) {
  const primaryClass =
    tone === "sage"
      ? "text-[#4F605C]"
      : tone === "copper"
        ? "text-[#8C4A30]"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="flex flex-col gap-1 bg-[#FBF6F0]/80 px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#7C5E1F]/80">
        <Icon className="size-3" />
        {label}
      </span>
      <span
        className={cn(
          "text-[13px] font-medium leading-snug",
          primaryClass,
          clamp ? "line-clamp-2" : "truncate",
        )}
      >
        {primary}
      </span>
      {secondary ? (
        <span className="truncate text-xs font-medium text-foreground/75">
          {secondary}
        </span>
      ) : null}
    </div>
  );
}

// ─── Derivations ────────────────────────────────────────────────────────────

interface SkinSummary {
  primary: string;
  secondary?: string;
  tone: StatProps["tone"];
}

function skinTypeFrom(evaluacion: Evaluacion | undefined): SkinSummary {
  if (!evaluacion) return { primary: "Sin evaluar", tone: "muted" };
  const biotipo = evaluacion.diagnostico.biotipo;
  if (!biotipo) return { primary: "Sin evaluar", tone: "muted" };
  const sens = evaluacion.diagnostico.sensaciones?.[0];
  const altPig = evaluacion.diagnostico.altPigmento?.[0];
  const secondary = [sens, altPig].filter(Boolean).slice(0, 2).join(" · ");
  return {
    primary: biotipo,
    secondary: secondary || undefined,
    tone: "default",
  };
}

function formatNext(iso: string | null): string {
  if (!iso) return "Sin agendar";
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return "Sin agendar";
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  if (diffMs < 0) return "Sin agendar";
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Mañana";
  if (diffDays < 7) return `En ${diffDays} días`;
  if (diffDays < 14) return "En 1 sem";
  if (diffDays < 30) return `En ${Math.round(diffDays / 7)} sem`;
  return target.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function formatLast(iso: string | null): string {
  if (!iso) return "Nunca";
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return "Nunca";
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  if (diffMs < 0) return "Hoy";
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 14) return "Hace 1 sem";
  if (diffDays < 30) return `Hace ${Math.round(diffDays / 7)} sem`;
  return target.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

interface EvalProgress {
  done: number;
  total: number;
}

function computeEvalProgress(
  evaluacion: Evaluacion | undefined,
): EvalProgress {
  if (!evaluacion) return { done: 0, total: 0 };
  const a = evaluacion.anamnesis;
  const h = evaluacion.habitos;
  const d = evaluacion.diagnostico;

  const anamnesisDone =
    (a?.procedimientos?.length ?? 0) > 0 ||
    (a?.patologias?.length ?? 0) > 0 ||
    a?.alergias?.tiene === true ||
    (a?.condicionesAparatologia?.length ?? 0) > 0 ||
    a?.medicamentoContinuo?.tiene === true ||
    Boolean(a?.observacionClinica);

  const habitosDone =
    Boolean(h?.alimentacion) ||
    Boolean(h?.exposicionSolar) ||
    h?.usaSpf === true ||
    Boolean(h?.lavadosDia) ||
    Boolean(h?.rutinaAm) ||
    Boolean(h?.rutinaPm) ||
    h?.fuma?.si === true ||
    h?.alcohol?.si === true;

  const diagnosticoDone =
    Boolean(d?.biotipo) ||
    Boolean(d?.fitzpatrick) ||
    Boolean(d?.glogau) ||
    (d?.sensaciones?.length ?? 0) > 0 ||
    (d?.mapaFacial?.length ?? 0) > 0 ||
    d?.acne?.activo === true ||
    Boolean(d?.observaciones);

  const done =
    Number(anamnesisDone) + Number(habitosDone) + Number(diagnosticoDone);
  return { done, total: 3 };
}
