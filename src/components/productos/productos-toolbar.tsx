"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LayoutGridIcon,
  ListIcon,
  SearchIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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

export type ProductosView = "grid" | "list";

interface ProductosToolbarProps {
  view: ProductosView;
}

/**
 * Owns the URL state for the catalog page: search, filters, sort, view. The
 * server component reads `searchParams` on every change and re-renders with
 * fresh data — same pattern as the Clientes page DataTable, just rendered
 * as a card grid instead of a table.
 *
 * Why a separate toolbar component (vs. DataTable.toolbar): the catalog
 * needs a grid/list toggle and card layouts the DataTable can't render
 * without forking. The URL conventions are the same so we can swap in a
 * full DataTable later if the catalog grows past 1k SKUs.
 */
export function ProductosToolbar({ view }: ProductosToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlSearch = searchParams.get("search") ?? "";
  const category = searchParams.get("filter_category") ?? "";
  const skinType = searchParams.get("filter_skin_type") ?? "";
  const tag = searchParams.get("filter_tag") ?? "";
  const sort = searchParams.get("sort") ?? "recent";

  // Local input state so typing doesn't trigger a navigation on every
  // keystroke. The debounced effect below pushes to the URL when the user
  // pauses for ~300ms — that's the sweet spot where the search feels live
  // without melting the server.
  const [searchDraft, setSearchDraft] = useState(urlSearch);
  // When the URL changes externally (browser back, filter reset), pull
  // that value back into the input.
  const lastSyncedRef = useRef(urlSearch);
  useEffect(() => {
    if (urlSearch !== lastSyncedRef.current) {
      lastSyncedRef.current = urlSearch;
      setSearchDraft(urlSearch);
    }
  }, [urlSearch]);

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // Any filter change resets page to 1 — otherwise we'd land on an empty
    // page when the result set shrinks below the current offset.
    next.delete("page");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `?${qs}` : "?", { scroll: false });
    });
  }

  // Debounced URL sync for the search input. 300ms means typing 5
  // characters in 1 second triggers ONE navigation, not five.
  useEffect(() => {
    if (searchDraft === urlSearch) return;
    const handle = setTimeout(() => {
      lastSyncedRef.current = searchDraft;
      update({ search: searchDraft });
    }, 300);
    return () => clearTimeout(handle);
    // `update`/`urlSearch` intentionally not in deps — we only debounce on
    // user input changes, not on URL changes coming back in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  return (
    <section
      aria-label="Filtros y vista"
      className="grid gap-3 rounded-xl border bg-card p-3"
      data-pending={pending ? "" : undefined}
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        {/* Search — controlled with debounced URL sync. Typing feels
            instantaneous; the URL updates 300ms after the user stops. */}
        <label className="relative block">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Buscar por nombre, marca o ingrediente…"
            className="h-10 pl-9"
          />
        </label>

        {/* View toggle */}
        <div
          role="radiogroup"
          aria-label="Modo de vista"
          className="inline-flex items-center self-center rounded-md border bg-background p-0.5"
        >
          <ViewToggle
            value="grid"
            active={view === "grid"}
            label="Grilla"
            icon={LayoutGridIcon}
            onSelect={() => update({ view: null })}
          />
          <ViewToggle
            value="list"
            active={view === "list"}
            label="Lista"
            icon={ListIcon}
            onSelect={() => update({ view: "list" })}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SelectFilter
          label="Categoría"
          value={category}
          onChange={(v) => update({ filter_category: v })}
          options={PRODUCTO_CATEGORIAS.map((c) => ({
            value: c,
            label: PRODUCTO_CATEGORIA_LABELS[c],
          }))}
        />
        <SelectFilter
          label="Tipo de piel"
          value={skinType}
          onChange={(v) => update({ filter_skin_type: v })}
          options={PRODUCTO_SKIN_TYPES.map((s) => ({
            value: s,
            label: PRODUCTO_SKIN_TYPE_LABELS[s],
          }))}
        />
        <SelectFilter
          label="Etiqueta"
          value={tag}
          onChange={(v) => update({ filter_tag: v })}
          options={PRODUCTO_TAGS.map((t) => ({
            value: t,
            label: PRODUCTO_TAG_LABELS[t],
          }))}
        />
        <SelectFilter
          label="Orden"
          value={sort}
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

// ─── Subcomponents ──────────────────────────────────────────────────────────

interface ViewToggleProps {
  value: ProductosView;
  active: boolean;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}

function ViewToggle({
  active,
  label,
  icon: Icon,
  onSelect,
}: ViewToggleProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "ghost"}
      onClick={onSelect}
      className={cn("h-8 gap-1.5 px-2.5", active ? "" : "text-muted-foreground")}
      aria-pressed={active}
    >
      <Icon className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

interface SelectFilterProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allowClear?: boolean;
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
  allowClear = true,
}: SelectFilterProps) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5C6E6C]/30"
      >
        {allowClear ? <option value="">Todos</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
