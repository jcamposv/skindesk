import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PackageIcon, SparklesIcon } from "lucide-react";

import { ProductosAddButton } from "@/components/productos/productos-add-button";
import { ProductosPageClient } from "@/components/productos/productos-page-client";
import { ProductosPagination } from "@/components/productos/productos-pagination";
import { ProductosStatsStrip } from "@/components/productos/productos-stats";
import { ProductosToolbar } from "@/components/productos/productos-toolbar";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";
import {
  PRODUCTO_CATEGORIAS,
  PRODUCTO_SKIN_TYPES,
  PRODUCTO_SORTS,
  PRODUCTO_TAGS,
  type ProductoCategoria,
  type ProductoSkinType,
  type ProductoSort,
  type ProductoTag,
} from "@/schemas/productos.schema";
import {
  getProductosStats,
  listProductos,
} from "@/services/productos.service";

export const metadata: Metadata = { title: "Catálogo de productos" };
export const dynamic = "force-dynamic";

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

export default async function ProductosPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    redirect(dashboardForRole(session.profile.role));
  }

  // super_admin doesn't have a tenant — kick to the panel rather than render
  // an empty catalog page that confuses them.
  if (session.profile.role === "super_admin" || !session.profile.tenant_id) {
    redirect(ROUTES.superAdmin);
  }

  const sp = await searchParams;
  const page = asNumber(sp.page, 1);
  const pageSize = asNumber(sp.pageSize, 24);
  const search = asString(sp.search);
  const category = asEnum<ProductoCategoria>(
    sp.filter_category,
    PRODUCTO_CATEGORIAS,
  );
  const skinType = asEnum<ProductoSkinType>(
    sp.filter_skin_type,
    PRODUCTO_SKIN_TYPES,
  );
  const tag = asEnum<ProductoTag>(sp.filter_tag, PRODUCTO_TAGS);
  const sort = asEnum<ProductoSort>(sp.sort, PRODUCTO_SORTS) ?? "recent";
  const view: "grid" | "list" = sp.view === "list" ? "list" : "grid";

  const canEdit =
    session.profile.role === "profesional" ||
    (session.profile.role === "asistente" &&
      ((session.profile.permissions ?? {}) as Record<string, string | null>)
        .catalogo === "edit");

  const [{ items, totalItems }, stats] = await Promise.all([
    listProductos({
      page,
      pageSize,
      search,
      category,
      skinType,
      tag,
      sort,
    }),
    getProductosStats(),
  ]);

  const filtered =
    Boolean(search) ||
    Boolean(category) ||
    Boolean(skinType) ||
    Boolean(tag);

  const firstName =
    (session.profile.full_name ?? "").split(" ")[0] || "tu equipo";

  return (
    <div className="grid gap-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F8EFD7] px-2.5 py-1 text-[11px] font-medium text-[#7C5E1F]">
            <PackageIcon className="size-3" />
            Tu catálogo
          </span>
          <h1 className="font-heading mt-3 text-2xl font-medium tracking-tight sm:text-3xl">
            Catálogo de productos
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Tu repositorio personal de productos para crear rutinas, {firstName}.
          </p>
        </div>
        {canEdit ? (
          <ProductosAddButton tenantId={session.profile.tenant_id} />
        ) : null}
      </header>

      <ProductosStatsStrip stats={stats} />

      <ProductosToolbar view={view} />

      {/* Filtered-empty state: differs from never-had-products (handled
          inside ProductosPageClient). Surface the "no results" message
          here so the user can tell the difference. */}
      {filtered && items.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
          <SparklesIcon className="size-8 text-muted-foreground" />
          <p className="mt-3 font-heading text-base">Sin resultados</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Probá con otros filtros o limpiá la búsqueda para ver el catálogo
            completo.
          </p>
        </div>
      ) : (
        <ProductosPageClient
          tenantId={session.profile.tenant_id}
          items={items}
          totalItems={totalItems}
          canEdit={canEdit}
          view={view}
        />
      )}

      {/* Pagination — reuses the shared DataTablePagination component. URL-
          synced so server-side pagination + browser back/forward keep state.
          Hidden when everything fits on one page. */}
      {totalItems > pageSize ? (
        <ProductosPagination
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

