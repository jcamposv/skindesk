import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeftIcon,
  EyeIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { deleteAtlasEntryAction } from "@/actions/atlas.actions";
import { AtlasEntryForm } from "@/components/atlas/admin/atlas-entry-form";
import { AtlasFilesUpload } from "@/components/atlas/admin/atlas-files-upload";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import {
  ATLAS_ENTRY_STATUS_LABELS,
  ATLAS_SECTION_LABELS,
  type UpsertAtlasEntryInput,
} from "@/schemas/atlas.schema";
import {
  getAtlasEntryById,
  listAllAtlasTags,
  listAtlasFilesByEntry,
} from "@/services/atlas.service";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const entry = await getAtlasEntryById(id);
  return { title: entry ? `${entry.title} · Atlas CMS` : "Atlas CMS" };
}
export default async function EditAtlasEntryPage({ params }: PageProps) {
  const { id } = await params;
  const entry = await getAtlasEntryById(id);
  if (!entry) notFound();
  const [files, existingTags] = await Promise.all([
    listAtlasFilesByEntry(id),
    listAllAtlasTags(),
  ]);

  const initial: UpsertAtlasEntryInput & {
    coverUrl?: string | null;
  } = {
    section: entry.section,
    title: entry.title,
    slug: entry.slug,
    description: entry.description ?? "",
    bodyMd: entry.body_md ?? "",
    tags: entry.tags ?? [],
    status: entry.status,
    position: entry.position ?? 0,
    coverPath: entry.cover_path ?? "",
    coverUrl: entry.coverUrl,
  };

  // Server-action wrapper for the delete button — keeps the page a Server
  // Component while letting the form post directly to the action.
  async function handleDelete() {
    "use server";
    await deleteAtlasEntryAction(id);
  }

  const readerHref = `${ROUTES.atlas}/${entry.section}/${entry.slug}`;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <Link
          href={ROUTES.atlasAdmin}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-3.5" />
          Volver al CMS
        </Link>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            render={<Link href={readerHref} target="_blank" />}
          >
            <EyeIcon className="size-3.5" />
            {entry.status === "published"
              ? "Ver como profesional"
              : "Vista previa"}
          </Button>
        </div>
      </div>

      <header className="grid gap-1">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground/80">
          {ATLAS_SECTION_LABELS[entry.section]} ·{" "}
          {ATLAS_ENTRY_STATUS_LABELS[entry.status]}
        </span>
        <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
          {entry.title}
        </h1>
      </header>

      <AtlasEntryForm
        entryId={id}
        isEdit
        initial={initial}
        existingTags={existingTags}
      />

      <section aria-label="Archivos adjuntos" className="grid gap-3">
        <div>
          <h2 className="font-heading text-lg font-medium">Archivos</h2>
          <p className="text-xs text-muted-foreground">
            Subí PDFs, guías HTML interactivas e imágenes. Quedan asociados a
            esta entrada y se sirven con URLs firmadas.
          </p>
        </div>
        <AtlasFilesUpload entryId={id} initial={files} />
      </section>

      {/* Danger zone — keep at the bottom, behind a server-action confirm. */}
      <section
        aria-label="Zona peligrosa"
        className="grid gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
      >
        <div className="flex items-center gap-2 text-destructive">
          <TriangleAlertIcon className="size-4" />
          <h2 className="text-sm font-medium">Eliminar entrada</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Esta acción elimina la entrada y todos sus archivos asociados.
          No se puede deshacer.
        </p>
        <form action={handleDelete}>
          <Button type="submit" variant="destructive" size="sm">
            Eliminar definitivamente
          </Button>
        </form>
      </section>
    </div>
  );
}
