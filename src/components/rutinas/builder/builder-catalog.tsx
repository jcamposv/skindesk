"use client";

import { memo, useMemo, useState } from "react";
import Image from "next/image";
import { PlusIcon, SearchIcon } from "lucide-react";

import { MultiCombobox } from "@/components/shared/multi-combobox";
import { Input } from "@/components/ui/input";
import { ProductoIllustration } from "@/components/productos/producto-illustration";
import {
  PRODUCTO_CATEGORIA_LABELS,
  PRODUCTO_CATEGORIAS,
  type ProductoCategoria,
} from "@/schemas/productos.schema";

import type { BuilderProducto } from "./types";

interface BuilderCatalogProps {
  productos: BuilderProducto[];
  /** Add a product to the routine. Called from "+" click + drag-drop. */
  onAdd: (producto: BuilderProducto) => void;
  /** When `listProductosForBuilder` hit its cap, this is the total
   *  matching count so the catalog can hint "showing first N of X" and
   *  push the user to refine the search. `null` when nothing was clipped. */
  cappedAt: number | null;
}

/**
 * Left column of the builder. Lightweight catalog filtered locally because
 * the parent ships the full tenant catalog (a profesional rarely has more
 * than a few hundred products).
 *
 * Each card supports two interactions:
 *  · click "+" → calls `onAdd` synchronously
 *  · drag onto the canvas drop zone → calls `onAdd` from the drop handler
 *
 * Drag data: the producto id, encoded as text/plain so any drop target
 * (including future ones) can consume it.
 */
export function BuilderCatalog({
  productos,
  onAdd,
  cappedAt,
}: BuilderCatalogProps) {
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<ProductoCategoria[]>([]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const categorySet =
      categories.length > 0 ? new Set<string>(categories) : null;
    return productos.filter((p) => {
      if (categorySet && !categorySet.has(p.category)) return false;
      if (!term) return true;
      const haystack = [
        p.name,
        p.brand ?? "",
        p.mainIngredients.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [productos, search, categories]);

  const categoryOptions = useMemo(
    () =>
      PRODUCTO_CATEGORIAS.map((c) => ({
        value: c,
        label: PRODUCTO_CATEGORIA_LABELS[c],
      })),
    [],
  );

  return (
    <aside className="flex h-full min-h-0 flex-col border-r bg-card">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground/80">
          Catálogo
        </h2>
        <span className="text-xs font-semibold text-foreground/75 tabular-nums">
          {filtered.length}
        </span>
      </header>

      <div className="border-b px-4 py-3">
        <label className="relative block">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto o ingrediente…"
            className="h-9 pl-9"
          />
        </label>
      </div>

      {/* Category filter — searchable multi-select. Replaces the prior chip
          rail, which overflowed the 280px column and forced horizontal
          scroll once we shipped more than ~4 categorias. */}
      <div className="border-b px-3 py-2">
        <MultiCombobox
          options={categoryOptions}
          value={categories}
          onChange={(next) => setCategories(next as ProductoCategoria[])}
          placeholder="Todas las categorías"
          searchPlaceholder="Buscar categoría…"
          emptyMessage="Sin categorías."
          ariaLabel="Filtrar por categoría"
          showSelectAll
          selectAllLabel="Todas las categorías"
          triggerClassName="text-xs items-center"
        />
      </div>

      {cappedAt !== null ? (
        // The catalog query was capped server-side. Tell the user how many
        // products are not visible and nudge them to refine the search.
        <p className="border-b bg-[#FBEFE7]/60 px-4 py-2 text-xs font-medium leading-relaxed text-[#7A3D24]">
          Mostrando los primeros {productos.length} de {cappedAt} productos.
          Refiná la búsqueda para encontrar uno específico.
        </p>
      ) : null}

      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm leading-relaxed text-foreground/75">
            Sin productos. Prueba con otro filtro o agregá al catálogo desde
            <span className="ml-1 font-semibold text-foreground">Catálogo de productos</span>.
          </p>
        ) : (
          <div className="grid gap-2">
            {filtered.map((p) => (
              <CatalogProductCard key={p.id} producto={p} onAdd={onAdd} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface CatalogProductCardProps {
  producto: BuilderProducto;
  onAdd: (p: BuilderProducto) => void;
}

// Memoised so a search keystroke (which re-runs the `filtered` memo and
// triggers BuilderCatalog to re-render) only re-renders cards whose
// `producto` reference actually changed — i.e. the ones leaving / joining
// the filter window.
const CatalogProductCard = memo(function CatalogProductCard({
  producto,
  onAdd,
}: CatalogProductCardProps) {
  function handleDragStart(e: React.DragEvent) {
    // Carry the full producto snapshot so the drop zone can call addStep
    // without holding a productosById map in the parent. This lets the
    // catalog stream in via <Suspense> independently — see audit Phase 3.
    e.dataTransfer.setData("application/json", JSON.stringify(producto));
    e.dataTransfer.setData("text/plain", producto.id);
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <article
      draggable
      onDragStart={handleDragStart}
      className="group flex items-center gap-2.5 rounded-lg border bg-card p-2.5 transition-all hover:border-[#5C6E6C]/40 hover:shadow-sm"
    >
      <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-[#F4F1EC]">
        {producto.photoUrl ? (
          <Image
            src={producto.photoUrl}
            alt=""
            fill
            sizes="44px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-1.5">
            <ProductoIllustration category={producto.category} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{producto.name}</p>
        <p className="truncate text-xs text-foreground/75">
          {producto.brand || "—"}
        </p>
        {producto.mainIngredients.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {producto.mainIngredients.slice(0, 2).map((ing) => (
              <span
                key={ing}
                className="rounded-full border border-[#BB7154]/30 bg-[#FBEFE7] px-2 py-0.5 text-[11px] font-semibold text-[#7A3D24]"
              >
                {ing}
              </span>
            ))}
            {producto.mainIngredients.length > 2 ? (
              <span className="text-[11px] font-medium text-foreground/65">
                +{producto.mainIngredients.length - 2}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onAdd(producto)}
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#D2A96A] text-white opacity-0 shadow-sm transition-all hover:bg-[#C49758] group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#D2A96A]/40"
        aria-label={`Agregar ${producto.name} a la rutina`}
      >
        <PlusIcon className="size-4" strokeWidth={2.5} />
      </button>
    </article>
  );
});
