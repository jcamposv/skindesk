"use client";

import { useFormContext, useWatch } from "react-hook-form";

import { Combobox } from "@/components/shared/combobox";
import { MultiCombobox } from "@/components/shared/multi-combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
 * Routine-level metadata block (above the steps list). Renders a compact
 * horizontal row of comboboxes (tipo de piel + etiquetas) plus the
 * objective/notes textareas. Controlled via RHF context so the parent's
 * `useForm` holds the canonical state. Each combobox uses `useWatch` to
 * subscribe only to the slice it cares about — minimizes re-renders.
 */
export function BuilderMeta() {
  const { register, setValue } = useFormContext<UpsertRutinaInput>();
  const skinType = useWatch<UpsertRutinaInput, "skinType">({ name: "skinType" });
  const tags = useWatch<UpsertRutinaInput, "tags">({ name: "tags" });

  const skinTypeOptions = PRODUCTO_SKIN_TYPES.map((s) => ({
    value: s,
    label: PRODUCTO_SKIN_TYPE_LABELS[s],
  }));
  const tagOptions = RUTINA_TAGS.map((t) => ({
    value: t,
    label: RUTINA_TAG_LABELS[t],
  }));

  return (
    <section className="grid gap-3 rounded-xl border bg-card p-4">
      {/* Compact dropdown row — replaces the chip grids. Skin type is
          single-select with a clear control; tags is multi-select with
          support for free-form custom additions (the column is `text[]`). */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo de piel">
          <Combobox
            options={skinTypeOptions}
            value={skinType ?? ""}
            onChange={(next) =>
              setValue("skinType", next, { shouldDirty: true })
            }
            placeholder="Seleccionar tipo de piel…"
            searchPlaceholder="Buscar tipo de piel…"
            ariaLabel="Tipo de piel"
            clearable
          />
        </Field>
        <Field label="Etiquetas de la rutina">
          <MultiCombobox
            options={tagOptions}
            value={tags}
            onChange={(next) => setValue("tags", next, { shouldDirty: true })}
            placeholder="Seleccionar etiquetas…"
            searchPlaceholder="Buscar o crear etiqueta…"
            ariaLabel="Etiquetas de la rutina"
            allowCustom
          />
        </Field>
      </div>

      {/* Objective + general notes */}
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <Field label="Objetivo principal">
          <Input
            {...register("mainObjective")}
            placeholder="Ej: Reducir brillo y controlar la grasa"
            className="h-10"
          />
        </Field>
        <Field label="Notas generales para la clienta">
          <Textarea
            {...register("generalNotes")}
            rows={2}
            placeholder="Recomendaciones globales que verá la clienta"
          />
        </Field>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-bold uppercase tracking-wider text-foreground/80">
        {label}
      </label>
      {children}
    </div>
  );
}
