"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  CopyIcon,
  PackagePlusIcon,
  PlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  importShareRutinaAction,
  type ShareImportAnalysis,
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
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import {
  PRODUCTO_CATEGORIA_LABELS,
  type ProductoCategoria,
} from "@/schemas/productos.schema";

interface ShareImportButtonProps {
  token: string;
  analysis: ShareImportAnalysis;
}

/**
 * "Importar a mi biblioteca" CTA on the share viewer. The analysis comes
 * from the server (`analyzeShareImport`) so we can render the diff
 * inline — no extra round-trip on click. The receiver picks between:
 *
 *  · "Importar solo los pasos con productos existentes" — silently skips
 *    every step pointing at a producto we don't have.
 *  · "Importar rutina + productos faltantes" — clones the missing
 *    productos into the receiver's catalog so every step survives.
 */
export function ShareImportButton({
  token,
  analysis,
}: ShareImportButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Already in this tenant — show a friendly link to open it instead.
  if (analysis.alreadyOwned) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        render={<Link href={ROUTES.rutinas} />}
      >
        <CheckIcon className="size-3.5" />
        Ya está en tu biblioteca
      </Button>
    );
  }

  const missing = analysis.missingProductos;
  const hasMissing = missing.length > 0;
  const importableSteps = analysis.existingCount;

  function runImport(includeMissing: boolean) {
    startTransition(async () => {
      const res = await importShareRutinaAction(token, { includeMissing });
      if (!res.success || !res.data) {
        toast.error(res.message ?? "No se pudo importar la rutina.");
        return;
      }
      toast.success(res.message ?? "Rutina importada.");
      setOpen(false);
      router.push(`${ROUTES.rutinas}/${res.data.rutinaId}/editar`);
    });
  }

  return (
    <>
      <Button
        variant="cta"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="size-3.5" />
        Importar a mi biblioteca
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Importar rutina</AlertDialogTitle>
            <AlertDialogDescription>
              Vamos a copiar <strong>{analysis.rutinaName}</strong> a tu
              biblioteca como una plantilla nueva. La original queda
              intacta y no se actualiza si el autor la cambia.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-3 py-2 text-sm">
            <div className="flex items-center gap-2 rounded-md bg-[#E7ECEA]/60 px-3 py-2 text-[#4F605C]">
              <CheckIcon className="size-4" />
              <span>
                <strong>{importableSteps}</strong> de{" "}
                <strong>{analysis.totalSteps}</strong> pasos usan productos
                que ya tienes en tu catálogo.
              </span>
            </div>

            {hasMissing ? (
              <div className="grid gap-2 rounded-md border bg-[#FBEFE7]/40 p-3">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-foreground text-[#8C4A30]">
                  <PackagePlusIcon className="size-4" />
                  Te faltan {missing.length}{" "}
                  {missing.length === 1 ? "producto" : "productos"} para
                  los demás pasos:
                </p>
                <ul className="grid max-h-32 gap-1 overflow-y-auto pl-1 text-sm text-foreground/80">
                  {missing.map((p) => (
                    <li key={p.sourceId} className="flex items-baseline gap-1.5">
                      <span className="text-muted-foreground">·</span>
                      <span className="font-medium">{p.name}</span>
                      {p.brand ? (
                        <span className="text-muted-foreground">
                          — {p.brand}
                        </span>
                      ) : null}
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {PRODUCTO_CATEGORIA_LABELS[
                          p.category as ProductoCategoria
                        ] ?? p.category}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs font-medium text-foreground/75">
                  Las fotos y las notas clínicas no se copian — son
                  específicas de cada profesional. Vas a poder subir tus
                  fotos y completar las notas después en tu catálogo.
                </p>
              </div>
            ) : null}
          </div>

          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            {hasMissing && importableSteps > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => runImport(false)}
              >
                Solo importar pasos que ya puedo
              </Button>
            ) : null}
            <AlertDialogAction
              disabled={pending || (importableSteps === 0 && !hasMissing)}
              // AlertDialogAction in this app is a plain Button (no
              // built-in close primitive) — it stays open until we call
              // setOpen(false) inside runImport's success branch.
              onClick={() => runImport(hasMissing)}
              className="gap-1.5"
            >
              <CopyIcon className="size-3.5" />
              {pending
                ? "Importando…"
                : hasMissing
                  ? `Importar rutina + ${missing.length} ${
                      missing.length === 1 ? "producto" : "productos"
                    }`
                  : "Importar rutina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
