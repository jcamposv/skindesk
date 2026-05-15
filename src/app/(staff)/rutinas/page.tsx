import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RouteIcon, SparklesIcon } from "lucide-react";

import { LibraryGrid } from "@/components/rutinas/library-grid";
import { LibraryListTable } from "@/components/rutinas/library-list-table";
import { LibraryPagination } from "@/components/rutinas/library-pagination";
import { LibraryToolbar } from "@/components/rutinas/library-toolbar";
import { StatStrip, type StatStripItem } from "@/components/shared/stat-strip";
import { Button } from "@/components/ui/button";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";
import {
  PRODUCTO_SKIN_TYPES,
  type ProductoSkinType,
} from "@/schemas/productos.schema";
import {
  RUTINA_MOMENTOS,
  type RutinaMomento,
} from "@/schemas/rutinas.schema";
import { getClientesForPicker } from "@/services/clientes.service";
import {
  getLibraryStats,
  listLibraryRutinas,
} from "@/services/rutinas.service";

export const metadata: Metadata = { title: "Biblioteca de rutinas" };
interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v.trim() ? v.trim() : undefined;
}

function asNumber(
  raw: string | string[] | undefined,
  fallback: number,
): number {
  const v = asString(raw);
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function asEnum<T extends string>(
  raw: string | string[] | undefined,
  allowed: readonly T[],
): T | undefined {
  const v = asString(raw);
  if (!v) return undefined;
  return (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

export default async function RutinasLibraryPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    redirect(dashboardForRole(session.profile.role));
  }
  if (session.profile.role === "super_admin" || !session.profile.tenant_id) {
    redirect(ROUTES.superAdmin);
  }

  const sp = await searchParams;
  const page = asNumber(sp.page, 1);
  const pageSize = asNumber(sp.pageSize, 24);
  const search = asString(sp.search);
  const momento = asEnum<RutinaMomento>(sp.filter_momento, RUTINA_MOMENTOS);
  const tag = asString(sp.filter_tag);
  const skinType = asEnum<ProductoSkinType>(sp.filter_skin, PRODUCTO_SKIN_TYPES);
  const view: "grid" | "list" = sp.view === "list" ? "list" : "grid";

  const [{ items, totalItems }, stats, clientes] = await Promise.all([
    listLibraryRutinas({ page, pageSize, search, momento, tag, skinType }),
    getLibraryStats(),
    getClientesForPicker(),
  ]);

  const filtered = Boolean(search || momento || tag || skinType);
  const firstName =
    (session.profile.full_name ?? "").split(" ")[0] || "tu equipo";

  // Share / import surface is profesional-only AND requires an active
  // membership. The action also enforces this, but we hide the UI here
  // so users without access never see a CTA they can't use.
  const subStatus = session.tenant?.subscription_status ?? null;
  const canShare =
    session.profile.role === "profesional" &&
    (subStatus === "active" || subStatus === "trialing");

  const statItems: StatStripItem[] = [
    {
      label: "Plantillas totales",
      value: stats.total,
      icon: RouteIcon,
      colorClass: "text-[#5C6E6C] bg-[#E7ECEA]",
    },
    {
      label: "Para la mañana",
      value: stats.am,
      icon: RouteIcon,
      colorClass: "text-[#7C5E1F] bg-[#F8EFD7]",
    },
    {
      label: "Para la noche",
      value: stats.pm,
      icon: RouteIcon,
      colorClass: "text-[#6B4FA0] bg-[#F0ECFB]",
    },
    {
      label: "Día completo",
      value: stats.both,
      icon: RouteIcon,
      colorClass: "text-[#8C4A30] bg-[#F6E0D6]",
    },
  ];

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0ECFB] px-2.5 py-1 text-xs font-medium text-[#6B4FA0]">
            <RouteIcon className="size-3" />
            Biblioteca
          </span>
          <h1 className="font-heading mt-3 text-2xl font-medium tracking-tight sm:text-3xl">
            Rutinas
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Plantillas reutilizables para asignar a tus clientas, {firstName}.
          </p>
        </div>
        <Button
          variant="cta"
          size="lg"
          className="gap-1.5"
          render={<Link href={`${ROUTES.rutinas}/nueva`} />}
        >
          <SparklesIcon className="size-4" />
          Nueva rutina
        </Button>
      </header>

      <StatStrip items={statItems} ariaLabel="Resumen de la biblioteca" />

      <LibraryToolbar view={view} />

      {filtered && items.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
          <SparklesIcon className="size-8 text-muted-foreground" />
          <p className="mt-3 font-heading text-base">Sin resultados</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Prueba con otros filtros o crea una rutina nueva.
          </p>
        </div>
      ) : view === "list" ? (
        <LibraryListTable
          items={items}
          totalItems={totalItems}
          clientes={clientes}
          canShare={canShare}
        />
      ) : (
        <LibraryGrid items={items} clientes={clientes} canShare={canShare} />
      )}

      {/* Pagination — mirrors the productos page. Hidden when results fit
          on a single page so the layout stays calm. */}
      {totalItems > pageSize ? (
        <LibraryPagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
        />
      ) : totalItems > 0 ? (
        <p className="text-xs text-muted-foreground">
          Mostrando {items.length} de {totalItems}
        </p>
      ) : null}
    </div>
  );
}
