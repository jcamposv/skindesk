import type { ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface PersonRowProps {
  name: string;
  /** Smaller line under the name — service for upcoming appts, visit count for new clients, etc. */
  detail?: string;
  /**
   * Right-aligned slot — time chip for upcoming appts, status badge, anything.
   * ReactNode so callers can ship their own styling.
   */
  meta?: ReactNode;
  /** Optional avatar image URL. Falls back to initials computed from `name`. */
  avatarSrc?: string;
  /** Override the auto-derived initials (e.g. "MG" instead of taking first letters). */
  initials?: string;
  /** Tone for the avatar fallback bg — keeps lists visually varied. */
  avatarTone?: "balsam" | "aquatone" | "artemis" | "dustyRose";
  className?: string;
}

const AVATAR_TONE_BG: Record<NonNullable<PersonRowProps["avatarTone"]>, string> = {
  balsam: "bg-[#5C6E6C] text-white",
  aquatone: "bg-[#A6B7AA] text-white",
  artemis: "bg-[#D2A96A] text-white",
  dustyRose: "bg-[#C58F8A] text-white",
};

/**
 * Avatar + two-line text + optional meta slot. Reused by Próximas citas
 * (where `detail` is the service and `meta` is the time) and by Clientes
 * nuevos (where `detail` is the visit count and `meta` is empty). Add new
 * lists by composing this row inside a `DashboardSection` — no need for a
 * new primitive.
 */
export function PersonRow({
  name,
  detail,
  meta,
  avatarSrc,
  initials,
  avatarTone = "aquatone",
  className,
}: PersonRowProps) {
  const fallback = initials ?? deriveInitials(name);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar className="size-9 shrink-0">
        {avatarSrc ? <AvatarImage src={avatarSrc} alt={name} /> : null}
        <AvatarFallback
          className={cn("text-xs font-semibold", AVATAR_TONE_BG[avatarTone])}
        >
          {fallback}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        {detail ? (
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        ) : null}
      </div>
      {meta ? <div className="shrink-0 text-xs">{meta}</div> : null}
    </div>
  );
}

function deriveInitials(name: string): string {
  // First two name tokens — "María Gómez" → "MG", "Ana" → "A".
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
