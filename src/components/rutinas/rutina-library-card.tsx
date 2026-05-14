"use client";

import { memo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CopyIcon,
  DownloadIcon,
  Link2Icon,
  Link2OffIcon,
  MailIcon,
  MoonIcon,
  MoreVerticalIcon,
  PencilIcon,
  SendIcon,
  ShareIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  archiveRutinaAction,
  duplicateRutinaAction,
  generateShareTokenAction,
  revokeShareTokenAction,
} from "@/actions/rutinas.actions";
import { ShareEmailDialog } from "@/components/rutinas/share-email-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  RUTINA_MOMENTO_SHORT,
  RUTINA_TAG_LABELS,
  type RutinaMomento,
  type RutinaTag,
} from "@/schemas/rutinas.schema";
import type { LibraryStepPreview } from "@/services/rutinas.service";
import type { Database } from "@/types/database.types";

type RutinaRow = Database["public"]["Tables"]["rutinas"]["Row"];

export type LibraryRutina = RutinaRow & {
  stepCount: number;
  stepsPreview: LibraryStepPreview[];
};

interface RutinaLibraryCardProps {
  rutina: LibraryRutina;
  onAssign: (rutinaId: string) => void;
  onView: (rutinaId: string) => void;
  /** When false (asistente or inactive membership), the "Generar link"
   *  + share-by-email items are hidden from the kebab. */
  canShare: boolean;
}

/**
 * Compact library card. Replaces the gradient-hero design with a
 * scannable layout: name + momento badge on top, meta subline, numbered
 * step preview (first 3), then footer with Ver / Asignar.
 *
 * Memoized so a search keystroke that re-runs the parent only re-renders
 * cards whose `rutina` reference actually changed (react-best-practices
 * `rerender-memo`). Handler props from the grid are stable via
 * `useCallback`.
 */
