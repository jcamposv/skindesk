import { Badge } from "@/components/ui/badge";
import {
  ATLAS_ENTRY_STATUS_LABELS,
  type AtlasEntryStatus,
} from "@/schemas/atlas.schema";

interface AtlasStatusBadgeProps {
  status: AtlasEntryStatus;
  /** Optional className passthrough — useful when the badge needs to sit
   *  absolutely positioned over a cover image. */
  className?: string;
}

const VARIANT: Record<
  AtlasEntryStatus,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  published: "default",
  draft: "outline",
  archived: "secondary",
};

/**
 * Single source of truth for "Borrador / Publicado / Archivado" chips
 * across the Atlas surfaces. Kept dumb: no role gating, no status mutation
 * — the parent decides whether to render it at all.
 */
export function AtlasStatusBadge({ status, className }: AtlasStatusBadgeProps) {
  return (
    <Badge variant={VARIANT[status]} className={className}>
      {ATLAS_ENTRY_STATUS_LABELS[status]}
    </Badge>
  );
}
