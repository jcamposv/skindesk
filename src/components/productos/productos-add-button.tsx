"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ProductoSheet } from "./producto-sheet";

interface ProductosAddButtonProps {
  tenantId: string;
}

/**
 * Self-contained "Agregar producto" button + sheet. Lives in the page
 * header (rendered by the Server Component) and owns its own open state.
 *
 * Why a dedicated component instead of using `ProductoSheet`'s uncontrolled
 * mode: that path mounted a separate sheet tree in the page header while
 * `ProductosPageClient` also kept one for its empty state. Two sheet trees
 * with different draft IDs caused subtle state divergence. This component
 * owns the single source of truth — the empty-state CTA in
 * `ProductosPageClient` uses the same control flow via the
 * `ProductosAddDialogContext`.
 *
 * A fresh draft UUID is minted per mount so re-opening the sheet always
 * gets a clean storage path. If the user uploads a photo, abandons, and
 * re-opens, they get a NEW path (the abandoned photo orphans in Storage —
 * acceptable tradeoff vs. carrying server state for unsubmitted drafts).
 */
export function ProductosAddButton({ tenantId }: ProductosAddButtonProps) {
  const [open, setOpen] = useState(false);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());

  function handleOpen() {
    // New draft id on each open so abandoned drafts don't share photo
    // paths with the next attempt.
    setDraftId(crypto.randomUUID());
    setOpen(true);
  }

  return (
    <>
      <Button variant="cta" size="lg" className="gap-1.5" onClick={handleOpen}>
        <PlusIcon className="size-4" />
        Agregar producto
      </Button>
      <ProductoSheet
        tenantId={tenantId}
        draftId={draftId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
