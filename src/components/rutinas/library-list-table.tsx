"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CopyIcon,
  DownloadIcon,
  Link2Icon,
  Link2OffIcon,
  MailIcon,
  MoonIcon,
  PencilIcon,
  RouteIcon,
  SendIcon,
  ShareIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  archiveRutinaAction,
  assignRutinaToClienteAction,
  duplicateRutinaAction,
  generateShareTokenAction,
  revokeShareTokenAction,
} from "@/actions/rutinas.actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AssignRutinaDialog } from "@/components/rutinas/assign-rutina-dialog";
import { ShareEmailDialog } from "@/components/rutinas/share-email-dialog";
import { DataTable, type RowAction } from "@/components/data-table";
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
type RutinaWithCount = RutinaRow & { stepCount: number };

interface LibraryListTableProps {
  items: RutinaWithCount[];
  totalItems: number;
  clientes: Array<{ id: string; fullName: string }>;
  /** Hides the "Generar link" row action for users without share rights
   *  (asistente or inactive membership). */
  canShare: boolean;
}

const DATE_FORMAT = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/**
 * List variant of the rutinas library — same data as the grid but rendered
 * through the shared `DataTable`. Toolbar / search / sort / pagination
 * live outside in the page (URL-driven), so the table's built-ins are
 * disabled.
 */
export function LibraryListTable({
  items,
  totalItems,
  clientes,
  canShare,
}: LibraryListTableProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [assignTarget, setAssignTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<RutinaWithCount | null>(null);
  const [emailTarget, setEmailTarget] = useState<RutinaWithCount | null>(null);

  function handleEdit(r: RutinaWithCount) {
    router.push(`${ROUTES.rutinas}/${r.id}/editar`);
  }

  function handleDuplicate(r: RutinaWithCount) {
    startTransition(async () => {
      const res = await duplicateRutinaAction(r.id);
      if (!res.success) {
        toast.error(res.message ?? "No se pudo duplicar.");
        return;
      }
      toast.success(res.message ?? "Rutina duplicada.");
      router.refresh();
    });
  }

  function handleArchive(r: RutinaWithCount) {
    // Use the shared AlertDialog (same pattern as `ProductosPageClient`)
    // rather than `confirm()` so the destructive flow matches the rest
    // of the app.
    setDeleting(r);
  }

  function confirmArchive() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    startTransition(async () => {
      const res = await archiveRutinaAction(target.id);
      if (!res.success) {
        toast.error(res.message ?? "No se pudo eliminar.");
        return;
      }
      toast.success(res.message ?? "Rutina eliminada.");
      router.refresh();
    });
  }

  function handleShare(r: RutinaWithCount) {
    startTransition(async () => {
      const res = await generateShareTokenAction(r.id);
      if (!res.success || !res.data) {
        toast.error(res.message ?? "No se pudo generar el link.");
        return;
      }
      // Server builds the URL using NEXT_PUBLIC_APP_URL — don't fall back
      // to window.location.origin (would leak the current host into the
      // copied / emailed link).
      const url = res.data.shareUrl;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado al portapapeles.");
      } catch {
        toast.success("Link generado: " + url);
      }
    });
  }

  function handleDownloadPdf(r: RutinaWithCount) {
    // Opening the route in a new tab is enough — the server sets
    // `Content-Disposition: attachment` so the browser saves the file.
    window.open(`${ROUTES.rutinas}/${r.id}/pdf`, "_blank", "noopener");
  }

  function handleRevoke(r: RutinaWithCount) {
    startTransition(async () => {
      const res = await revokeShareTokenAction(r.id);
      if (!res.success) {
        toast.error(res.message ?? "No se pudo revocar.");
        return;
      }
      toast.success(res.message ?? "Link revocado.");
      router.refresh();
    });
  }

  const columns = useMemo<ColumnDef<RutinaWithCount, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Rutina",
        cell: ({ row }) => <RutinaNameCell rutina={row.original} />,
      },
      {
        id: "momento",
        header: "Momento",
        cell: ({ row }) => <MomentoCell rutina={row.original} />,
      },
      {
        id: "steps",
        header: "Pasos",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.stepCount}
          </span>
        ),
      },
      {
        id: "skin",
        header: "Piel",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.skin_type ? `Piel ${row.original.skin_type}` : "—"}
          </span>
        ),
      },
      {
        id: "tags",
        header: "Etiquetas",
        cell: ({ row }) => <TagsCell tags={row.original.tags} />,
      },
      {
        id: "updated",
        header: "Actualizada",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {DATE_FORMAT.format(new Date(row.original.updated_at))}
          </span>
        ),
      },
    ],
    [],
  );

  const rowActions = useMemo<RowAction<RutinaWithCount>[]>(
    () => {
      const base: RowAction<RutinaWithCount>[] = [
        { id: "edit", label: "Editar", icon: PencilIcon, onClick: handleEdit },
        {
          id: "assign",
          label: "Asignar a clienta",
          icon: SendIcon,
          onClick: (r) => setAssignTarget(r.id),
        },
        {
          id: "duplicate",
          label: "Duplicar",
          icon: CopyIcon,
          onClick: handleDuplicate,
        },
        {
          id: "pdf",
          label: "Descargar PDF",
          icon: DownloadIcon,
          onClick: handleDownloadPdf,
        },
      ];
      if (canShare) {
        base.push({
          id: "share",
          label: "Generar link",
          icon: Link2Icon,
          onClick: handleShare,
        });
        base.push({
          id: "share_email",
          label: "Compartir por email",
          icon: MailIcon,
          onClick: (r) => setEmailTarget(r),
        });
        // Revoke is always in the menu when share-rights are on; we
        // detect at click-time whether there's a live token (the row
        // action API doesn't support per-row visibility right now).
        base.push({
          id: "share_revoke",
          label: "Revocar link",
          icon: Link2OffIcon,
          onClick: (r) => {
            if (!r.share_token) {
              toast.info("Esta rutina no tiene un link activo.");
              return;
            }
            handleRevoke(r);
          },
        });
      }
      base.push({
        id: "delete",
        label: "Eliminar",
        icon: Trash2Icon,
        variant: "destructive",
        onClick: handleArchive,
      });
      return base;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canShare],
  );

  return (
    <>
      <DataTable<RutinaWithCount>
        mode="server"
        data={items}
        totalItems={totalItems}
        columns={columns}
        rowActions={rowActions}
        getRowId={(r) => r.id}
        onRowClick={(r) => handleEdit(r)}
        toolbar={false}
        searchable={false}
        sortable={false}
        showPagination={false}
        emptyTitle="Sin rutinas"
        emptyDescription="Creá tu primera plantilla para empezar."
        emptyIcon={RouteIcon}
      />
      <AssignRutinaDialog
        open={Boolean(assignTarget)}
        onOpenChange={(o) => {
          if (!o) setAssignTarget(null);
        }}
        clientes={clientes}
        onSubmit={(cid, msg) =>
          assignRutinaToClienteAction(assignTarget!, cid, msg)
        }
      />

      {canShare && emailTarget ? (
        <ShareEmailDialog
          open={Boolean(emailTarget)}
          onOpenChange={(o) => {
            if (!o) setEmailTarget(null);
          }}
          rutinaId={emailTarget.id}
          rutinaName={emailTarget.name}
        />
      ) : null}

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar rutina?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <strong>{deleting?.name}</strong> de la
              biblioteca. Las asignaciones a clientas mantienen su copia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmArchive}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Cells ──────────────────────────────────────────────────────────────────

