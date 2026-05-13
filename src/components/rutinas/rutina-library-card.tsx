"use client";

import { useState, useTransition } from "react";
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
  gradientForRutina,
  RUTINA_MOMENTO_SHORT,
  RUTINA_TAG_LABELS,
  type RutinaMomento,
  type RutinaTag,
} from "@/schemas/rutinas.schema";
import type { Database } from "@/types/database.types";

type RutinaRow = Database["public"]["Tables"]["rutinas"]["Row"];

interface RutinaLibraryCardProps {
  rutina: RutinaRow & { stepCount: number };
  onAssign: (rutinaId: string) => void;
  /** When false (asistente or inactive membership), the "Generar link"
   *  + share-by-email items are hidden from the kebab. */
  canShare: boolean;
}

/**
 * Library card. Visual gradient by hashed name, momento badge AM/PM/Both,
 * step count, skin type + tags. Click navigates to the builder in edit
 * mode. Kebab carries duplicate / share / delete + assign.
 */
export function RutinaLibraryCard({
  rutina,
  onAssign,
  canShare,
}: RutinaLibraryCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const gradient = gradientForRutina(rutina.name);
  const momento = rutina.momento as RutinaMomento;
  const editHref = `${ROUTES.rutinas}/${rutina.id}/editar`;

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
      // Canonical URL built server-side via NEXT_PUBLIC_APP_URL.
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
      {/* Visual band */}
      <Link
        href={editHref}
        className={cn(
          "relative flex aspect-[5/3] w-full items-end overflow-hidden bg-gradient-to-br p-4",
          gradient,
        )}
      >
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-foreground/80 backdrop-blur">
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
        {rutina.share_token ? (
          // Visible owner-facing reminder that this rutina has an active
          // share link. Click → revoke flow is in the kebab; the badge is
          // pure signal so the owner doesn't have to open the menu to
          // check status. Tooltip surfaces last-accessed when available.
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#5C6E6C] px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur"
            title={
              rutina.share_token_last_accessed_at
                ? `Último acceso: ${new Intl.DateTimeFormat("es", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(rutina.share_token_last_accessed_at))}`
                : "Link compartible activo"
            }
          >
            <ShareIcon className="size-2.5" />
            Compartida
          </span>
        ) : null}
        <div>
          <h3 className="font-heading text-lg font-medium leading-tight text-foreground/90">
            {rutina.name}
          </h3>
          {rutina.main_objective ? (
            <p className="mt-1 line-clamp-2 text-[11.5px] text-foreground/60">
              {rutina.main_objective}
            </p>
          ) : null}
        </div>
      </Link>

      {/* Meta */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium tabular-nums">
            {rutina.stepCount}{" "}
            {rutina.stepCount === 1 ? "paso" : "pasos"}
          </span>
          {rutina.skin_type ? (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>Piel {rutina.skin_type}</span>
            </>
          ) : null}
        </div>

        {rutina.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {rutina.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full border border-[#5C6E6C]/30 bg-[#E7ECEA] px-2 py-0.5 text-[11px] font-medium text-[#4F605C]"
              >
                {RUTINA_TAG_LABELS[t as RutinaTag] ?? t}
              </span>
            ))}
            {rutina.tags.length > 3 ? (
              <span className="text-[11px] text-muted-foreground">
                +{rutina.tags.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}

        <footer className="mt-auto flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            render={<Link href={editHref} />}
          >
            <PencilIcon className="size-3.5" />
            Editar
          </Button>

          <div className="flex items-center gap-1">
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
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Más acciones"
                  >
                    <MoreVerticalIcon className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDuplicate}>
                  <CopyIcon className="size-4" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    window.open(
                      `${ROUTES.rutinas}/${rutina.id}/pdf`,
                      "_blank",
                      "noopener",
                    )
                  }
                >
                  <DownloadIcon className="size-4" />
                  Descargar PDF
                </DropdownMenuItem>
                {canShare ? (
                  <DropdownMenuItem onClick={handleShare}>
                    <Link2Icon className="size-4" />
                    Generar link de compartir
                  </DropdownMenuItem>
                ) : null}
                {canShare ? (
                  <DropdownMenuItem onClick={() => setEmailOpen(true)}>
                    <MailIcon className="size-4" />
                    Compartir por email
                  </DropdownMenuItem>
                ) : null}
                {canShare && rutina.share_token ? (
                  <DropdownMenuItem onClick={handleRevoke}>
                    <Link2OffIcon className="size-4" />
                    Revocar link
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2Icon className="size-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </footer>
      </div>

      {confirmDelete ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/95 p-4 text-center backdrop-blur">
          <p className="text-sm font-medium">¿Eliminar esta rutina?</p>
          <p className="text-xs text-muted-foreground">
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

/** "Crear nueva rutina" featured card — always first in the grid. */
export function RutinaCreateCard() {
  return (
    <Link
      href={`${ROUTES.rutinas}/nueva`}
      className={cn(
        "group flex aspect-[5/3] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed text-center transition-all",
        "border-[#D2A96A]/50 bg-[#F8EFD7]/40 text-[#7C5E1F] hover:border-[#D2A96A] hover:bg-[#F8EFD7]/70 hover:shadow-[0_8px_28px_-12px_rgba(212,169,106,0.4)]",
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-[#D2A96A] text-white shadow-sm transition-transform group-hover:scale-110">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
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
        <p className="font-heading text-sm font-medium">Crear nueva rutina</p>
        <p className="mt-1 text-[11px] text-[#7C5E1F]/70">
          Construí paso a paso usando tu catálogo
        </p>
      </div>
    </Link>
  );
}
