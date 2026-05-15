"use client";

import Link from "next/link";
import {
  ChevronRightIcon,
  PencilIcon,
  SendIcon,
  SparklesIcon,
} from "lucide-react";
import useSWR, { mutate as globalMutate } from "swr";

import { getRutinaDetailAction } from "@/actions/rutinas.actions";
import { MomentoChip } from "@/components/rutinas/momento-chip";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/lib/constants";
import {
  RUTINA_MOMENTO_LABELS,
  RUTINA_TAG_LABELS,
  type RutinaMomento,
  type RutinaTag,
} from "@/schemas/rutinas.schema";
import type { RutinaWithSteps } from "@/services/rutinas.service";

interface RutinaDetailSheetProps {
  rutinaId: string | null;
  onOpenChange: (open: boolean) => void;
  onAssign: (rutinaId: string) => void;
}

/** Stable SWR cache key for a single rutina detail. Exported so action
 *  callers (duplicate/archive/share/edit) can call `invalidateRutinaDetail`
 *  below to flush the cache — otherwise reopening the Sheet right after a
 *  mutation shows stale data until the 60s dedupe window expires. */
export function rutinaDetailKey(id: string): [string, string] {
  return ["rutina-detail", id];
}

/** Drop the cached detail for a specific rutina (or all of them if id is
 *  omitted). Call this from a client component after any mutation that
 *  could have changed what the Sheet renders. */
export function invalidateRutinaDetail(id?: string): void {
  if (id) {
    void globalMutate(rutinaDetailKey(id));
  } else {
    void globalMutate(
      (key) => Array.isArray(key) && key[0] === "rutina-detail",
      undefined,
      { revalidate: false },
    );
  }
}

/** Lazy fetcher — runs only when `id` is non-null (SWR returns `undefined`
 *  on a null key). Wraps the server action so its error becomes a thrown
 *  exception SWR can surface via `error`. */
async function fetchRutina(id: string): Promise<RutinaWithSteps> {
  const res = await getRutinaDetailAction(id);
  if (!res.success || !res.data) {
    throw new Error(res.message ?? "No se pudo cargar la rutina.");
  }
  return res.data;
}

/**
 * Sheet shown when the user clicks "Ver" on a library card. Lazy-loads the
 * full routine via SWR so:
 *  - reopening the same routine within the session is instant (cache hit)
 *  - the library list query stays cheap (cards only get a 3-step preview)
 *
 * The Sheet is rendered at the grid level (single instance) and driven by
 * `rutinaId`. When `rutinaId` is null the Sheet is closed; SWR's key is
 * `null` and no fetch runs.
 */
export function RutinaDetailSheet({
  rutinaId,
  onOpenChange,
  onAssign,
}: RutinaDetailSheetProps) {
  const { data, error, isLoading } = useSWR(
    rutinaId ? rutinaDetailKey(rutinaId) : null,
    ([, id]) => fetchRutina(id),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  const open = rutinaId != null;
  const momentoLabel = data
    ? RUTINA_MOMENTO_LABELS[data.momento as RutinaMomento] ?? data.momento
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        aria-busy={isLoading}
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="font-heading text-lg font-semibold">
            {data ? data.name : isLoading ? "Cargando…" : "Detalle de rutina"}
          </SheetTitle>
          {data ? (
            <SheetDescription className="text-sm text-foreground/75">
              {[
                momentoLabel,
                data.skin_type ? `Piel ${data.skin_type}` : null,
                data.skin_condition,
              ]
                .filter(Boolean)
                .join(" · ")}
            </SheetDescription>
          ) : null}
        </SheetHeader>

        <div
          className="flex-1 overflow-y-auto px-5 py-4"
          aria-live="polite"
          aria-busy={isLoading}
        >
          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error instanceof Error
                ? error.message
                : "Error al cargar la rutina."}
            </p>
          ) : isLoading || !data ? (
            <DetailSkeleton />
          ) : (
            <DetailBody data={data} />
          )}
        </div>

        {data ? (
          <SheetFooter className="flex flex-row items-center justify-end gap-2 border-t bg-muted/30 px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              render={
                <Link href={`${ROUTES.rutinas}/${data.id}/editar`} />
              }
            >
              <PencilIcon className="size-3.5" />
              Editar
            </Button>
            <Button
              type="button"
              variant="cta"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                onAssign(data.id);
                onOpenChange(false);
              }}
            >
              <SendIcon className="size-3.5" />
              Asignar
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

