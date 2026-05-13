import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import {
  AlertTriangleIcon,
  CopyIcon,
  LockKeyholeIcon,
  MoonIcon,
  RouteIcon,
  SunIcon,
} from "lucide-react";

import { analyzeShareImport } from "@/actions/rutinas.actions";
import { ShareImportButton } from "@/components/rutinas/share-import-button";
import { Button } from "@/components/ui/button";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  PRODUCTO_ABSORPTION_LABELS,
  PRODUCTO_ABSORPTION_TIMES,
  productoActionLabel,
} from "@/schemas/productos.schema";
import {
  dbEnumToForm,
  RUTINA_MOMENTO_LABELS,
  type RutinaMomento,
} from "@/schemas/rutinas.schema";
import { getCurrentSession } from "@/lib/supabase/server";
import {
  getRutinaByShareToken,
  type RutinaWithSteps,
} from "@/services/rutinas.service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const rutina = await getRutinaByShareToken(token).catch(() => null);
  if (!rutina) return { title: "Rutina compartida" };
  return { title: `${rutina.name} · Rutina compartida` };
}

/**
 * Viewer for a shared routine template.
 *
 * Audience gate (top to bottom):
 *  1. Middleware — must be logged in.
 *  2. Staff layout — bounces clientas and hard-gated subscriptions.
 *  3. This page — restricts to `profesional` / `super_admin` (asistentes
 *     can't import shared templates yet) AND requires the tenant to be
 *     on `active` or `trialing` — the "active membership" gate the user
 *     asked for.
 *
 * Resolver uses the admin client because the shared rutina lives in a
 * different tenant from the viewer; staff RLS would block the lookup
 * otherwise. The producto projection is the same clinical-stripped one
 * `getRutinaWithSteps` uses, so clinical notes can't leak.
 */
