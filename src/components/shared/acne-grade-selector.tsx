"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

export type AcneGrade = 1 | 2 | 3 | 4;

const GRADES: ReadonlyArray<AcneGrade> = [1, 2, 3, 4] as const;

const ROMAN: Record<AcneGrade, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
};

const DEFAULT_DESCRIPTIONS: Record<AcneGrade, string> = {
  1: "Comedones, mínima inflamación",
  2: "Pápulas y pústulas, inflamación moderada",
  3: "Lesiones extensas, riesgo cicatricial",
  4: "Nódulos y quistes, manejo médico",
};

interface AcneGradeSelectorProps {
  value: AcneGrade | null;
  /** Receives the picked grade, or `null` when the active card is clicked
   *  again (toggle-off). Caller decides whether `null` is allowed by the
   *  schema — the selector simply emits the user's intent. */
  onChange: (next: AcneGrade | null) => void;
  /** Override the per-grade descriptions. Defaults to the SkinDesk
   *  evaluation copy ("Comedones, mínima inflamación", etc.). */
  descriptions?: Partial<Record<AcneGrade, string>>;
  ariaLabel?: string;
  className?: string;
}

export function AcneGradeSelector({
  value,
  onChange,
  descriptions,
  ariaLabel = "Grado de acné",
  className,
}: AcneGradeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}
    >
      {GRADES.map((grade) => {
        const active = value === grade;
        const description = descriptions?.[grade] ?? DEFAULT_DESCRIPTIONS[grade];
        return (
          <button
            key={grade}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? null : grade)}
            className={cn(
              "group flex flex-col items-center gap-2 rounded-xl border p-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58F8A]/60 focus-visible:ring-offset-1",
              active
                ? "border-2 border-[#C58F8A] bg-[#F8EAE9]"
                : "border-border/60 bg-card hover:border-foreground/20",
            )}
          >
            <div className="relative h-20 w-20 overflow-hidden rounded-lg bg-[#FBEFE7]/40">
              <Image
                src={`/acne/acne-grado-${grade}.png`}
                alt=""
                fill
                sizes="80px"
                className="object-contain"
                priority={active}
              />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#7B3D3D]">
              Grado {ROMAN[grade]}
            </div>
            <p className="text-xs leading-snug text-foreground/80">
              {description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
