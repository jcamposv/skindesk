import Image from "next/image";

import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg" | "xl";

/**
 * The brand asset is a logomark (icon + wordmark) at 111×42 (~2.64:1).
 * These sizes preserve that aspect ratio.
 */
const SIZE_PX: Record<LogoSize, { w: number; h: number }> = {
  sm: { w: 96, h: 36 },
  md: { w: 132, h: 50 },
  lg: { w: 176, h: 67 },
  xl: { w: 240, h: 91 },
};

interface LogoProps {
  size?: LogoSize;
  className?: string;
}

/**
 * Renders the SkinDesk logomark from /public/logo.svg.
 * The SVG is self-contained (icon + wordmark in brand colors) — do not append
 * extra text alongside it; that would duplicate the wordmark.
 */
export function Logo({ size = "md", className }: LogoProps) {
  const { w, h } = SIZE_PX[size];
  return (
    <Image
      src="/logo.svg"
      alt="SkinDesk"
      width={w}
      height={h}
      priority
      className={cn("shrink-0", className)}
    />
  );
}
