import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Top hero — dark "magazine spread" band. Designed to share its background
 * with the page header above (so the nav reads as part of the same dark
 * band, not a stitched-together patch). Wrap the header + this component
 * in a single `<div className="bg-[#4A5A55] text-white">` at the page
 * level to get that effect.
 *
 * Swap the photo by replacing `/public/landing-hero.jpg`.
 */
const HERO_IMAGE_URL = "/landing-hero.jpg";

const HERO_IMAGE_ALT =
  "Profesional sonriendo con crema facial — fotografía editorial de cuidado de piel";

export function LandingHero() {
  return (
    <section className="relative isolate w-full">
      <div className="relative grid items-center gap-12 px-6 py-16 md:grid-cols-[1.05fr_1fr] md:gap-16 md:px-10 md:py-20 lg:gap-20 lg:py-24">
        {/* Left — copy + CTA */}
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D2A96A]/15 px-3 py-1 text-xs font-medium text-[#F0DAB1] ring-1 ring-[#D2A96A]/40 backdrop-blur">
            <SparklesIcon className="size-3 text-[#D2A96A]" aria-hidden />
            Software clínico para cosmetología
          </span>

          <h1 className="mt-6 text-balance text-5xl font-medium leading-[1.05] tracking-tight text-white md:text-6xl lg:text-7xl">
            Gestiona tu clínica de{" "}
            <span className="relative inline-block">
              piel
              <svg
                aria-hidden
                viewBox="0 0 220 18"
                className="absolute -bottom-2 left-0 h-3 w-full text-[#D2A96A]"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 12 C 60 2, 150 2, 218 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            con propósito.
          </h1>

          <p className="mt-7 max-w-lg text-base text-white/75 md:text-lg">
            Agenda, fichas de clientas, catálogo de productos y reportes — en
            un solo lugar. 14 días de prueba; sin permanencia, cancela cuando
            quieras.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button variant="cta" size="lg" render={<Link href="#planes" />}>
              Empezar gratis
              <ArrowRightIcon className="size-4" aria-hidden />
            </Button>
            <Link
              href="#planes"
              className="text-sm font-medium text-white/75 underline-offset-4 hover:text-white hover:underline"
            >
              Ver planes y precios
            </Link>
          </div>

          <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-white/15 pt-6">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-white/55">
                Profesionales
              </dt>
              <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-white">
                +200
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-white/55">
                Citas / mes
              </dt>
              <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-white">
                +12k
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-white/55">
                Soporte
              </dt>
              <dd className="mt-1 text-xl font-semibold tracking-tight text-white">
                Humano
              </dd>
            </div>
          </dl>
        </div>

        {/* Right — photo card. Capped with `max-h` so it never escapes
         *  the dark band on wide viewports. */}
        <div className="relative mx-auto w-full max-w-xl md:mx-0">
          <Sparkle className="absolute -top-3 left-2 z-10 size-7 text-[#D2A96A]/80" />
          <Sparkle className="absolute top-16 -right-3 z-10 size-4 text-white/60" />
          <Sparkle className="absolute -bottom-3 right-10 z-10 size-5 text-[#D2A96A]" />
          <Sparkle className="absolute bottom-24 -left-4 z-10 size-3 text-white/50" />

          <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] bg-black/20 shadow-2xl ring-1 ring-white/10">
            <Image
              src={HERO_IMAGE_URL}
              alt={HERO_IMAGE_ALT}
              fill
              priority
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover object-[60%_center]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[#4A5A55] mix-blend-multiply opacity-15"
            />

            <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-full bg-white/95 px-3 py-2 shadow-lg ring-1 ring-black/5 backdrop-blur md:bottom-6 md:left-6">
              <span className="grid size-9 place-items-center rounded-full bg-[#EEF3F1]">
                <SparklesIcon
                  className="size-4 text-[#5C6E6C]"
                  strokeWidth={2}
                  aria-hidden
                />
              </span>
              <div className="pr-2 text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground/75">
                  Nuevo
                </p>
                <p className="text-sm font-medium text-foreground">
                  Atlas dermocosmético
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" />
    </svg>
  );
}
