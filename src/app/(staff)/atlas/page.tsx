import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenIcon, ClockIcon, SparklesIcon, StarIcon } from "lucide-react";

import {
  AtlasContentRow,
  AtlasContentRowItem,
} from "@/components/atlas/atlas-content-row";
import { AtlasEntryCard } from "@/components/atlas/atlas-entry-card";
import { AtlasSectionCard } from "@/components/atlas/atlas-section-card";
import { ROUTES } from "@/lib/constants";
import {
  listAtlasEntries,
  listAtlasFavorites,
  listAtlasSectionCounts,
  listRecentlyViewedEntries,
} from "@/services/atlas.service";

export const metadata: Metadata = { title: "Atlas dermocosmético" };
export const revalidate = 60;

export default async function AtlasLandingPage() {
  const [sections, featured, recentlyViewed, favorites] = await Promise.all([
    listAtlasSectionCounts(),
    listAtlasEntries({ pageSize: 12 }),
    listRecentlyViewedEntries(8),
    listAtlasFavorites(),
  ]);

  // Bento split: first 4 sections sit on a 4-col grid, last 3 sit on a
  // 3-col grid. Each row spans the full width with no orphan cells, so
  // the right edge no longer reads as wasted space.
  const sectionsRow1 = sections.slice(0, 4);
  const sectionsRow2 = sections.slice(4);
  const totalPublished = sections.reduce((n, s) => n + s.publishedCount, 0);

  return (
    <div className="grid gap-7">
      {/* Header — compact. Stat strip on the right surfaces "how much is
          there to read" so the page doesn't feel content-empty on first
          visit. */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1.5">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#EAE6DC] px-2.5 py-1 text-xs font-medium text-[#5C6E6C]">
            <BookOpenIcon className="size-3" />
            Biblioteca clínica
          </span>
          <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
            Atlas dermocosmético
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Tu referencia clínica curada: biotipos, estados cutáneos,
            escalas, activos y compatibilidades.
          </p>
        </div>
        {totalPublished > 0 ? (
          <div className="hidden flex-col items-end gap-0.5 sm:flex">
            <span className="font-heading text-2xl font-medium tabular-nums text-[#5C6E6C]">
              {totalPublished}
            </span>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {totalPublished === 1 ? "guía publicada" : "guías publicadas"}
            </span>
          </div>
        ) : null}
      </header>

      {/* Sections — bento 4 + 3. Compact horizontal cards. */}
      <section aria-label="Secciones del Atlas" className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Secciones</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sectionsRow1.map((s) => (
            <AtlasSectionCard
              key={s.section}
              section={s.section}
              publishedCount={s.publishedCount}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sectionsRow2.map((s) => (
            <AtlasSectionCard
              key={s.section}
              section={s.section}
              publishedCount={s.publishedCount}
            />
          ))}
        </div>
      </section>

      {/* Favoritos — scrollable strip. Hidden when the user has none. */}
      {favorites.length > 0 ? (
        <AtlasContentRow
          title={
            <>
              <StarIcon className="size-3.5 text-[#D2A96A]" />
              Tus favoritos
            </>
          }
        >
          {favorites.map((entry) => (
            <AtlasContentRowItem key={entry.id}>
              <AtlasEntryCard entry={entry} showSection />
            </AtlasContentRowItem>
          ))}
        </AtlasContentRow>
      ) : null}

      {/* Recientemente vistos por el usuario actual. */}
      {recentlyViewed.length > 0 ? (
        <AtlasContentRow
          title={
            <>
              <ClockIcon className="size-3.5" />
              Vistos recientemente
            </>
          }
        >
          {recentlyViewed.map((entry) => (
            <AtlasContentRowItem key={entry.id}>
              <AtlasEntryCard entry={entry} showSection />
            </AtlasContentRowItem>
          ))}
        </AtlasContentRow>
      ) : null}

      {/* Catálogo global de lo más nuevo. */}
      {featured.items.length > 0 ? (
        <AtlasContentRow
          title={
            <>
              <SparklesIcon
                className="size-3.5 text-[#D2A96A]"
                strokeWidth={2.25}
              />
              Publicaciones recientes
            </>
          }
          action={
            featured.totalItems > featured.items.length ? (
              <Link
                href={ROUTES.atlas}
                className="text-muted-foreground hover:text-foreground"
              >
                Ver todas →
              </Link>
            ) : null
          }
        >
          {featured.items.map((entry) => (
            <AtlasContentRowItem key={entry.id}>
              <AtlasEntryCard entry={entry} showSection />
            </AtlasContentRowItem>
          ))}
        </AtlasContentRow>
      ) : null}
    </div>
  );
}
