"use client";

import { UrlSearchBox } from "@/components/url-state/url-search-box";
import { UrlSelectFilter } from "@/components/url-state/url-select-filter";
import {
  UrlViewToggle,
  type ViewMode,
} from "@/components/url-state/url-view-toggle";
import { useUrlFilters } from "@/hooks/use-url-filters";
import {
  PRODUCTO_SKIN_TYPE_LABELS,
  PRODUCTO_SKIN_TYPES,
} from "@/schemas/productos.schema";
import {
  RUTINA_MOMENTO_LABELS,
  RUTINA_MOMENTOS,
  RUTINA_TAG_LABELS,
  RUTINA_TAGS,
} from "@/schemas/rutinas.schema";

export type LibraryView = ViewMode;

interface LibraryToolbarProps {
  view: LibraryView;
}

export function LibraryToolbar({ view }: LibraryToolbarProps) {
  const { searchDraft, setSearchDraft, update, getParam, pending } =
    useUrlFilters();

  return (
    <section
      aria-label="Filtros de la biblioteca"
      className="grid gap-3 rounded-xl border bg-card p-3"
      data-pending={pending ? "" : undefined}
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <UrlSearchBox
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder="Buscar rutina por nombre u objetivo…"
        />
        <UrlViewToggle
          view={view}
          // "grid" is the default — write `null` so it disappears from the URL.
          onChange={(v) => update({ view: v === "grid" ? null : v })}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <UrlSelectFilter
          label="Momento"
          value={getParam("filter_momento")}
          onChange={(v) => update({ filter_momento: v })}
          options={RUTINA_MOMENTOS.map((m) => ({
            value: m,
            label: RUTINA_MOMENTO_LABELS[m],
          }))}
        />
        <UrlSelectFilter
          label="Tipo de piel"
          value={getParam("filter_skin")}
          onChange={(v) => update({ filter_skin: v })}
          options={PRODUCTO_SKIN_TYPES.map((s) => ({
            value: s,
            label: PRODUCTO_SKIN_TYPE_LABELS[s],
          }))}
        />
        <UrlSelectFilter
          label="Etiqueta"
          value={getParam("filter_tag")}
          onChange={(v) => update({ filter_tag: v })}
          options={RUTINA_TAGS.map((t) => ({
            value: t,
            label: RUTINA_TAG_LABELS[t],
          }))}
        />
      </div>
    </section>
  );
}
