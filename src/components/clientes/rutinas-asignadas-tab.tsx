"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  DownloadIcon,
  ListPlusIcon,
  MoonIcon,
  PencilIcon,
  PlusIcon,
  SunIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTransition } from "react";

import {
  archiveRutinaAction,
  assignRutinaToClienteAction,
} from "@/actions/rutinas.actions";
import { AssignRutinaDialog } from "@/components/rutinas/assign-rutina-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  gradientForRutina,
  RUTINA_MOMENTO_SHORT,
  type RutinaMomento,
} from "@/schemas/rutinas.schema";
import type { Database } from "@/types/database.types";

type RutinaRow = Database["public"]["Tables"]["rutinas"]["Row"];

interface RutinasAsignadasTabProps {
  clienteId: string;
  clientName: string;
  rutinas: Array<RutinaRow & { stepCount: number }>;
  /** Library templates the profesional can assign. */
  libraryTemplates: Array<RutinaRow & { stepCount: number }>;
}

/**
 * Cliente detail tab — shows routines assigned to this specific clienta.
 * Two CTAs:
 *   · "Asignar desde biblioteca" → opens AssignRutinaDialog with the
 *     clienta preselected; picker lists library templates.
 *   · "Nueva rutina" → navigates to the builder with the cliente
 *     pre-selected (`?cliente=<id>`).
 */
export function RutinasAsignadasTab({
  clienteId,
  clientName,
  rutinas,
  libraryTemplates,
}: RutinasAsignadasTabProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assignTemplateId, setAssignTemplateId] = useState<string | null>(null);

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0ECFB] px-2.5 py-1 text-[11px] font-medium text-[#6B4FA0]">
            <WandSparklesIcon className="size-3" />
            Rutinas
          </span>
          <h2 className="mt-2 font-heading text-xl font-medium">
            Rutinas asignadas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Las copias asignadas a {clientName} evolucionan independientemente
            de las plantillas de la biblioteca.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setPickerOpen(true)}
            disabled={libraryTemplates.length === 0}
          >
            <ListPlusIcon className="size-4" />
            Asignar desde biblioteca
          </Button>
          <Button
            variant="cta"
            size="sm"
            className="gap-1.5"
            render={
              <Link
                href={`${ROUTES.rutinas}/nueva?cliente=${clienteId}`}
              />
            }
          >
            <PlusIcon className="size-4" />
            Crear nueva rutina
          </Button>
        </div>
      </header>

      {rutinas.length === 0 ? (
        <Card className="grid place-items-center gap-3 p-10 text-center">
          <WandSparklesIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="font-heading text-base">Sin rutinas asignadas</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Asigná una plantilla desde tu biblioteca o construí una desde
              cero. Cada rutina es una copia que la clienta verá en su portal.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rutinas.map((r) => (
            <AssignedRutinaCard
              key={r.id}
              rutina={r}
              clienteId={clienteId}
            />
          ))}
        </div>
      )}

      {/* Library picker — list of templates with one-click assign. */}
      <LibraryPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        templates={libraryTemplates}
        onPick={(templateId) => {
          setPickerOpen(false);
          setAssignTemplateId(templateId);
        }}
      />

      {/* Final assign dialog — preselected clienta. */}
      <AssignRutinaDialog
        open={Boolean(assignTemplateId)}
        onOpenChange={(o) => {
          if (!o) setAssignTemplateId(null);
        }}
        preselectedClienteId={clienteId}
        preselectedClienteName={clientName}
        clientes={[]}
        onSubmit={(cid, msg) =>
          assignRutinaToClienteAction(assignTemplateId!, cid, msg)
        }
      />
    </div>
  );
}

// ─── Assigned card ──────────────────────────────────────────────────────────

interface AssignedRutinaCardProps {
  rutina: RutinaRow & { stepCount: number };
  clienteId: string;
}

function AssignedRutinaCard({ rutina, clienteId }: AssignedRutinaCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const gradient = gradientForRutina(rutina.name);
  const momento = rutina.momento as RutinaMomento;
  const editHref = `${ROUTES.rutinas}/${rutina.id}/editar`;

  function handleDelete() {
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

  return (
    <Card
      className={cn(
        "relative overflow-hidden bg-gradient-to-br p-0 transition-all hover:shadow-md",
        gradient,
      )}
    >
      <Link href={editHref} className="block p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10.5px] font-semibold text-foreground/80 backdrop-blur">
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
          <span className="text-[10.5px] font-medium text-foreground/60">
            asignada el{" "}
            {new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(
              new Date(rutina.created_at),
            )}
          </span>
        </div>

        <h3 className="mt-3 font-heading text-base font-medium text-foreground/90">
          {rutina.name}
        </h3>

        {rutina.main_objective ? (
          <p className="mt-1 line-clamp-2 text-xs text-foreground/70">
            {rutina.main_objective}
          </p>
        ) : null}

        <p className="mt-3 text-[11px] font-medium tabular-nums text-foreground/70">
          {rutina.stepCount} {rutina.stepCount === 1 ? "paso" : "pasos"}
        </p>
      </Link>

      <footer className="flex items-center justify-between border-t border-white/30 bg-white/30 px-4 py-2 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-foreground/80 hover:bg-white/40"
          render={<Link href={editHref} />}
        >
          <PencilIcon className="size-3.5" />
          Editar
          <ArrowRightIcon className="size-3" />
        </Button>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-foreground/60 hover:bg-white/40"
            aria-label="Descargar PDF"
            render={
              <a
                href={`${ROUTES.rutinas}/${rutina.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <DownloadIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => setConfirmDelete(true)}
            className="text-foreground/60 hover:bg-white/40 hover:text-destructive"
            aria-label="Eliminar rutina"
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      </footer>

      {confirmDelete ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/95 p-4 text-center backdrop-blur">
          <p className="text-sm font-medium">¿Eliminar esta rutina?</p>
          <p className="text-xs text-muted-foreground">
            La plantilla original en la biblioteca queda intacta.
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
              onClick={handleDelete}
              disabled={pending}
            >
              Eliminar
            </Button>
          </div>
        </div>
      ) : null}
      {/* clienteId reserved for future "duplicate to another cliente" action. */}
      <span hidden data-cliente-id={clienteId} />
    </Card>
  );
}

// ─── Library picker dialog ──────────────────────────────────────────────────

interface LibraryPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Array<RutinaRow & { stepCount: number }>;
  onPick: (templateId: string) => void;
}

function LibraryPickerDialog({
  open,
  onOpenChange,
  templates,
  onPick,
}: LibraryPickerDialogProps) {
  // Reusing the dialog primitive directly here keeps this tab a single file —
  // the AssignRutinaDialog also lives outside and handles the final step.
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl bg-card shadow-xl">
        <header className="border-b px-5 py-4">
          <h3 className="font-heading text-lg font-medium">
            Elegí una plantilla
          </h3>
          <p className="text-xs text-muted-foreground">
            Asignamos una copia personalizable. La plantilla original no se
            toca.
          </p>
        </header>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {templates.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Todavía no hay plantillas en tu biblioteca.
            </p>
          ) : (
            <ul className="grid gap-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onPick(t.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all",
                      "hover:border-[#5C6E6C]/40 hover:shadow-sm",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-foreground/70",
                        gradientForRutina(t.name),
                      )}
                    >
                      <WandSparklesIcon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {t.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t.stepCount} {t.stepCount === 1 ? "paso" : "pasos"} ·{" "}
                        {RUTINA_MOMENTO_SHORT[t.momento as RutinaMomento]}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="flex justify-end border-t px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </footer>
      </div>
    </div>
  );
}