// ─── Body ──────────────────────────────────────────────────────────────────

function DetailBody({ data }: { data: RutinaWithSteps }) {
  const momento = data.momento as RutinaMomento;
  return (
    <div className="grid gap-5">
      {data.main_objective ? (
        <section>
          <SectionLabel>Objetivo principal</SectionLabel>
          <p className="mt-1 text-sm leading-relaxed text-foreground/85">
            {data.main_objective}
          </p>
        </section>
      ) : null}

      {data.general_notes ? (
        <section>
          <SectionLabel>Notas generales</SectionLabel>
          <p className="mt-1 text-sm leading-relaxed text-foreground/85">
            {data.general_notes}
          </p>
        </section>
      ) : null}

      {data.tags && data.tags.length > 0 ? (
        <section>
          <SectionLabel>Etiquetas</SectionLabel>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {data.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-[#5C6E6C]/30 bg-[#E7ECEA] px-2.5 py-0.5 text-xs font-semibold text-[#4F605C]"
              >
                {RUTINA_TAG_LABELS[t as RutinaTag] ?? t}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>
            Pasos {data.steps.length > 0 ? `(${data.steps.length})` : null}
          </SectionLabel>
          <MomentoChip momento={momento} variant="solid" longLabel />
        </div>

        {data.steps.length === 0 ? (
          <div className="mt-2 grid place-items-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#F6E0D6] text-[#8C4A30]">
              <SparklesIcon className="size-4" />
            </span>
            <p className="text-sm font-medium text-foreground/75">
              Esta rutina todavía no tiene pasos.
            </p>
          </div>
        ) : (
          <ol className="mt-2 grid gap-2">
            {data.steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </ol>
        )}
      </section>

      {data.client_message ? (
        <section>
          <SectionLabel>Mensaje para la clienta</SectionLabel>
          <p className="mt-1 whitespace-pre-line rounded-lg bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground/85">
            {data.client_message}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function StepRow({
  step,
}: {
  step: RutinaWithSteps["steps"][number];
}) {
  const producto = step.producto;
  const instruction = step.custom_instruction || producto.application_instruction;
  const amount = step.custom_amount || producto.suggested_amount;
  const ingredients = (producto.main_ingredients ?? []).slice(0, 4);

  return (
    <li className="flex gap-3 rounded-xl border border-border/60 bg-card p-3">
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FBEFE7] text-xs font-bold text-[#7A3D24]"
      >
        {step.step_order}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-foreground">
          {producto.name}
        </p>
        {producto.brand ? (
          <p className="truncate text-xs text-foreground/70">
            {producto.brand}
          </p>
        ) : null}
        {ingredients.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {ingredients.map((ing) => (
              <span
                key={ing}
                className="rounded-full border border-[#BB7154]/30 bg-[#FBEFE7] px-2 py-0.5 text-[11px] font-semibold text-[#7A3D24]"
              >
                {ing}
              </span>
            ))}
          </div>
        ) : null}
        {amount ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-foreground/75">
            <ChevronRightIcon className="size-3 shrink-0 text-foreground/50" />
            <span className="font-medium text-foreground/65">Cantidad:</span>{" "}
            {amount}
          </p>
        ) : null}
        {instruction ? (
          <p className="mt-0.5 flex items-start gap-1 text-xs leading-relaxed text-foreground/75">
            <ChevronRightIcon className="mt-0.5 size-3 shrink-0 text-foreground/50" />
            <span>
              <span className="font-medium text-foreground/65">Aplicación:</span>{" "}
              {instruction}
            </span>
          </p>
        ) : null}
        {step.notes ? (
          <p className="mt-1 rounded-md bg-muted/40 px-2 py-1 text-xs leading-relaxed text-foreground/80">
            {step.notes}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wider text-foreground/80">
      {children}
    </p>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
