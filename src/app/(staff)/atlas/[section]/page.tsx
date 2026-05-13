import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon, SearchIcon, SparklesIcon } from "lucide-react";

import { AtlasEntryCard } from "@/components/atlas/atlas-entry-card";
import { AtlasPagination } from "@/components/atlas/atlas-pagination";
import {
  ATLAS_SECTION_ICONS,
  ATLAS_SECTION_TONES,
} from "@/components/atlas/atlas-section-icons";
import { AtlasShell } from "@/components/atlas/atlas-shell";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  ATLAS_SECTIONS,
  ATLAS_SECTION_DESCRIPTIONS,
  ATLAS_SECTION_LABELS,
  type AtlasSection,
} from "@/schemas/atlas.schema";
import {
  listAtlasEntries,
  listAtlasTagsForSection,
} from "@/services/atlas.service";

interface PageProps {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const DEFAULT_PAGE_SIZE = 24;
const PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const;

function asString(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v.trim() ? v.trim() : undefined;
}

function asNumber(
  raw: string | string[] | undefined,
  fallback: number,
  allowed?: readonly number[],
): number {
  const v = asString(raw);
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  if (allowed && !allowed.includes(n)) return fallback;
  return n;
}

function isAtlasSection(value: string): value is AtlasSection {
  return (ATLAS_SECTIONS as readonly string[]).includes(value);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { section } = await params;
  if (!isAtlasSection(section)) return { title: "Atlas dermocosmético" };
  return { title: ATLAS_SECTION_LABELS[section] };
}

// ISR — the reader section page is the same view for every staff role
// (RLS narrows to `published` for all of them), so we can serve a cached
// copy and revalidate on a short window. Mutations through the CMS call
// `revalidatePath(/atlas/<section>)` to bust the cache early.
export const revalidate = 60;

export default async function AtlasSectionPage({
  params,
  searchParams,
}: PageProps) {
  const { section: rawSection } = await params;
  if (!isAtlasSection(rawSection)) notFound();
  const section: AtlasSection = rawSection;

  const sp = await searchParams;
  const search = asString(sp.search);
  const tag = asString(sp.tag);
  const page = asNumber(sp.page, 1);
  const pageSize = asNumber(sp.pageSize, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS);

  // Tag chips come from the WHOLE published set of the section, not the
  // current page slice — so paginated views still show every available
  // tag.
  const [{ items, totalItems }, sectionTags] = await Promise.all([
    listAtlasEntries({ section, search, tag, page, pageSize }),
    listAtlasTagsForSection(section),
  ]);

  const Icon = ATLAS_SECTION_ICONS[section];
  const tones = ATLAS_SECTION_TONES[section];

  return (
    <AtlasShell activeSection={section}>
      <div>
        <Link
          href={ROUTES.atlas}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-3.5" />
          Atlas
        </Link>
      </div>

      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-12 items-center justify-center rounded-xl",
              tones.bg,
              tones.fg,
            )}
          >
            <Icon className="size-6" />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
              {ATLAS_SECTION_LABELS[section]}
            </h1>
            <p className="text-sm text-muted-foreground">
              {ATLAS_SECTION_DESCRIPTIONS[section]}
            </p>
          </div>
        </div>
      </header>

      {/* Search — pure form GET so this page stays a Server Component. */}
      <form
        action=""
        method="GET"
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <label className="relative block flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Buscar guías, activos, condiciones…"
            className="h-10 pl-9"
          />
        </label>
        {tag ? <input type="hidden" name="tag" value={tag} /> : null}
      </form>

      {/* Tag chips — pulled from `atlas_tags_for_section` so the strip is
          complete regardless of which page the user is on. */}
      {sectionTags.length > 0 ? (
        <div className="-mt-2 flex flex-wrap items-center gap-1.5">
          {tag ? (
            <Link
              href={`${ROUTES.atlas}/${section}${
                search ? `?search=${encodeURIComponent(search)}` : ""
              }`}
              className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              Limpiar tag
            </Link>
          ) : null}
          {sectionTags.map((t) => {
            const isActive = tag === t;
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (!isActive) params.set("tag", t);
            const qs = params.toString();
            return (
              <Link
                key={t}
                href={`${ROUTES.atlas}/${section}${qs ? `?${qs}` : ""}`}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  isActive
                    ? "border-transparent bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {t}
              </Link>
            );
          })}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
          <SparklesIcon className="size-8 text-muted-foreground" />
          <p className="mt-3 font-heading text-base">
            {search || tag ? "Sin resultados" : "Sin contenido todavía"}
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            {search || tag
              ? "Probá con otra búsqueda o limpiá los filtros."
              : "Esta sección estará disponible pronto."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((entry) => (
              <AtlasEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
          {totalItems > pageSize ? (
            <AtlasPagination
              page={page}
              pageSize={pageSize}
              totalItems={totalItems}
              defaultPageSize={DEFAULT_PAGE_SIZE}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Mostrando {items.length} de {totalItems}
            </p>
          )}
        </>
      )}
    </AtlasShell>
  );
}
