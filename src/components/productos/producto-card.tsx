"use client";

import Image from "next/image";
import {
  CopyIcon,
  MoreVerticalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  PRODUCTO_CATEGORIA_LABELS,
  PRODUCTO_SKIN_TYPE_LABELS,
  PRODUCTO_TAG_LABELS,
  type ProductoSkinType,
  type ProductoTag,
} from "@/schemas/productos.schema";
import type { Producto } from "@/services/productos.service";

import { ProductoIllustration } from "./producto-illustration";

interface ProductoCardProps {
  producto: Producto;
  onEdit: (producto: Producto) => void;
  onDuplicate: (producto: Producto) => void;
  onDelete: (producto: Producto) => void;
}

/**
 * Grid card. ~280px wide on a 4-column desktop grid, responsive down to one
 * card per row on mobile. Photo (or category illustration) sits in a fixed
 * 4:5 box at the top; metadata below. Hover surfaces a subtle lift but no
 * floating overlay — the kebab menu carries every action so the card stays
 * keyboard-friendly.
 */
export function ProductoCard({
  producto,
  onEdit,
  onDuplicate,
  onDelete,
}: ProductoCardProps) {
  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card transition-all",
        "hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_8px_28px_-12px_rgba(0,0,0,0.12)]",
      )}
    >
      {/* Visual */}
      <button
        type="button"
        onClick={() => onEdit(producto)}
        className="relative aspect-[4/5] w-full overflow-hidden bg-[#F4F1EC] focus:outline-none focus:ring-2 focus:ring-[#5C6E6C]/40"
        aria-label={`Editar ${producto.name}`}
      >
        {producto.photoUrl ? (
          <Image
            src={producto.photoUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-6">
            <ProductoIllustration category={producto.category} />
          </div>
        )}
        {producto.routines_usage_count > 0 ? (
          <Badge
            variant="secondary"
            className="absolute right-2 top-2 bg-white/90 text-foreground backdrop-blur"
          >
            {producto.routines_usage_count}{" "}
            {producto.routines_usage_count === 1 ? "rutina" : "rutinas"}
          </Badge>
        ) : null}
      </button>

      {/* Meta */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-heading text-sm font-medium">
              {producto.name}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              {producto.brand || "—"} ·{" "}
              {PRODUCTO_CATEGORIA_LABELS[producto.category]}
            </p>
          </div>
          <ActionsMenu
            producto={producto}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </header>

        {producto.main_ingredients.length > 0 ? (
          <TagRow
            items={producto.main_ingredients}
            colorClass="border-[#BB7154]/30 bg-[#FBEFE7] text-[#8C4A30]"
          />
        ) : null}

        {producto.skin_types.length > 0 ? (
          <TagRow
            label="Piel"
            items={producto.skin_types.map(
              (t) => PRODUCTO_SKIN_TYPE_LABELS[t as ProductoSkinType] ?? t,
            )}
            colorClass="border-[#5C6E6C]/30 bg-[#E7ECEA] text-[#4F605C]"
          />
        ) : null}

        {producto.additional_tags.length > 0 ? (
          <TagRow
            label="Tags"
            items={producto.additional_tags.map(
              (t) => PRODUCTO_TAG_LABELS[t as ProductoTag] ?? t,
            )}
            colorClass="border-[#D2A96A]/30 bg-[#F8EFD7] text-[#7C5E1F]"
            max={3}
          />
        ) : null}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

interface ActionsMenuProps {
  producto: Producto;
  onEdit: (p: Producto) => void;
  onDuplicate: (p: Producto) => void;
  onDelete: (p: Producto) => void;
}

function ActionsMenu({
  producto,
  onEdit,
  onDuplicate,
  onDelete,
}: ActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label="Acciones"
          >
            <MoreVerticalIcon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(producto)}>
          <PencilIcon className="size-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate(producto)}>
          <CopyIcon className="size-4" />
          Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(producto)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2Icon className="size-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface TagRowProps {
  label?: string;
  items: string[];
  colorClass: string;
  max?: number;
}

function TagRow({ label, items, colorClass, max = 4 }: TagRowProps) {
  const visible = items.slice(0, max);
  const extra = items.length - visible.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {label ? (
        <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      ) : null}
      {visible.map((item) => (
        <span
          key={item}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
            colorClass,
          )}
        >
          {item}
        </span>
      ))}
      {extra > 0 ? (
        <span className="text-[11px] text-muted-foreground">+{extra}</span>
      ) : null}
    </div>
  );
}
