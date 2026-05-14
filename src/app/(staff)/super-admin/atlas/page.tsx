import type { Metadata } from "next";
import Link from "next/link";
import { LibraryIcon, PlusIcon, SearchIcon } from "lucide-react";

import { AtlasEntryCard } from "@/components/atlas/atlas-entry-card";
import { AtlasPagination } from "@/components/atlas/atlas-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/constants";
import {
  ATLAS_ENTRY_STATUSES,
  ATLAS_ENTRY_STATUS_LABELS,
  ATLAS_SECTIONS,
  ATLAS_SECTION_LABELS,
  type AtlasEntryStatus,
  type AtlasSection,
} from "@/schemas/atlas.schema";
import { listAtlasEntries } from "@/services/atlas.service";

export const metadata: Metadata = { title: "Atlas · Administración" };
// CMS sees draft + archived rows — content branches by role at the data
// layer, so we keep it dynamic instead of caching.
export const dynamic = "force-dynamic";

interface PageProps {
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

function isAtlasSection(value: string | undefined): value is AtlasSection {
  return Boolean(value && (ATLAS_SECTIONS as readonly string[]).includes(value));
}
function isAtlasStatus(
  value: string | undefined,
): value is AtlasEntryStatus {
  return Boolean(
    value && (ATLAS_ENTRY_STATUSES as readonly string[]).includes(value),
  );
}

export default async function AtlasAdminListPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = asString(sp.search);
  const rawSection = asString(sp.section);
  const rawStatus = asString(sp.status);
  const section = isAtlasSection(rawSection) ? rawSection : undefined;
  const status = isAtlasStatus(rawStatus) ? rawStatus : undefined;
  const page = asNumber(sp.page, 1);
  const pageSize = asNumber(sp.pageSize, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS);

  const { items, totalItems } = await listAtlasEntries({
    section,
    search,
    page,
    pageSize,
    // CMS sees every state, not just published.
    statuses: status ? [status] : ATLAS_ENTRY_STATUSES,
  });

  // Helper to build a filter URL preserving other params. Filter changes
  // always reset to page 1 because the new slice may be smaller than the
  // current offset.
  function urlFor(next: Partial<{ section: string; status: string }>) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const s = next.section ?? section;
    if (s) params.set("section", s);
    const st = next.status ?? status;
    if (st) params.set("status", st);
    if (pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(pageSize));
    const qs = params.toString();
    return `${ROUTES.atlasAdmin}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#EAE6DC] px-2.5 py-1 text-xs font-medium text-[#5C6E6C]">
            <LibraryIcon className="size-3" />
            Atlas · Administración
          </span>
          <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
            Biblioteca dermocosmética
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalItems} {totalItems === 1 ? "entrada" : "entradas"} ·
            contenido global a todos los profesionales.
          </p>
        </div>
        <Button
          variant="cta"
          size="lg"
          className="gap-1.5"
          render={<Link href={`${ROUTES.atlasAdmin}/new`} />}
        >
          <PlusIcon className="size-4" />
          Nueva entrada
        </Button>
      </header>

      <form
        action={ROUTES.atlasAdmin}
        method="GET"
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <label className="relative block flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Buscar por título, descripción o tag…"
            className="h-10 pl-9"
          />
        </label>
        {section ? (
          <input type="hidden" name="section" value={section} />
        ) : null}
        {status ? <input type="hidden" name="status" value={status} /> : null}
      </form>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Sección:</span>
        <Link
          href={urlFor({ section: "" })}
          className={chipClass(!section)}
        >
          Todas
        </Link>
        {ATLAS_SECTIONS.map((s) => (
          <Link
            key={s}
            href={urlFor({ section: s })}
            className={chipClass(section === s)}
          >
            {ATLAS_SECTION_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Estado:</span>
        <Link
          href={urlFor({ status: "" })}
          className={chipClass(!status)}
        >
          Todos
        </Link>
        {ATLAS_ENTRY_STATUSES.map((s) => (
          <Link
            key={s}
            href={urlFor({ status: s })}
            className={chipClass(status === s)}
          >
            {ATLAS_ENTRY_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
          <p className="font-heading text-base">Sin entradas todavía</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea la primera entrada para arrancar la biblioteca.
          </p>
          <Button
            variant="cta"
            size="lg"
            className="mt-4 gap-1.5"
            render={<Link href={`${ROUTES.atlasAdmin}/new`} />}
          >
            <PlusIcon className="size-4" />
            Nueva entrada
          </Button>
        </div>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((entry) => (
              <li key={entry.id}>
                <AtlasEntryCard
                  entry={entry}
                  showSection
                  showStatus
                  href={`${ROUTES.atlasAdmin}/${entry.id}`}
                />
              </li>
            ))}
          </ul>
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
    </div>
  );
}

function chipClass(active: boolean): string {
  return active
    ? "rounded-full border border-transparent bg-foreground px-2.5 py-1 text-background"
    : "rounded-full border bg-card px-2.5 py-1 text-muted-foreground hover:bg-muted";
}
