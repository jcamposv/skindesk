import { SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface DashboardHeroProps {
  /** Full name from the profile — only the first token is shown. */
  name: string;
  /** Greeting line under the heading. */
  subtitle?: string;
  /** Optional emphasised greeting prefix. Defaults to "¡Bienvenida(o)". */
  greeting?: string;
  className?: string;
}

/**
 * Branded welcome banner used at the top of dashboards. The artemis-honey
 * sparkle echoes the eyebrow accent in transactional emails so the staff
 * UI feels like the same brand surface, not a separate product.
 *
 * Server Component on purpose — there's no interactivity, and dashboards
 * are server-rendered so this should not ship JS to the client.
 */
export function DashboardHero({
  name,
  subtitle,
  greeting = "¡Bienvenida(o)",
  className,
}: DashboardHeroProps) {
  // Greeting feels personal when it's just the first name — "¡Bienvenida(o),
  // Carla!" reads warmer than "¡Bienvenida(o), Carla Pérez González!"
  const firstName = name.trim().split(/\s+/)[0];

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
        {greeting}, {firstName}!
        <SparklesIcon
          className="size-6 text-[#D2A96A]"
          aria-hidden
          strokeWidth={2.25}
        />
      </h1>
      {subtitle ? (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}
