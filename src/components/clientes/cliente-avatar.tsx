import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * 5 brand-tone palettes used to color the avatar fallback. We pick one
 * deterministically from the name so the same clienta always gets the same
 * colour — gives the list view a calm, organised feel.
 */
const TONES = [
  "bg-[#E7ECEA] text-[#4F605C]", // sage
  "bg-[#F6E0D6] text-[#8C4A30]", // terracota
  "bg-[#F8EFD7] text-[#7C5E1F]", // honey
  "bg-[#F0E2E0] text-[#7E4642]", // dusty rose
  "bg-[#E5EBE6] text-[#54665B]", // aquatone
] as const;

function pickTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return TONES[Math.abs(hash) % TONES.length];
}

function initials(name: string | null | undefined, fallback = "?"): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? fallback;
  return (
    (parts[0][0] ?? "").toUpperCase() + (parts[parts.length - 1][0] ?? "").toUpperCase()
  );
}

interface ClienteAvatarProps {
  name: string | null;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ClienteAvatarProps["size"]>, string> = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-11 text-sm",
  xl: "size-20 text-xl",
};

export function ClienteAvatar({
  name,
  imageUrl,
  size = "md",
  className,
}: ClienteAvatarProps) {
  const tone = pickTone(name ?? "?");
  return (
    <Avatar className={cn(SIZE_CLASSES[size], className)}>
      {imageUrl ? <AvatarImage src={imageUrl} alt={name ?? "Cliente"} /> : null}
      <AvatarFallback className={cn("font-medium", tone)}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
