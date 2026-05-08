import type { LucideIcon } from "lucide-react";
import { ClockIcon } from "lucide-react";

interface EmptyTabProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Bullet list of what this section will hold once wired. */
  preview?: string[];
  /** Override the "Próximamente" pill copy. */
  pill?: string;
}

/**
 * Premium placeholder for the 9 tabs that ship in Phase 2. Same visual
 * grammar as the rest of the app — hero card with icon, copy, and a faint
 * preview of the section structure so the cosmetóloga can see what will
 * land here. Avoid loud "TODO" or empty pages.
 */
export function EmptyTab({
  icon: Icon,
  title,
  description,
  preview,
  pill = "Próximamente",
}: EmptyTabProps) {
  return (
    <div className="grid gap-4">
      <header className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-6">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#F4F1EC] text-[#5C6E6C]">
            <Icon className="size-6" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-medium tracking-tight">
                {title}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F8EFD7] px-2.5 py-1 text-[11px] font-medium text-[#7C5E1F]">
                <ClockIcon className="size-3" />
                {pill}
              </span>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </header>

      {preview && preview.length > 0 ? (
        <section
          aria-label="Vista previa de la sección"
          className="grid gap-3 rounded-2xl border border-dashed bg-card/50 p-5 sm:p-6"
        >
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Acá vas a poder
          </h3>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {preview.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 rounded-xl bg-[#FBF9F4] px-3.5 py-3 text-sm text-foreground/80"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#BB7154]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
