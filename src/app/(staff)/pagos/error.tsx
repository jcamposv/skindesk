"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangleIcon, RotateCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

/**
 * Per-route boundary so Supabase / PostgREST errors don't blank the page
 * via the global handler. Renders a small banner with a retry button +
 * a way back to the clientes list (which is the other entry to payment
 * info if /pagos itself stays broken).
 */
export default function PagosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the same channel Next.js uses for server errors; in
    // production this gets picked up by Sentry / Vercel observability.
    console.error("[pagos] route error", error);
  }, [error]);

  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="grid max-w-md gap-3 rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div className="grid place-items-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangleIcon className="size-5" />
          </span>
        </div>
        <div className="grid gap-1">
          <h2 className="font-heading text-lg font-medium tracking-tight">
            No pudimos cargar los pagos
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Hubo un problema leyendo el ledger. Intentá de nuevo; si persiste,
            avisanos y mirá la consola para más detalle.
          </p>
        </div>
        {error.digest ? (
          <p className="font-mono text-[10.5px] text-muted-foreground/70">
            digest: {error.digest}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset} className="gap-1.5">
            <RotateCwIcon className="size-3.5" />
            Reintentar
          </Button>
          <Button
            variant="outline"
            render={<Link href={ROUTES.clientes} />}
          >
            Ir a Clientes
          </Button>
        </div>
      </div>
    </div>
  );
}
