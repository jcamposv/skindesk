import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { AtlasEntryForm } from "@/components/atlas/admin/atlas-entry-form";
import { ROUTES } from "@/lib/constants";
import { listAllAtlasTags } from "@/services/atlas.service";

export const metadata: Metadata = { title: "Nueva entrada · Atlas CMS" };
export default async function NewAtlasEntryPage() {
  const existingTags = await listAllAtlasTags();
  // Stable id for the form session — used as the storage prefix for the
  // cover and (after create) for the row id when no autoincrement is in
  // play. The DB still mints the real PK via `gen_random_uuid()`, so this
  // id is only relevant client-side until the entry is saved.
  // crypto.randomUUID is available in modern Node + every supported browser.
  const draftId = crypto.randomUUID();

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href={ROUTES.atlasAdmin}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-3.5" />
          Volver al CMS
        </Link>
      </div>
      <header className="grid gap-1">
        <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
          Nueva entrada
        </h1>
        <p className="text-sm text-muted-foreground">
          Después de guardar, vas a poder subir PDFs, guías HTML e imágenes.
        </p>
      </header>
      <AtlasEntryForm entryId={draftId} existingTags={existingTags} />
    </div>
  );
}
