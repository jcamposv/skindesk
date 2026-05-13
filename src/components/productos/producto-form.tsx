"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertCircleIcon,
  BeakerIcon,
  CalendarClockIcon,
  CameraIcon,
  ClipboardListIcon,
  DropletIcon,
  PackageIcon,
  PlusIcon,
  TagIcon,
  XIcon,
} from "lucide-react";

import {
  createProductoAction,
  updateProductoAction,
} from "@/actions/productos.actions";
import { Chip } from "@/components/ui/chip";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  PRODUCTO_ABSORPTION_LABELS,
  PRODUCTO_ABSORPTION_TIMES,
  PRODUCTO_CATEGORIA_LABELS,
  PRODUCTO_CATEGORIAS,
  PRODUCTO_FORM_DEFAULTS,
  PRODUCTO_FREQUENCIES,
  PRODUCTO_FREQUENCY_LABELS,
  PRODUCTO_SKIN_TYPE_LABELS,
  PRODUCTO_SKIN_TYPES,
  PRODUCTO_TAG_LABELS,
  PRODUCTO_TAGS,
  PRODUCTO_TIEMPO_DIA,
  PRODUCTO_TIEMPO_DIA_LABELS,
  upsertProductoSchema,
  type ProductoCategoria,
  type ProductoSkinType,
  type ProductoTag,
  type UpsertProductoInput,
} from "@/schemas/productos.schema";

import { ProductoPhotoUpload } from "./producto-photo-upload";

/** Stable id so the Sheet footer button can submit the form via form="…". */
export const PRODUCTO_FORM_ID = "producto-form";

interface ProductoFormProps {
  tenantId: string;
  /** Empty/new draft id when creating; existing product id when editing. */
  productoId: string;
  /** When set, the form pre-fills and persists via update; otherwise create. */
  initial?: UpsertProductoInput & {
    photoUrl?: string | null;
    photoPath?: string | null;
  };
  /** Editing flag drives the action choice and toast copy. */
  isEdit?: boolean;
  /** Existing produkt id when editing — passed to updateProductoAction. */
  existingProductoId?: string;
  /** Called after a successful create/update so the Sheet can close. */
  onSuccess?: () => void;
  /** Lifted submission state so the footer button can disable itself. */
  onPendingChange?: (pending: boolean) => void;
}

/**
 * Single source of truth for the catalog form. RHF + Zod — same pattern as
 * `create-cliente-form.tsx`. Sections split by `<Section>` for visual
 * grouping; the schema is flat so server-side error mapping stays trivial.
 *
 * Photo upload runs browser-side (see `ProductoPhotoUpload`) and writes the
 * resulting `photoPath` into the form state. The server action persists
 * only the path.
 */
