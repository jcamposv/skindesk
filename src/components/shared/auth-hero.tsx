import Image from "next/image";

interface AuthHeroProps {
  /** Big tagline rendered toward the bottom of the panel. */
  headline: string;
  /** Supporting copy under the tagline. */
  subline: string;
  /** Hero image src under /public. Defaults to /login-hero.jpg. */
  imageSrc?: string;
  /** Alt text for the hero image. */
  imageAlt?: string;
}

/**
 * Editorial brand panel used on the left side of /login and /register on lg+
 * screens. Pattern follows premium skincare/beauty hero style:
 *  • full-bleed photography (object-cover)
 *  • white monochrome logomark via CSS filter (brightness(0) invert(1))
 *  • subtle top scrim for logo, generous bottom scrim for tagline
 */
export function AuthHero({
  headline,
  subline,
  imageSrc = "/login-hero1.jpg",
  imageAlt = "",
}: AuthHeroProps) {
  return (
    <aside className="relative hidden overflow-hidden bg-sidebar lg:flex">
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        priority
        sizes="50vw"
        className="object-cover object-[center_35%]"
      />
      {/* Light top scrim — anchors the white logomark without darkening the photo */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-black/45 to-transparent"
      />
      {/* Editorial bottom scrim — supports the tagline with a deep, smooth fade */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
      />

      <div className="relative z-10 flex h-full w-full flex-col items-start justify-between p-12">
        <Image
          src="/logo.svg"
          alt="SkinDesk"
          width={220}
          height={84}
          priority
          className="h-16 w-auto [filter:brightness(0)_invert(1)]"
        />

        <div className="max-w-2xl space-y-4">
          <h2 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-white">
            {headline}
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-white/85">
            {subline}
          </p>
        </div>
      </div>
    </aside>
  );
}
