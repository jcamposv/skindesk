"use client";

import { use } from "react";

import type { BuilderCatalogResult } from "@/services/productos.service";

import { BuilderCatalog } from "./builder-catalog";
import type { BuilderProducto } from "./types";

/**
 * Async catalog wrapper — suspends on a server-passed Promise (React 19
 * `use(promise)` pattern). The server starts `listProductosForBuilder`
 * but does NOT await it; the page renders the builder shell immediately,
 * and this component suspends inside its own `<Suspense>` boundary while
 * the productos + signed URLs stream in.
 *
 * Trade-off vs awaiting in the page: the server still pays the same query
 * cost, but the user sees the builder shell + meta + step editor as soon
 * as the auth/redirect block resolves — the catalog appears as a skeleton
 * and fills in afterwards.
 */
interface BuilderCatalogAsyncProps {
  productosPromise: Promise<BuilderCatalogResult>;
  onAdd: (producto: BuilderProducto) => void;
}

export function BuilderCatalogAsync({
  productosPromise,
  onAdd,
}: BuilderCatalogAsyncProps) {
  const catalog = use(productosPromise);
  const productos: BuilderProducto[] = catalog.items.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    photoUrl: p.photoUrl,
    mainIngredients: p.main_ingredients ?? [],
    applicationInstruction: p.application_instruction,
    suggestedAmount: p.suggested_amount,
    absorptionTime: p.absorption_time,
    frequency: p.frequency,
    timeOfDay: p.time_of_day,
  }));
  const cappedAt = catalog.isCapped ? catalog.totalMatching : null;

  return (
    <BuilderCatalog
      productos={productos}
      onAdd={onAdd}
      cappedAt={cappedAt}
    />
  );
}
