"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  PRODUCTO_SKIN_TYPE_LABELS,
  PRODUCTO_SKIN_TYPES,
} from "@/schemas/productos.schema";
import {
  RUTINA_TAG_LABELS,
  RUTINA_TAGS,
  type UpsertRutinaInput,
} from "@/schemas/rutinas.schema";

/**
 * Routine-level metadata block (above the steps list). Skin type chips +
 * objective + tags. Controlled via RHF context so the parent's `useForm`
 * holds the canonical state. Each chip group uses `useWatch` to subscribe
 * only to the slice it cares about — minimizes re-renders.
 */
export function BuilderMeta() {
  const { register, setValue } = useFormContext<UpsertRutinaInput>();
  const skinType = useWatch<UpsertRutinaInput, "skinType">({ name: "skinType" });
  const tags = useWatch<UpsertRutinaInput, "tags">({ name: "tags" });

  function toggleSkin(value: string) {
    setValue("skinType", skinType === value ? "" : value, {
      shouldDirty: true,
    });
  }
  function toggleTag(value: string) {
    const next = tags.includes(value)
      ? tags.filter((t) => t !== value)
      : [...tags, value];
    setValue("tags", next, { shouldDirty: true });
  }
  function addCustomTag(raw: string) {
    const v = raw.trim();
    if (!v || tags.includes(v)) return;
    setValue("tags", [...tags, v], { shouldDirty: true });
  }
  function removeTag(value: string) {
    setValue(
      "tags",
      tags.filter((t) => t !== value),
      { shouldDirty: true },
    );
  }

  return (
    <section className="grid gap-3 rounded-xl border bg-card p-4">
      {/* Tags */}
      <div className="grid gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/80">
          Etiquetas de la rutina
        </p>
        <div className="flex flex-wrap gap-1.5">
          {RUTINA_TAGS.map((t) => (
            <TagChip
              key={t}
              label={RUTINA_TAG_LABELS[t]}
              active={tags.includes(t)}
              onClick={() => toggleTag(t)}
            />
          ))}
          {tags
            .filter((t) => !(RUTINA_TAGS as readonly string[]).includes(t))
            .map((custom) => (
              <span
                key={custom}
                className="inline-flex items-center gap-1 rounded-full border border-[#5C6E6C]/40 bg-[#E7ECEA] px-2.5 py-1 text-sm font-semibold text-[#4F605C]"
              >
                {custom}
                <button
                  type="button"
                  onClick={() => removeTag(custom)}
                  aria-label={`Quitar ${custom}`}
                  className="rounded-full p-0.5 hover:bg-foreground/5"
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))}
          <CustomTagInput onAdd={addCustomTag} />
        </div>
      </div>

      {/* Skin type chips */}
      <div className="grid gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/80">
          Tipo de piel
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRODUCTO_SKIN_TYPES.map((s) => (
            <TagChip
              key={s}
              label={PRODUCTO_SKIN_TYPE_LABELS[s]}
              active={skinType === s}
              onClick={() => toggleSkin(s)}
              tone="rose"
            />
          ))}
        </div>
      </div>

      {/* Objective + general notes */}
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-foreground/80">
            Objetivo principal
          </label>
          <Input
            {...register("mainObjective")}
            placeholder="Ej: Reducir brillo y controlar la grasa"
            className="h-10"
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-foreground/80">
            Notas generales para la clienta
          </label>
          <Textarea
            {...register("generalNotes")}
            rows={2}
            placeholder="Recomendaciones globales que verá la clienta"
          />
        </div>
      </div>
    </section>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

interface TagChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: "sage" | "rose";
}

function TagChip({ label, active, onClick, tone = "sage" }: TagChipProps) {
  const palette =
    tone === "rose"
      ? {
          on: "border-[#C58F8A] bg-[#F8EAE9] text-[#7B3D3D]",
          off: "border-border/70 bg-card text-foreground/75 hover:border-[#C58F8A]/50 hover:bg-[#F8EAE9]/40 hover:text-foreground",
        }
      : {
          on: "border-[#5C6E6C] bg-[#E7ECEA] text-[#4F605C]",
          off: "border-border/70 bg-card text-foreground/75 hover:border-[#5C6E6C]/50 hover:bg-[#F4F1EC] hover:text-foreground",
        };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
        active ? palette.on : palette.off,
      )}
    >
      {label}
    </button>
  );
}

function CustomTagInput({ onAdd }: { onAdd: (v: string) => void }) {
  return (
    <input
      type="text"
      placeholder="+ Etiqueta personalizada"
      className="rounded-full border border-dashed border-border/70 bg-card px-3 py-1.5 text-sm font-medium text-foreground placeholder:text-foreground/55 focus:border-[#5C6E6C] focus:outline-none focus:ring-2 focus:ring-[#5C6E6C]/30"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const v = (e.target as HTMLInputElement).value;
          if (v.trim()) {
            onAdd(v);
            (e.target as HTMLInputElement).value = "";
          }
        }
      }}
    />
  );
}
