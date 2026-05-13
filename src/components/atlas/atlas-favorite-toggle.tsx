"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StarIcon } from "lucide-react";
import { toast } from "sonner";

import { toggleAtlasFavoriteAction } from "@/actions/atlas.actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AtlasFavoriteToggleProps {
  entryId: string;
  initialFavorited: boolean;
}

/** Client island. Optimistically flips the icon, calls the server action,
 *  rolls back on error. Keeps the button stable across navigations because
 *  the favorite state is a row in `atlas_favorites` scoped to the caller's
 *  user_id via RLS. */
export function AtlasFavoriteToggle({
  entryId,
  initialFavorited,
}: AtlasFavoriteToggleProps) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();

  function onClick() {
    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      const res = await toggleAtlasFavoriteAction(entryId, next);
      if (!res.success) {
        // Roll back the optimistic flip on failure.
        setFavorited(!next);
        toast.error(res.message ?? "No se pudo guardar el favorito.");
        return;
      }
      // Refresh server-rendered "Favoritos" surfaces (landing strip).
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={onClick}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={favorited ? "Quitar de favoritos" : "Guardar en favoritos"}
    >
      <StarIcon
        className={cn(
          "size-3.5",
          favorited ? "fill-[#D2A96A] text-[#D2A96A]" : "text-muted-foreground",
        )}
      />
      {favorited ? "Guardado" : "Guardar"}
    </Button>
  );
}
