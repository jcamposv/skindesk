"use client";

import { useMemo } from "react";
import Image from "next/image";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CopyIcon,
  PackageIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { DataTable, type RowAction } from "@/components/data-table";
import { cn } from "@/lib/utils";
import {
  PRODUCTO_CATEGORIA_LABELS,
  PRODUCTO_SKIN_TYPE_LABELS,
  type ProductoSkinType,
} from "@/schemas/productos.schema";
import type { Producto } from "@/services/productos.service";

import { ProductoIllustration } from "./producto-illustration";

interface ProductosListTableProps {
  items: Producto[];
  totalItems: number;
  onEdit: (p: Producto) => void;
  onDuplicate: (p: Producto) => void;
  onDelete: (p: Producto) => void;
}

const DATE_FORMAT = new Intl.DateTimeFormat("es", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/**
 * List variant of the catalog rendered through the shared `DataTable`. The
 * page already drives URL state + pagination outside, so we turn off the
 * table's built-in toolbar/pagination/search to avoid duplicates.
 *
 * Why a custom column set vs reusing the grid card: tables read faster when
 * scanning many products, but they need a tighter visual rhythm — photos
 * are 40px thumbnails, ingredients become a comma list, tags fold into a
 * "+N" pill.
 */
export function ProductosListTable({
  items,
  totalItems,
  onEdit,
  onDuplicate,
  onDelete,
}: ProductosListTableProps) {
  const columns = useMemo<ColumnDef<Producto, unknown>[]>(
    () => [
      {
        id: "product",
        header: "Producto",
        cell: ({ row }) => <ProductNameCell producto={row.original} />,
      },
      {
        id: "category",
        header: "Categoría",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {PRODUCTO_CATEGORIA_LABELS[row.original.category]}
          </span>
        ),
      },
      {
        id: "ingredients",
        header: "Ingredientes",
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-[220px] text-xs text-muted-foreground">
            {row.original.main_ingredients.join(", ") || "—"}
          </span>
        ),
      },
      {
        id: "skin",
        header: "Piel",
        cell: ({ row }) => <SkinTypesCell items={row.original.skin_types} />,
      },
      {
        id: "routines",
        header: "Rutinas",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.routines_usage_count > 0
              ? row.original.routines_usage_count
              : "—"}
          </span>
        ),
      },
      {
        id: "updated",
        header: "Actualizado",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {DATE_FORMAT.format(new Date(row.original.updated_at))}
          </span>
        ),
      },
    ],
    [],
  );

  const rowActions = useMemo<RowAction<Producto>[]>(
    () => [
      { id: "edit", label: "Editar", icon: PencilIcon, onClick: onEdit },
      {
        id: "duplicate",
        label: "Duplicar",
        icon: CopyIcon,
        onClick: onDuplicate,
      },
      {
        id: "delete",
        label: "Eliminar",
        icon: Trash2Icon,
        variant: "destructive",
        onClick: onDelete,
      },
    ],
    [onEdit, onDuplicate, onDelete],
  );

  return (
    <DataTable<Producto>
      mode="server"
      data={items}
      totalItems={totalItems}
      columns={columns}
      rowActions={rowActions}
      getRowId={(r) => r.id}
      onRowClick={(r) => onEdit(r)}
      // The external `ProductosToolbar` handles search / filters / sort
      // and the external `ProductosPagination` lives below the table —
      // disabling the built-ins prevents duplicate UI.
      toolbar={false}
      searchable={false}
      sortable={false}
      showPagination={false}
      emptyTitle="Sin productos"
      emptyDescription="Sumá productos al catálogo para empezar a armar rutinas."
      emptyIcon={PackageIcon}
    />
  );
}

// ─── Cells ──────────────────────────────────────────────────────────────────

function ProductNameCell({ producto }: { producto: Producto }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "relative size-10 shrink-0 overflow-hidden rounded-md bg-[#F4F1EC]",
        )}
      >
        {producto.photoUrl ? (
          <Image
            src={producto.photoUrl}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-1.5">
            <ProductoIllustration category={producto.category} />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-sm">{producto.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {producto.brand || "—"}
        </p>
      </div>
    </div>
  );
}

function SkinTypesCell({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-muted-foreground/70">—</span>;
  const visible = items.slice(0, 2);
  const rest = items.length - visible.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((t) => (
        <span
          key={t}
          className="rounded-full border border-[#5C6E6C]/30 bg-[#E7ECEA] px-2 py-0.5 text-[11px] font-medium text-[#4F605C]"
        >
          {PRODUCTO_SKIN_TYPE_LABELS[t as ProductoSkinType] ?? t}
        </span>
      ))}
      {rest > 0 ? (
        <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}