export default async function SharedRutinaPage({ params }: PageProps) {
  const { token } = await params;

  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);

  // Asistentes (and clientas — already bounced by the staff layout) can't
  // open shared templates. Profesionales-only is the policy.
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "super_admin"
  ) {
    redirect(dashboardForRole(session.profile.role));
  }

  // "Membresía activa" gate — only paying / trialing accounts can consume
  // shared rutinas. super_admin bypasses (no tenant). All other unhealthy
  // states render the locked screen below so the user knows WHY they
  // can't see the rutina (vs. a generic 404).
  if (session.profile.role !== "super_admin") {
    const status = session.tenant?.subscription_status ?? null;
    const isActive = status === "active" || status === "trialing";
    if (!isActive) {
      return <MembershipLocked />;
    }
  }

  // Two independent lookups — fetch the rutina + the import diff in
  // parallel. analyzeShareImport reads the source via admin client and
  // the receiver's catalog via the user-bound client, so it doesn't
  // share work with getRutinaByShareToken.
  const [rutina, analysisRes] = await Promise.all([
    getRutinaByShareToken(token),
    analyzeShareImport(token),
  ]);

  if (!rutina) {
    // Invalid / revoked / expired token. Render a tailored screen
    // instead of the generic Next 404 — the user shouldn't think the
    // app itself is broken.
    return <InvalidShareLink />;
  }

  const analysis = analysisRes.success ? analysisRes.data : null;

  const momento = rutina.momento as RutinaMomento;
  const showAm = momento === "am" || momento === "both";
  const showPm = momento === "pm" || momento === "both";

  return (
    <div className="mx-auto grid max-w-5xl gap-6 py-4">
      <header className="grid gap-3">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#F0ECFB] px-2.5 py-1 text-[11px] font-medium text-[#6B4FA0]">
          <RouteIcon className="size-3" />
          Plantilla compartida
        </span>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
              {rutina.name}
            </h1>
            {rutina.main_objective ? (
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {rutina.main_objective}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7ECEA] px-3 py-1 text-[11.5px] font-semibold text-[#4F605C]">
              {showAm ? <SunIcon className="size-3" /> : null}
              {showPm ? <MoonIcon className="size-3" /> : null}
              {RUTINA_MOMENTO_LABELS[momento]}
            </span>
            {rutina.skin_type ? (
              <span className="rounded-full border bg-card px-3 py-1 text-[11.5px] font-medium text-muted-foreground">
                Piel {rutina.skin_type}
              </span>
            ) : null}
            <span className="rounded-full border bg-card px-3 py-1 text-[11.5px] font-medium tabular-nums text-muted-foreground">
              {rutina.steps.length}{" "}
              {rutina.steps.length === 1 ? "paso" : "pasos"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {analysis ? (
            <ShareImportButton token={token} analysis={analysis} />
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            render={
              // Use the share-scoped PDF route — `/rutinas/<id>/pdf`
              // would 404 for visitors from a different tenant because it
              // reads via the RLS-scoped client.
              <Link
                href={`${ROUTES.rutinas}/share/${token}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <CopyIcon className="size-3.5" />
            Descargar PDF
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Sin datos de clienta
          </span>
        </div>
      </header>

      {showAm ? (
        <MomentoBlock rutina={rutina} momento="am" />
      ) : null}
      {showPm ? (
        <MomentoBlock rutina={rutina} momento="pm" />
      ) : null}

      {rutina.general_notes?.trim() ? (
        <section className="rounded-xl border bg-[#E7ECEA]/60 p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#4F605C]">
            Notas generales
          </h3>
          <p className="mt-1 text-sm text-foreground/90">
            {rutina.general_notes}
          </p>
        </section>
      ) : null}

      <footer className="border-t pt-4 text-center text-xs text-muted-foreground">
        Compartido vía SkinDesk · La rutina original no se modifica al
        verla aquí.
      </footer>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function InvalidShareLink() {
  return (
    <div className="mx-auto grid max-w-md place-items-center gap-4 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-[#F8EFD7] text-[#C47A2B]">
        <AlertTriangleIcon className="size-6" />
      </span>
      <div className="grid gap-1">
        <h1 className="font-heading text-xl font-medium">
          Este link no es válido
        </h1>
        <p className="text-sm text-muted-foreground">
          La rutina puede haber sido eliminada, su link de compartir fue
          revocado, o expiró. Pedile a la profesional que te comparta uno
          nuevo.
        </p>
      </div>
      <Button render={<Link href={ROUTES.rutinas} />}>
        Ir a mi biblioteca
      </Button>
    </div>
  );
}

function MembershipLocked() {
  return (
    <div className="mx-auto grid max-w-md place-items-center gap-4 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-[#FBEFE7] text-[#BB7154]">
        <LockKeyholeIcon className="size-6" />
      </span>
      <div className="grid gap-1">
        <h1 className="font-heading text-xl font-medium">
          Necesitas una membresía activa
        </h1>
        <p className="text-sm text-muted-foreground">
          Las rutinas compartidas entre profesionales requieren una
          suscripción al día. Activa o renová tu plan para acceder a esta
          plantilla.
        </p>
      </div>
      <Button render={<Link href={ROUTES.settings} />}>
        Ir a configuración
      </Button>
    </div>
  );
}

function MomentoBlock({
  rutina,
  momento,
}: {
  rutina: RutinaWithSteps;
  momento: "am" | "pm";
}) {
  const steps = stepsForMomento(rutina, momento);
  if (steps.length === 0) return null;
  const isAm = momento === "am";
  return (
    <section
      className={cn(
        "rounded-xl p-4",
        isAm ? "bg-[#FDF6E7]" : "bg-[#F4F0FB]",
      )}
    >
      <header className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full",
            isAm ? "bg-[#FBE6B5] text-[#C47A2B]" : "bg-[#DCD0F1] text-[#6B4FA0]",
          )}
        >
          {isAm ? (
            <SunIcon className="size-4" />
          ) : (
            <MoonIcon className="size-4" />
          )}
        </span>
        <div>
          <h2
            className={cn(
              "font-heading text-lg font-medium tracking-wide",
              isAm ? "text-[#7C5E1F]" : "text-[#5B3F92]",
            )}
          >
            Rutina {isAm ? "AM" : "PM"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isAm
              ? "Empieza tu día cuidando tu piel"
              : "El momento perfecto para regenerar tu piel"}
          </p>
        </div>
      </header>

      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, idx) => (
          <StepCard
            key={step.id}
            step={step}
            index={idx}
            momento={momento}
          />
        ))}
      </ol>
    </section>
  );
}

type StepWithProducto = RutinaWithSteps["steps"][number];

function stepsForMomento(
  rutina: RutinaWithSteps,
  momento: "am" | "pm",
): StepWithProducto[] {
  if (rutina.momento === "am" && momento === "pm") return [];
  if (rutina.momento === "pm" && momento === "am") return [];
  return rutina.steps.filter((s) => {
    const tod = s.custom_time_of_day;
    if (!tod) return true;
    if (tod === "both") return true;
    return tod === momento;
  });
}

function StepCard({
  step,
  index,
  momento,
}: {
  step: StepWithProducto;
  index: number;
  momento: "am" | "pm";
}) {
  const isAm = momento === "am";
  const absorption =
    dbEnumToForm(step.custom_absorption_time, PRODUCTO_ABSORPTION_TIMES) ||
    dbEnumToForm(
      step.producto.absorption_time,
      PRODUCTO_ABSORPTION_TIMES,
    ) ||
    "sin_espera";
  const description =
    step.custom_instruction?.trim() ||
    step.producto.application_instruction?.trim() ||
    "";

  return (
    <li className="flex gap-3 rounded-lg border bg-card p-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-[#F4F1EC]">
        {step.producto.photoUrl ? (
          <Image
            src={step.producto.photoUrl}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-[10px] text-muted-foreground">
            Producto
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white",
              isAm ? "bg-[#C47A2B]" : "bg-[#6B4FA0]",
            )}
          >
            {index + 1}
          </span>
          <span className="text-xs italic text-muted-foreground">
            Paso {index + 1}
          </span>
        </div>
        <p
          className={cn(
            "mt-1 font-heading text-sm font-bold tracking-wide",
            isAm ? "text-[#7C5E1F]" : "text-[#5B3F92]",
          )}
        >
          {productoActionLabel(step.producto.category)}
        </p>
        <p className="mt-0.5 truncate text-xs font-semibold uppercase tracking-tight">
          {step.producto.name}
        </p>
        {step.producto.brand &&
        step.producto.brand.trim().toUpperCase() !==
          step.producto.name.trim().toUpperCase() ? (
          <p className="truncate text-[10.5px] text-muted-foreground">
            {step.producto.brand}
          </p>
        ) : null}
        {description ? (
          <p className="mt-1.5 line-clamp-3 text-[11.5px] text-foreground/80">
            {description}
          </p>
        ) : null}
        <p className="mt-1.5 text-[10.5px] text-muted-foreground">
          ⏱ {PRODUCTO_ABSORPTION_LABELS[absorption] ?? "—"}
        </p>
      </div>
    </li>
  );
}
