import Image from "next/image";
import Link from "next/link";
import { FileTextIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import {
  ATLAS_SECTION_LABELS,
  type AtlasEntryStatus,
  ATLAS_ENTRY_STATUS_LABELS,
} from "@/schemas/atlas.schema";
import type { AtlasEntry } from "@/services/atlas.service";

import {
  ATLAS_SECTION_ICONS,
  ATLAS_SECTION_TONES,
} from "./atlas-section-icons";

interface AtlasEntryCardProps {
  entry: AtlasEntry;
  /** When true, render the section name and a status pill (used by the
   *  super-admin list). Reader cards keep the design minimalist. */
  showSection?: boolean;
  showStatus?: boolean;
  /** Override the navigation target. Defaults to the reader URL —
   *  super-admin contexts pass the CMS edit URL so clicking on a draft
   *  card opens the editor instead of hitting the 404 reader page. */
  href?: string;
}

const STATUS_VARIANT: Record<
  AtlasEntryStatus,
  "default" | "secondary" | "outline"
> = {
  published: "default",
  draft: "outline",
  archived: "secondary",
};

/**
 * Library-style card. Wraps a `<Link>` so the whole surface is clickable
 * without nesting an anchor inside the title (a11y) — Next 16 supports
 * block-level Link children fine.
 */
export function AtlasEntryCard({
  entry,
  showSection = false,
  showStatus = false,
  href,
}: AtlasEntryCardProps) {
  const Icon = ATLAS_SECTION_ICONS[entry.section];
  const tones = ATLAS_SECTION_TONES[entry.section];
  const resolvedHref =
    href ?? `${ROUTES.atlas}/${entry.section}/${entry.slug}`;

  return (
    <Link
      href={resolvedHref}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className={cn(
          "relative aspect-[5/3] w-full overflow-hidden",
          tones.bg,
        )}
      >
        {entry.coverUrl ? (
          <Image
            src={entry.coverUrl}
            alt=""
            fill
            sizes="(min-width: 768px) 33vw, 100vw"
            className="object-cover transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <div className={cn("flex h-full w-full items-center justify-center")}>
            <Icon className={cn("size-12 opacity-70", tones.fg)} />
          </div>
        )}
        {showStatus ? (
          <span className="absolute right-3 top-3">
            <Badge variant={STATUS_VARIANT[entry.status]}>
              {ATLAS_ENTRY_STATUS_LABELS[entry.status]}
            </Badge>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {showSection ? (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {ATLAS_SECTION_LABELS[entry.section]}
          </span>
        ) : null}
        <h3 className="font-heading text-base font-medium leading-tight line-clamp-2">
          {entry.title}
        </h3>
        {entry.description ? (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {entry.description}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileTextIcon className="size-3.5" />
            Guía clínica
          </p>
        )}
        {entry.tags.length > 0 ? (
          <div className="mt-auto flex flex-wrap gap-1 pt-2">
            {entry.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="font-normal">
                {tag}
              </Badge>
            ))}
            {entry.tags.length > 4 ? (
              <span className="text-xs font-medium text-foreground/75">
                +{entry.tags.length - 4}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
