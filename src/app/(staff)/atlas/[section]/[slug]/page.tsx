import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeftIcon,
  EyeOffIcon,
  PencilIcon,
} from "lucide-react";

import { AtlasFavoriteToggle } from "@/components/atlas/atlas-favorite-toggle";
import { AtlasFilesList } from "@/components/atlas/atlas-files-list";
import { AtlasMarkdown } from "@/components/atlas/atlas-markdown";
import {
  ATLAS_SECTION_ICONS,
  ATLAS_SECTION_TONES,
} from "@/components/atlas/atlas-section-icons";
import { AtlasShell } from "@/components/atlas/atlas-shell";
import { AtlasViewTracker } from "@/components/atlas/atlas-view-tracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  ATLAS_ENTRY_STATUS_LABELS,
  ATLAS_SECTIONS,
  ATLAS_SECTION_LABELS,
  type AtlasSection,
} from "@/schemas/atlas.schema";
import {
  getAtlasEntryBySlug,
  isAtlasEntryFavorite,
  listAtlasFilesByEntry,
} from "@/services/atlas.service";

interface PageProps {
  params: Promise<{ section: string; slug: string }>;
}

function isAtlasSection(value: string): value is AtlasSection {
  return (ATLAS_SECTIONS as readonly string[]).includes(value);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { section, slug } = await params;
  if (!isAtlasSection(section)) return { title: "Atlas dermocosmético" };
  // Metadata pass is cheap — we don't gate by status here; the page itself
  // will 404 below for unauthorised draft viewers.
  const entry = await getAtlasEntryBySlug(section, slug, {
    publishedOnly: false,
  });
  return { title: entry?.title ?? ATLAS_SECTION_LABELS[section] };
}

// Page is per-user (favorite state + super_admin draft preview) so we
// keep it dynamic. The other reader surfaces (`/atlas`, `/atlas/[section]`)
// can ISR because they don't branch by viewer.
export const dynamic = "force-dynamic";

export default async function AtlasEntryPage({ params }: PageProps) {
  const { section: rawSection, slug } = await params;
  if (!isAtlasSection(rawSection)) notFound();
  const section: AtlasSection = rawSection;

  // super_admin can preview drafts/archived rows — they curate this
  // content. profesional + asistente only see `published`.
  const session = await getCurrentSession();
  const isSuperAdmin = session?.profile.role === "super_admin";

  const entry = await getAtlasEntryBySlug(section, slug, {
    publishedOnly: !isSuperAdmin,
  });
  if (!entry) notFound();

  const [files, favorited] = await Promise.all([
    listAtlasFilesByEntry(entry.id),
    isAtlasEntryFavorite(entry.id),
  ]);

  const Icon = ATLAS_SECTION_ICONS[section];
  const tones = ATLAS_SECTION_TONES[section];

  const isPreview = entry.status !== "published";

  return (
    <AtlasShell activeSection={section}>
      <article className="grid gap-6">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`${ROUTES.atlas}/${section}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeftIcon className="size-3.5" />
            {ATLAS_SECTION_LABELS[section]}
          </Link>
          <div className="flex items-center gap-1.5">
            {/* Only track views when the entry is actually live for the
                viewer (skip drafts the super_admin is previewing). */}
            {!isPreview ? <AtlasViewTracker entryId={entry.id} /> : null}
            {!isPreview ? (
              <AtlasFavoriteToggle
                entryId={entry.id}
                initialFavorited={favorited}
              />
            ) : null}
            {isSuperAdmin ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                render={<Link href={`${ROUTES.atlasAdmin}/${entry.id}`} />}
              >
                <PencilIcon className="size-3.5" />
                Editar en administración
              </Button>
            ) : null}
          </div>
        </div>

        {isPreview ? (
          <div className="flex items-start gap-3 rounded-2xl border border-[#D2A96A]/40 bg-[#FBF1DC] px-4 py-3 text-sm">
            <EyeOffIcon className="mt-0.5 size-4 shrink-0 text-[#8E6628]" />
            <div className="flex-1 text-[#7C5E1F]">
              <p className="font-medium">
                Vista previa · {ATLAS_ENTRY_STATUS_LABELS[entry.status]}
              </p>
              <p className="text-xs text-[#8E6628]">
                Esta entrada todavía no es visible para las profesionales.
                Solo el super administrador puede verla así.
              </p>
            </div>
          </div>
        ) : null}

        <header className="grid gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded",
                tones.bg,
                tones.fg,
              )}
            >
              <Icon className="size-2.5" />
            </span>
            {ATLAS_SECTION_LABELS[section]}
          </span>
          <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-4xl">
            {entry.title}
          </h1>
          {entry.description ? (
            <p className="max-w-3xl text-base text-muted-foreground">
              {entry.description}
            </p>
          ) : null}
          {entry.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {entry.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </header>

        {entry.coverUrl ? (
          <div
            className={cn(
              "relative aspect-[16/7] w-full overflow-hidden rounded-2xl border",
              tones.bg,
            )}
          >
            <Image
              src={entry.coverUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 70vw, 100vw"
              className="object-cover"
              priority
            />
          </div>
        ) : null}

        {entry.body_md ? (
          <section
            aria-label="Contenido"
            className="rounded-2xl border bg-card p-6"
          >
            <AtlasMarkdown source={entry.body_md} />
          </section>
        ) : null}

        <AtlasFilesList files={files} entryTitle={entry.title} />

        {!entry.body_md && files.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
            <p className="font-heading text-base">Contenido en preparación</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Esta entrada estará disponible próximamente.
            </p>
          </div>
        ) : null}
      </article>
    </AtlasShell>
  );
}
