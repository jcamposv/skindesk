import Image from "next/image";

import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg" | "xl";
type LogoVariant = "color" | "white";

/**
 * Each variant is a horizontal lockup tinted for the surface it sits on:
 *  - color: icon + wordmark in brand colors (111×42, ~2.64:1) for light bg.
 *  - white: icon-in-brand + wordmark-in-white (389×157, ~2.48:1) for dark bg.
 */
const VARIANT: Record<LogoVariant, { src: string; aspect: number }> = {
  color: { src: "/logo.svg", aspect: 111 / 42 },
  white: { src: "/logo-white.svg", aspect: 388.62 / 156.6 },
};

const HEIGHT_PX: Record<LogoSize, number> = {
  sm: 36,
  md: 50,
  lg: 67,
  xl: 76,
};

interface LogoProps {
  size?: LogoSize;
  variant?: LogoVariant;
  className?: string;
}

/**
 * Renders the SkinDesk logomark. Use `variant="white"` on dark surfaces (the
 * sidebar, the auth hero panel) — the file already ships in brand-on-white,
 * no CSS filters needed.
 */
export function Logo({ size = "md", variant = "color", className }: LogoProps) {
  const { src, aspect } = VARIANT[variant];
  const h = HEIGHT_PX[size];
  const w = Math.round(h * aspect);
  return (
    <Image
      src={src}
      alt="SkinDesk"
      width={w}
      height={h}
      priority
      className={cn("shrink-0", className)}
    />
  );
}
