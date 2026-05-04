import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type BannerTone = "success" | "info" | "warning" | "destructive";

interface BannerProps {
  tone: BannerTone;
  /** Override the default icon for the tone. */
  icon?: LucideIcon;
  /**
   * Right-aligned slot — typically a `<BannerLink>` or any ReactNode the
   * caller wants. Compose, don't configure.
   */
  action?: ReactNode;
  /** Lays out as a strip across the parent. Add `rounded-*` etc. via className. */
  className?: string;
  children: ReactNode;
}

/**
 * Reusable persistent message strip. Use this for state that should stay
 * visible until something changes (subscription warnings, system status,
 * onboarding tips). For ephemeral feedback after an action, use sonner
 * toasts instead.
 *
 * Pure server-renderable — no JS shipped unless the consumer drops a
 * client component into the `action` slot.
 *
 * Decision rules:
 *  - `success`: positive confirmation that persists ("Cuenta verificada").
 *  - `info`:    neutral context ("Tu prueba expira en 5 días").
 *  - `warning`: needs attention but not critical ("Tu plan termina el X").
 *              Honey/cream — same tone as cancel-pending in the staff layout.
 *  - `destructive`: critical / failure / blocked ("Pago rechazado").
 */
export function Banner({
  tone,
  icon,
  action,
  className,
  children,
}: BannerProps) {
  const Icon = icon ?? DEFAULT_ICON[tone];
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b px-4 py-2 text-sm sm:flex-row sm:items-center sm:justify-between",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="leading-snug">{children}</p>
      </div>
      {action ? (
        <div className="self-start font-medium sm:self-auto">{action}</div>
      ) : null}
    </div>
  );
}

const DEFAULT_ICON: Record<BannerTone, LucideIcon> = {
  success: CheckCircle2Icon,
  info: InfoIcon,
  warning: AlertTriangleIcon,
  destructive: AlertTriangleIcon,
};

// Brand-aligned tones. Warning intentionally uses the artemis-honey
// palette (same one as the email accent + cancel-pending state), success
// uses sage soft, info uses neutral cool gray, destructive uses the
// shadcn destructive token.
const TONE_CLASSES: Record<BannerTone, string> = {
  success: "border-[#C9E2D1] bg-[#F1F7F3] text-[#2D5A3D]",
  info: "border-[#D5DCDF] bg-[#F4F6F7] text-[#2D4858]",
  warning: "border-[#EFD7C7] bg-[#FBF5EA] text-[#8A6A38]",
  destructive: "border-destructive/20 bg-destructive/10 text-destructive",
};

interface BannerLinkProps {
  href: string;
  children: ReactNode;
}

/**
 * Styled link convenience for the banner action slot. Trailing arrow,
 * underline-on-hover, inherits the banner's text colour so it tints with
 * the tone automatically.
 */
export function BannerLink({ href, children }: BannerLinkProps) {
  return (
    <Link
      href={href}
      className="underline-offset-4 hover:underline"
    >
      {children} →
    </Link>
  );
}