export function ProductoForm({
  tenantId,
  productoId,
  initial,
  isEdit = false,
  existingProductoId,
  onSuccess,
  onPendingChange,
}: ProductoFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    initial?.photoUrl ?? null,
  );

  const form = useForm<UpsertProductoInput>({
    resolver: zodResolver(upsertProductoSchema),
    defaultValues: initial ?? PRODUCTO_FORM_DEFAULTS,
  });

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  // `useWatch` is the React-Compiler-friendly variant of `form.watch()` —
  // each call subscribes to a specific field via the form's control.
  const category = useWatch({
    control: form.control,
    name: "category",
  }) as ProductoCategoria;
  const mainIngredients = useWatch({
    control: form.control,
    name: "mainIngredients",
  });
  const skinTypes = useWatch({
    control: form.control,
    name: "skinTypes",
  });
  const customSkinTypes = useWatch({
    control: form.control,
    name: "customSkinTypes",
  });
  const additionalTags = useWatch({
    control: form.control,
    name: "additionalTags",
  });
  const conflictingIngredients = useWatch({
    control: form.control,
    name: "conflictingIngredients",
  });
  const photoPath = useWatch({
    control: form.control,
    name: "photoPath",
  });

  function onSubmit(values: UpsertProductoInput) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", values.name);
      fd.set("brand", values.brand ?? "");
      fd.set("category", values.category);
      fd.set("photoPath", values.photoPath ?? "");
      fd.set("ingredientsInci", values.ingredientsInci ?? "");
      fd.set("applicationInstruction", values.applicationInstruction ?? "");
      fd.set("suggestedAmount", values.suggestedAmount ?? "");
      fd.set("absorptionTime", values.absorptionTime ?? "");
      fd.set("timeOfDay", values.timeOfDay ?? "");
      fd.set("frequency", values.frequency ?? "");
      fd.set("precautions", values.precautions ?? "");
      fd.set("clinicalNotes", values.clinicalNotes ?? "");
      for (const ing of values.mainIngredients) fd.append("mainIngredients", ing);
      for (const st of values.skinTypes) fd.append("skinTypes", st);
      for (const cst of values.customSkinTypes)
        fd.append("customSkinTypes", cst);
      for (const tag of values.additionalTags) fd.append("additionalTags", tag);
      for (const c of values.conflictingIngredients)
        fd.append("conflictingIngredients", c);

      const result =
        isEdit && existingProductoId
          ? await updateProductoAction(existingProductoId, null, fd)
          : await createProductoAction(null, fd);

      if (!result.success) {
        toast.error(result.message ?? "No se pudo guardar el producto.");
        if (result.errors) {
          for (const [field, messages] of Object.entries(result.errors)) {
            const msg = messages?.[0];
            if (msg) {
              form.setError(field as keyof UpsertProductoInput, {
                type: "server",
                message: msg,
              });
            }
          }
        }
        return;
      }

      toast.success(
        result.message ?? (isEdit ? "Cambios guardados." : "Producto creado."),
      );
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form
        id={PRODUCTO_FORM_ID}
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-6"
      >
        {/* A — Información básica */}
        <Section
          title="Información básica"
          description="Identidad del producto."
          icon={PackageIcon}
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="The Ordinary Niacinamide 10%"
                    className="h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marca</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="The Ordinary, ISDIN, …"
                      className="h-10"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría *</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#5C6E6C]/30"
                    >
                      {PRODUCTO_CATEGORIAS.map((c) => (
                        <option key={c} value={c}>
                          {PRODUCTO_CATEGORIA_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        {/* B — Foto */}
        <Section
          title="Foto del producto"
          description="Opcional. Si no subes foto, mostramos una ilustración."
          icon={CameraIcon}
        >
          <ProductoPhotoUpload
            tenantId={tenantId}
            productoId={existingProductoId ?? productoId}
            currentUrl={photoUrl}
            currentPath={photoPath || null}
            fallbackCategory={category}
            onChange={({ path, url }) => {
              form.setValue("photoPath", path ?? "", { shouldDirty: true });
              setPhotoUrl(url);
            }}
          />
        </Section>

        {/* C — Ingredientes */}
        <Section
          title="Ingredientes"
          description="Hasta 3 ingredientes principales — aparecen como tags."
          icon={BeakerIcon}
        >
          <MainIngredientsField
            value={mainIngredients}
            onChange={(next) =>
              form.setValue("mainIngredients", next, { shouldDirty: true })
            }
          />
          <FormField
            control={form.control}
            name="ingredientsInci"
            render={({ field }) => (
              <FormItem>
                <FormLabel>INCI completo (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="Aqua, Niacinamide, Zinc PCA, Pentylene Glycol …"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        {/* D — Tipo de piel */}
        <Section
          title="Tipo de piel recomendado"
          description="Toca los chips. Si marcás 'Todas', se seleccionan todos."
          icon={DropletIcon}
        >
          <SkinTypesField
            value={skinTypes as ProductoSkinType[]}
            customValue={customSkinTypes}
            onChange={(next, custom) => {
              form.setValue("skinTypes", next, { shouldDirty: true });
              form.setValue("customSkinTypes", custom, { shouldDirty: true });
            }}
          />
        </Section>

        {/* E — Instrucciones */}
        <Section
          title="Instrucciones de uso"
          description="Cómo aplicar y con qué frecuencia."
          icon={CalendarClockIcon}
        >
          <FormField
            control={form.control}
            name="applicationInstruction"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Instrucción general</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="Aplicar sobre piel limpia y seca, evitando contorno de ojos."
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Cantidad sugerida — fila propia. El placeholder es largo
              ("tamaño de una arveja") y los profesionales suelen escribir
              instrucciones específicas. */}
          <FormField
            control={form.control}
            name="suggestedAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cantidad sugerida</FormLabel>
                <FormControl>
                  <Input
                    placeholder="3-4 gotas, tamaño de una arveja…"
                    className="h-10"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Selects: 1 por fila para que los labels no se corten en 2
              líneas ("Tiempo de absorción", "Momento del día") y la lectura
              quede más limpia. */}
          <div className="grid items-start gap-4">
            <FormField
              control={form.control}
              name="absorptionTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tiempo de absorción</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      value={field.value ?? ""}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#5C6E6C]/30"
                    >
                      <option value="">—</option>
                      {PRODUCTO_ABSORPTION_TIMES.map((a) => (
                        <option key={a} value={a}>
                          {PRODUCTO_ABSORPTION_LABELS[a]}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timeOfDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Momento del día</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      value={field.value ?? ""}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#5C6E6C]/30"
                    >
                      <option value="">—</option>
                      {PRODUCTO_TIEMPO_DIA.map((t) => (
                        <option key={t} value={t}>
                          {PRODUCTO_TIEMPO_DIA_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frecuencia</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      value={field.value ?? ""}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#5C6E6C]/30"
                    >
                      <option value="">—</option>
                      {PRODUCTO_FREQUENCIES.map((f) => (
                        <option key={f} value={f}>
                          {PRODUCTO_FREQUENCY_LABELS[f]}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        {/* F — Etiquetas */}
        <Section
          title="Etiquetas adicionales"
          description="Atributos del producto: beneficios, restricciones, claims."
          icon={TagIcon}
        >
          <TagsField
            value={additionalTags as ProductoTag[]}
            onChange={(next) =>
              form.setValue("additionalTags", next, { shouldDirty: true })
            }
          />
        </Section>

        {/* G — Notas clínicas */}
        <Section
          title="Notas clínicas"
          description="Solo visibles para ti — nunca se muestran a la clienta."
          icon={ClipboardListIcon}
        >
          <FormField
            control={form.control}
            name="precautions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precauciones / contraindicaciones</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="Evitar en embarazo. Evitar con piel agrietada."
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <ConflictingIngredientsField
            value={conflictingIngredients}
            onChange={(next) =>
              form.setValue("conflictingIngredients", next, {
                shouldDirty: true,
              })
            }
          />
          <FormField
            control={form.control}
            name="clinicalNotes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notas adicionales</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="Comportamiento en piel sensible, observaciones clínicas…"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>
      </form>
    </Form>
  );
}

// ─── Shared "+ Agregar" pill button ─────────────────────────────────────────

/**
 * Used by the custom skin-type input and the conflicting-ingredients input.
 * Copper tone matches the SkinDesk accent palette; the disabled state has
 * no hover lift so it reads as "nothing to add yet" without looking broken.
 */
function AddPillButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-[#BB7154]/30 bg-[#FBEFE7] px-3 text-xs font-semibold text-[#8C4A30] shadow-sm transition-all",
        "hover:border-[#BB7154]/60 hover:bg-[#F6E0D6] hover:shadow active:translate-y-px",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB7154]/40 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/40 disabled:text-muted-foreground disabled:shadow-none",
      )}
    >
      <span className="flex size-4 items-center justify-center rounded-full bg-[#BB7154]/15 text-[#8C4A30]">
        <PlusIcon className="size-3" strokeWidth={2.5} />
      </span>
      Agregar
    </button>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

function Section({ title, description, icon: Icon, children }: SectionProps) {
  return (
    <section className="grid gap-3">
      <header className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-3.5" />
        </span>
        <div>
          <h3 className="font-heading text-sm font-medium">{title}</h3>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

// ─── Main ingredients (3 inline inputs + live tag preview) ──────────────────

function MainIngredientsField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const slots = useMemo(() => {
    const filled = [...value];
    while (filled.length < 3) filled.push("");
    return filled.slice(0, 3);
  }, [value]);

  function setSlot(idx: number, raw: string) {
    const next = [...slots];
    next[idx] = raw;
    onChange(next.map((s) => s.trim()).filter((s) => s.length > 0));
  }

  return (
    <div className="grid gap-3">
      {/* One per row so cada ingrediente tiene espacio cómodo para escribir
          el nombre completo (algunos INCI son largos: "Sodium Hyaluronate
          Crosspolymer-2"). El badge numerado interno reemplaza al
          placeholder cuando ya hay texto, manteniendo el orden visible. */}
      <div className="grid gap-2">
        {slots.map((slot, idx) => (
          <div key={idx} className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-[#F6E0D6] text-[10px] font-semibold text-[#8C4A30]"
            >
              {idx + 1}
            </span>
            <Input
              placeholder={`Ingrediente principal ${idx + 1}`}
              className="h-10 pl-9"
              value={slot}
              onChange={(e) => setSlot(idx, e.target.value)}
              maxLength={80}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {value.length > 0 ? (
          value.map((ing) => (
            <span
              key={ing}
              className="rounded-full border border-[#BB7154]/30 bg-[#FBEFE7] px-2 py-0.5 text-[11px] font-medium text-[#8C4A30]"
            >
              {ing}
            </span>
          ))
        ) : (
          <span className="text-[11px] text-muted-foreground">
            Vista previa de tags
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Skin types ─────────────────────────────────────────────────────────────

function SkinTypesField({
  value,
  customValue,
  onChange,
}: {
  value: ProductoSkinType[];
  customValue: string[];
  onChange: (next: ProductoSkinType[], custom: string[]) => void;
}) {
  const [customDraft, setCustomDraft] = useState("");
  const allSelected =
    value.length === PRODUCTO_SKIN_TYPES.length &&
    PRODUCTO_SKIN_TYPES.every((t) => value.includes(t));

  function toggle(skin: ProductoSkinType) {
    const next = value.includes(skin)
      ? value.filter((s) => s !== skin)
      : [...value, skin];
    onChange(next, customValue);
  }
  function toggleAll() {
    onChange(allSelected ? [] : [...PRODUCTO_SKIN_TYPES], customValue);
  }
  function addCustom() {
    const v = customDraft.trim();
    if (!v) return;
    if (customValue.includes(v)) return;
    onChange(value, [...customValue, v]);
    setCustomDraft("");
  }
  function removeCustom(v: string) {
    onChange(
      value,
      customValue.filter((c) => c !== v),
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Chip pressed={allSelected} onPressedChange={toggleAll} tone="sage">
          Todas
        </Chip>
        {PRODUCTO_SKIN_TYPES.map((skin) => (
          <Chip
            key={skin}
            pressed={value.includes(skin)}
            onPressedChange={() => toggle(skin)}
            tone="sage"
          >
            {PRODUCTO_SKIN_TYPE_LABELS[skin]}
          </Chip>
        ))}
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          Otros tipos de piel
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {customValue.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded-full border border-[#5C6E6C]/30 bg-[#E7ECEA] px-2 py-0.5 text-[11px] text-[#4F605C]"
            >
              {c}
              <button
                type="button"
                onClick={() => removeCustom(c)}
                className="rounded-full p-0.5 hover:bg-foreground/5"
                aria-label={`Quitar ${c}`}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            placeholder="Otro tipo de piel"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            className="h-10 flex-1"
            maxLength={40}
          />
          <AddPillButton onClick={addCustom} disabled={!customDraft.trim()} />
        </div>
      </div>
    </div>
  );
}

// ─── Additional tags ────────────────────────────────────────────────────────

function TagsField({
  value,
  onChange,
}: {
  value: ProductoTag[];
  onChange: (next: ProductoTag[]) => void;
}) {
  function toggle(tag: ProductoTag) {
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {PRODUCTO_TAGS.map((tag) => (
        <Chip
          key={tag}
          pressed={value.includes(tag)}
          onPressedChange={() => toggle(tag)}
          tone="honey"
          size="sm"
        >
          {PRODUCTO_TAG_LABELS[tag]}
        </Chip>
      ))}
    </div>
  );
}

// ─── Conflicting ingredients (free-text chips) ──────────────────────────────

function ConflictingIngredientsField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v || value.includes(v)) return;
    onChange([...value, v]);
    setDraft("");
  }
  function remove(v: string) {
    onChange(value.filter((c) => c !== v));
  }
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2 text-xs font-medium">
        <AlertCircleIcon className="size-3.5 text-[#BB7154]" />
        Ingredientes/productos en conflicto
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 rounded-full border border-[#BB7154]/40 bg-[#FBEFE7] px-2 py-0.5 text-[11px] text-[#8C4A30]"
          >
            {c}
            <button
              type="button"
              onClick={() => remove(c)}
              className="rounded-full p-0.5 hover:bg-foreground/5"
              aria-label={`Quitar ${c}`}
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Retinol, AHA, Vitamina C…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="h-10 flex-1"
          maxLength={120}
        />
        <AddPillButton onClick={add} disabled={!draft.trim()} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        El builder de rutinas usará esto para advertir si dos productos no se
        deberían combinar.
      </p>
    </div>
  );
}
