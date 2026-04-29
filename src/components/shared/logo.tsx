import Image from "next/image";

import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";
type LogoVariant = "default" | "sidebar";

const SIZE_PX: Record<LogoSize, { w: number; h: number; text: string }> = {
  sm: { w: 24, h: 24, text: "text-sm" },
  md: { w: 32, h: 32, text: "text-base" },
  lg: { w: 48, h: 48, text: "text-xl" },
};

interface LogoProps {
  size?: LogoSize;
  variant?: LogoVariant;
  withWordmark?: boolean;
  className?: string;
}

/**
 * SkinDesk brand mark. Renders /public/logo.svg via next/image and optionally
 * the wordmark next to it. Adapts text color to its container (sidebar vs default).
 */
export function Logo({
  size = "md",
  variant = "default",
  withWordmark = true,
  className,
}: LogoProps) {
  const { w, h, text } = SIZE_PX[size];
  const wordmarkColor =
    variant === "sidebar" ? "text-sidebar-foreground" : "text-foreground";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/logo.svg"
        alt={`${APP_NAME} logo`}
        width={w}
        height={h}
        priority
        className="shrink-0"
      />
      {withWordmark ? (
        <span className={cn("font-semibold tracking-tight", text, wordmarkColor)}>
          {APP_NAME}
        </span>
      ) : null}
    </div>
  );
}
