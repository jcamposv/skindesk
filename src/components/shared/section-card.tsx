import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type SectionTone =
  | "sage" // identity / clinical (default)
  | "honey" // warnings / aparatology / contraindications
  | "aqua" // lifestyle / habits
  | "copper" // aesthetic / skin / treatments
  | "rose"; // hormonal / female / sensitive

export interface SectionCardProps {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  tone?: SectionTone;
  /** Optional element rendered in the card header right-aligned (e.g. a chip
   *  showing X/N completed, or a help tooltip trigger). */
  headerAccessory?: React.ReactNode;
  /** Optional id for anchor scroll-to from the quick-jump nav. */
  id?: string;
}

const TONE_CLASSES: Record<
  SectionTone,
  { iconBg: string; iconText: string; titleText: string }
> = {
  sage: {
    iconBg: "bg-[#E7ECEA]",
    iconText: "text-[#4F605C]",
    titleText: "text-[#4F605C]",
  },
  honey: {
    iconBg: "bg-[#F8EFD7]",
    iconText: "text-[#7C5E1F]",
    titleText: "text-[#7C5E1F]",
  },
  aqua: {
    iconBg: "bg-[#E2ECE5]",
    iconText: "text-[#4E7062]",
    titleText: "text-[#4E7062]",
  },
  copper: {
    iconBg: "bg-[#F6E0D6]",
    iconText: "text-[#8C4A30]",
    titleText: "text-[#8C4A30]",
  },
  rose: {
    iconBg: "bg-[#F8EAE9]",
    iconText: "text-[#7B3D3D]",
    titleText: "text-[#7B3D3D]",
  },
};

/**
 * Reusable card wrapper used across every wizard step. Tone categorizes the
 * card by content type so a profesional can scan the form visually:
 *  · sage    → identity / generic clinical
 *  · honey   → warnings, aparatology, contraindications
 *  · aqua    → lifestyle, habits
 *  · copper  → aesthetic, skin, treatments
 *  · rose    → hormonal / female-specific
 */
export function SectionCard({
  icon: Icon,
  title,
  hint,
  children,
  className,
  tone = "sage",
  headerAccessory,
  id,
}: SectionCardProps) {
  const t = TONE_CLASSES[tone];
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-32 rounded-2xl border bg-card p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      <header className="mb-4 flex items-center gap-2">
        {Icon ? (
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full",
              t.iconBg,
            )}
          >
            <Icon className={cn("size-3.5", t.iconText)} />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h3
            className={cn(
              "font-heading text-base font-semibold tracking-tight",
              t.titleText,
            )}
          >
            {title}
          </h3>
          <span className="h-px flex-1 bg-border/60" />
        </div>
        {headerAccessory ? (
          <div className="shrink-0">{headerAccessory}</div>
        ) : null}
      </header>
      {hint ? (
        <p className="-mt-2 mb-3 text-sm leading-relaxed text-foreground/75">{hint}</p>
      ) : null}
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
