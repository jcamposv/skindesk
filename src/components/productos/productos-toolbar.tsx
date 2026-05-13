"use client";

import { UrlSearchBox } from "@/components/url-state/url-search-box";
import { UrlSelectFilter } from "@/components/url-state/url-select-filter";
import {
  UrlViewToggle,
  type ViewMode,
} from "@/components/url-state/url-view-toggle";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  PRODUCTO_CATEGORIA_LABELS,
  PRODUCTO_CATEGORIAS,
  PRODUCTO_SKIN_TYPE_LABELS,
  PRODUCTO_SKIN_TYPES,
  PRODUCTO_SORT_LABELS,
  PRODUCTO_SORTS,
  PRODUCTO_TAG_LABELS,
  PRODUCTO_TAGS,
} from "@/schemas/productos.schema";

export type ProductosView = ViewMode;

interface ProductosToolbarProps {
  view: ProductosView;
}

/**
 * Catalog toolbar: search, filters, sort, view toggle. All state lives in
 * the URL via `useUrlFilters` so it survives navigation and the server
 * page re-fetches on every change. Same primitives as the rutinas
 * toolbar — divergence would create two ways to filter a list page.
 */
export function ProductosToolbar({ view }: ProductosToolbarProps) {
  const { searchDraft, setSearchDraft, update, getParam, pending } =
    useUrlFilters();

  return (
    <section
      aria-label="Filtros y vista"
      className="grid gap-3 rounded-xl border bg-card p-3"
      data-pending={pending ? "" : undefined}
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <UrlSearchBox
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder="Buscar por nombre, marca o ingrediente…"
        />
        <UrlViewToggle
          view={view}
          onChange={(v) => update({ view: v === "grid" ? null : v })}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <UrlSelectFilter
          label="Categoría"
          value={getParam("filter_category")}
          onChange={(v) => update({ filter_category: v })}
          options={PRODUCTO_CATEGORIAS.map((c) => ({
            value: c,
            label: PRODUCTO_CATEGORIA_LABELS[c],
          }))}
        />
        <UrlSelectFilter
          label="Tipo de piel"
          value={getParam("filter_skin_type")}
          onChange={(v) => update({ filter_skin_type: v })}
          options={PRODUCTO_SKIN_TYPES.map((s) => ({
            value: s,
            label: PRODUCTO_SKIN_TYPE_LABELS[s],
          }))}
        />
        <UrlSelectFilter
          label="Etiqueta"
          value={getParam("filter_tag")}
          onChange={(v) => update({ filter_tag: v })}
          options={PRODUCTO_TAGS.map((t) => ({
            value: t,
            label: PRODUCTO_TAG_LABELS[t],
          }))}
        />
        <UrlSelectFilter
          label="Orden"
          value={getParam("sort", "recent")}
          allowClear={false}
          onChange={(v) => update({ sort: v || "recent" })}
          options={PRODUCTO_SORTS.map((s) => ({
            value: s,
            label: PRODUCTO_SORT_LABELS[s],
          }))}
        />
      </div>
    </section>
  );
}