function RutinaLibraryCardImpl({
  rutina,
  onAssign,
  onView,
  canShare,
}: RutinaLibraryCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const momento = rutina.momento as RutinaMomento;
  const editHref = `${ROUTES.rutinas}/${rutina.id}/editar`;
  const visibleSteps = rutina.stepsPreview.slice(0, 3);
  const hiddenCount = Math.max(0, rutina.stepCount - visibleSteps.length);

  function handleDuplicate() {
    startTransition(async () => {
      const res = await duplicateRutinaAction(rutina.id);
      if (!res.success) {
        toast.error(res.message ?? "No se pudo duplicar.");
        return;
      }
      toast.success(res.message ?? "Rutina duplicada.");
      router.refresh();
    });
  }

  function handleArchive() {
    startTransition(async () => {
      const res = await archiveRutinaAction(rutina.id);
      if (!res.success) {
        toast.error(res.message ?? "No se pudo eliminar.");
        return;
      }
      toast.success(res.message ?? "Rutina eliminada.");
      setConfirmDelete(false);
      router.refresh();
    });
  }

  function handleShare() {
    startTransition(async () => {
      const res = await generateShareTokenAction(rutina.id);
      if (!res.success || !res.data) {
        toast.error(res.message ?? "No se pudo generar el link.");
        return;
      }
      const url = res.data.shareUrl;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado al portapapeles.");
      } catch {
        toast.success("Link generado: " + url);
      }
    });
  }

  function handleRevoke() {
    startTransition(async () => {
      const res = await revokeShareTokenAction(rutina.id);
      if (!res.success) {
        toast.error(res.message ?? "No se pudo revocar.");
        return;
      }
      toast.success(res.message ?? "Link revocado.");
      router.refresh();
    });
  }

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all",
        "hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_8px_28px_-12px_rgba(0,0,0,0.12)]",
      )}
      data-pending={pending ? "" : undefined}
    >
      {/* Header — name + momento badge + kebab */}
      <header className="flex items-start gap-2 px-4 pt-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-heading text-[15px] font-semibold leading-tight text-foreground">
            {rutina.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-foreground/70">
            {[
              rutina.skin_type ? `Piel ${rutina.skin_type}` : null,
              rutina.skin_condition,
              rutina.main_objective,
              `${rutina.stepCount} ${rutina.stepCount === 1 ? "paso" : "pasos"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <MomentoBadge momento={momento} />
        <ActionsMenu
          canShare={canShare}
          hasShareToken={Boolean(rutina.share_token)}
          editHref={editHref}
          onDuplicate={handleDuplicate}
          onShare={handleShare}
          onShareEmail={() => setEmailOpen(true)}
          onRevoke={handleRevoke}
          onDelete={() => setConfirmDelete(true)}
        />
      </header>

      {/* Step preview list */}
      <ol className="mt-2 grid gap-1 px-4 pb-3">
        {visibleSteps.length === 0 ? (
          <li className="text-xs italic text-foreground/55">
            Sin pasos guardados todavía
          </li>
        ) : (
          visibleSteps.map((s) => (
            <li
              key={s.step_order}
              className="flex items-center gap-2 text-sm text-foreground/85"
            >
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#FBEFE7] text-[11px] font-bold text-[#7A3D24]"
              >
                {s.step_order}
              </span>
              <span className="truncate">{s.producto_name}</span>
            </li>
          ))
        )}
        {hiddenCount > 0 ? (
          <li className="ml-7 text-xs font-medium text-foreground/60">
            +{hiddenCount} {hiddenCount === 1 ? "paso más" : "pasos más"}
          </li>
        ) : null}
      </ol>

      {/* Tags + share status row (only renders if there's something to show) */}
      {rutina.tags.length > 0 || rutina.share_token ? (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2">
          {rutina.share_token ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[#5C6E6C] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
              title="Link compartible activo"
            >
              <ShareIcon className="size-2.5" />
              Compartida
            </span>
          ) : null}
          {rutina.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full border border-[#5C6E6C]/30 bg-[#E7ECEA] px-2 py-0.5 text-xs font-medium text-[#4F605C]"
            >
              {RUTINA_TAG_LABELS[t as RutinaTag] ?? t}
            </span>
          ))}
          {rutina.tags.length > 3 ? (
            <span className="text-xs font-medium text-foreground/65">
              +{rutina.tags.length - 3}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Footer — actions */}
      <footer className="mt-auto flex items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2.5">
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5"
          onClick={() => onView(rutina.id)}
        >
          Ver
        </Button>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            render={<Link href={editHref} />}
          >
            <PencilIcon className="size-3.5" />
            Editar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="cta"
            className="gap-1.5"
            onClick={() => onAssign(rutina.id)}
            disabled={pending}
          >
            <SendIcon className="size-3.5" />
            Asignar
          </Button>
        </div>
      </footer>

      {confirmDelete ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/95 p-4 text-center backdrop-blur">
          <p className="text-[15px] font-semibold text-foreground">
            ¿Eliminar esta rutina?
          </p>
          <p className="text-sm leading-relaxed text-foreground/75">
            Las asignaciones a clientas mantienen su copia.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleArchive}
              disabled={pending}
            >
              Eliminar
            </Button>
          </div>
        </div>
      ) : null}

      {canShare ? (
        <ShareEmailDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          rutinaId={rutina.id}
          rutinaName={rutina.name}
        />
      ) : null}
    </article>
  );
}

export const RutinaLibraryCard = memo(RutinaLibraryCardImpl);

// ─── Subcomponents ──────────────────────────────────────────────────────────

function MomentoBadge({ momento }: { momento: RutinaMomento }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-foreground ring-1 ring-border">
      {momento === "am" ? (
        <SunIcon className="size-3 text-[#C47A2B]" />
      ) : momento === "pm" ? (
        <MoonIcon className="size-3 text-[#6B4FA0]" />
      ) : (
        <>
          <SunIcon className="size-3 text-[#C47A2B]" />
          <MoonIcon className="size-3 text-[#6B4FA0]" />
        </>
      )}
      {RUTINA_MOMENTO_SHORT[momento]}
    </span>
  );
}

interface ActionsMenuProps {
  canShare: boolean;
  hasShareToken: boolean;
  editHref: string;
  onDuplicate: () => void;
  onShare: () => void;
  onShareEmail: () => void;
  onRevoke: () => void;
  onDelete: () => void;
}

function ActionsMenu({
  canShare,
  hasShareToken,
  editHref,
  onDuplicate,
  onShare,
  onShareEmail,
  onRevoke,
  onDelete,
}: ActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Más acciones"
            className="-mt-1 -mr-1 shrink-0 text-foreground/65 hover:text-foreground"
          >
            <MoreVerticalIcon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={editHref} />}>
          <PencilIcon className="size-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <CopyIcon className="size-4" />
          Duplicar
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            <a
              href={editHref.replace("/editar", "/pdf")}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <DownloadIcon className="size-4" />
          Descargar PDF
        </DropdownMenuItem>
        {canShare ? (
          <DropdownMenuItem onClick={onShare}>
            <Link2Icon className="size-4" />
            Generar link de compartir
          </DropdownMenuItem>
        ) : null}
        {canShare ? (
          <DropdownMenuItem onClick={onShareEmail}>
            <MailIcon className="size-4" />
            Compartir por email
          </DropdownMenuItem>
        ) : null}
        {canShare && hasShareToken ? (
          <DropdownMenuItem onClick={onRevoke}>
            <Link2OffIcon className="size-4" />
            Revocar link
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2Icon className="size-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Nueva rutina" featured card — always first in the grid. */
export function RutinaCreateCard() {
  return (
    <Link
      href={`${ROUTES.rutinas}/nueva`}
      className={cn(
        "group flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 text-center transition-all",
        "border-[#D2A96A]/50 bg-[#F8EFD7]/40 text-[#7C5E1F] hover:border-[#D2A96A] hover:bg-[#F8EFD7]/70 hover:shadow-[0_8px_28px_-12px_rgba(212,169,106,0.4)]",
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-[#D2A96A] text-white shadow-sm transition-transform group-hover:scale-110">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>
      <div>
        <p className="font-heading text-base font-semibold">Crear nueva rutina</p>
        <p className="mt-1 text-sm text-[#5E4615]">
          Construí paso a paso usando tu catálogo
        </p>
      </div>
    </Link>
  );
}