function RutinaNameCell({ rutina }: { rutina: RutinaWithCount }) {
  return (
    <Link
      href={`${ROUTES.rutinas}/${rutina.id}/editar`}
      className="flex items-center gap-3"
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-foreground/60",
          gradientForRutina(rutina.name),
        )}
      >
        <RouteIcon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{rutina.name}</p>
          {rutina.share_token ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[#E7ECEA] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#4F605C]"
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
        </div>
        {rutina.main_objective ? (
          <p className="truncate text-xs text-muted-foreground">
            {rutina.main_objective}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function MomentoCell({ rutina }: { rutina: RutinaWithCount }) {
  const momento = rutina.momento as RutinaMomento;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        momento === "am"
          ? "bg-[#FBF0E0] text-[#7C5E1F]"
          : momento === "pm"
            ? "bg-[#F0ECFB] text-[#6B4FA0]"
            : "bg-[#E7ECEA] text-[#4F605C]",
      )}
    >
      {momento === "am" ? (
        <SunIcon className="size-3" />
      ) : momento === "pm" ? (
        <MoonIcon className="size-3" />
      ) : (
        <>
          <SunIcon className="size-3" />
          <MoonIcon className="size-3" />
        </>
      )}
      {RUTINA_MOMENTO_SHORT[momento]}
    </span>
  );
}

function TagsCell({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0)
    return <span className="text-muted-foreground/70">—</span>;
  const visible = tags.slice(0, 2);
  const rest = tags.length - visible.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((t) => (
        <span
          key={t}
          className="rounded-full border border-[#5C6E6C]/30 bg-[#E7ECEA] px-2 py-0.5 text-[10.5px] font-medium text-[#4F605C]"
        >
          {RUTINA_TAG_LABELS[t as RutinaTag] ?? t}
        </span>
      ))}
      {rest > 0 ? (
        <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}
