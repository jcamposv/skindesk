"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  Loader2Icon,
  SparklesIcon,
  XIcon,
} from "lucide-react";

import {
  checkSlugAvailableAction,
  createAtlasEntryAction,
  updateAtlasEntryAction,
} from "@/actions/atlas.actions";
import { AtlasCoverUpload } from "@/components/atlas/admin/atlas-cover-upload";
import { AtlasStatusSegmented } from "@/components/atlas/admin/atlas-status-segmented";
import { AtlasMarkdown } from "@/components/atlas/atlas-markdown";
import { Button } from "@/components/ui/button";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  ATLAS_ENTRY_FORM_DEFAULTS,
  ATLAS_SECTIONS,
  ATLAS_SECTION_LABELS,
  slugifyTitle,
  upsertAtlasEntrySchema,
  type AtlasEntryStatus,
  type AtlasSection,
  type UpsertAtlasEntryInput,
} from "@/schemas/atlas.schema";

export const ATLAS_ENTRY_FORM_ID = "atlas-entry-form";

interface AtlasEntryFormProps {
  entryId: string;
  isEdit?: boolean;
  initial?: UpsertAtlasEntryInput & {
    /** Signed URL for the existing cover. Read-only; the persisted value
     *  is `coverPath` which lives inside `UpsertAtlasEntryInput`. */
    coverUrl?: string | null;
  };
  /** Existing tags across the Atlas — drives the datalist autocomplete in
   *  the tag field. Passed by the page Server Component. */
  existingTags?: readonly string[];
}

/**
 * CMS form for an Atlas entry.
 *
 *   - create: caller passes a freshly minted UUID as `entryId`; the form
 *     ships that id alongside the payload so the new row uses it as the
 *     primary key — the storage prefix the uploader wrote to
 *     (`entries/<entryId>/...`) lines up with the row id from then on.
 *   - edit: `isEdit=true`, `entryId` is the real row id.
 *
 * Cover image is uploaded directly to Supabase Storage from the browser
 * (RLS gates the bucket to super_admin). The resulting `coverPath` rides
 * inside the form payload and persists in the same INSERT/UPDATE round-
 * trip as every other field — no separate cover-only mutation.
 */
export function AtlasEntryForm({
  entryId,
  isEdit = false,
  initial,
  existingTags = [],
}: AtlasEntryFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Live signed URL for the cover preview. Lives outside RHF because the
  // URL is a transient view of the path — the path is what we persist.
  const [coverUrl, setCoverUrl] = useState<string | null>(
    initial?.coverUrl ?? null,
  );

  const form = useForm<UpsertAtlasEntryInput>({
    resolver: zodResolver(upsertAtlasEntrySchema),
    defaultValues: initial ?? ATLAS_ENTRY_FORM_DEFAULTS,
  });

  // Track the current cover path via RHF so it ships with the submit
  // payload. The uploader hands us `{path, url}` and we split: path → RHF
  // (persisted), url → local state (preview only).
  const coverPath = useWatch({ control: form.control, name: "coverPath" }) ?? "";

  // Auto-slugify the title on create — once the user edits the slug
  // manually we stop overwriting it (RHF tracks dirty state per field).
  const slugDirty = form.formState.dirtyFields.slug;
  const titleValue = useWatch({ control: form.control, name: "title" });
  useEffect(() => {
    if (isEdit || slugDirty) return;
    const next = slugifyTitle(titleValue ?? "");
    if (next !== form.getValues("slug")) {
      form.setValue("slug", next, { shouldValidate: true });
    }
  }, [titleValue, slugDirty, isEdit, form]);

  // Live slug availability — debounced check against the RPC. Powers an
  // inline status icon next to the field so the curator notices a
  // collision before submit (the DB unique index is still the source of
  // truth at write time).
  const sectionValue = useWatch({ control: form.control, name: "section" });
  const slugValue = useWatch({ control: form.control, name: "slug" });
  // Only the async result lives in state — the "idle" / "checking"
  // branches are derived during render so we don't write state in the
  // effect's early-return path (React Compiler dislikes that pattern).
  const [slugResult, setSlugResult] = useState<{
    section: AtlasSection;
    slug: string;
    available: boolean;
  } | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const slugTooShort = !slugValue || slugValue.length < 2;
  useEffect(() => {
    if (slugTooShort) return;
    // setState lives inside the async callback (not synchronously in the
    // effect body) so the React Compiler treats this as an event-style
    // update rather than a render-derived side-effect.
    const handle = setTimeout(async () => {
      setSlugChecking(true);
      const res = await checkSlugAvailableAction({
        section: sectionValue,
        slug: slugValue,
        excludeId: isEdit ? entryId : null,
      });
      setSlugChecking(false);
      setSlugResult({
        section: sectionValue,
        slug: slugValue,
        available: res.available,
      });
    }, 400);
    return () => clearTimeout(handle);
  }, [slugTooShort, slugValue, sectionValue, entryId, isEdit]);

  // Derive the visible status from the cached result + current input.
  // `slugResult` is stale until the next debounce flush, so we only
  // surface it when the cached pair matches what's in the field today.
  const slugStatus: "idle" | "checking" | "available" | "taken" = slugTooShort
    ? "idle"
    : slugChecking
      ? "checking"
      : slugResult &&
          slugResult.section === sectionValue &&
          slugResult.slug === slugValue
        ? slugResult.available
          ? "available"
          : "taken"
        : "idle";

  function onSubmit(values: UpsertAtlasEntryInput) {
    startTransition(async () => {
      const fd = new FormData();
      if (!isEdit) fd.set("id", entryId);
      fd.set("section", values.section);
      fd.set("title", values.title);
      fd.set("slug", values.slug);
      fd.set("description", values.description ?? "");
      fd.set("bodyMd", values.bodyMd ?? "");
      for (const tag of values.tags) fd.append("tags", tag);
      fd.set("status", values.status);
      fd.set("position", String(values.position));
      fd.set("coverPath", values.coverPath ?? "");

      if (isEdit) {
        const res = await updateAtlasEntryAction(entryId, null, fd);
        if (!res.success) {
          toast.error(res.message ?? "No se pudo guardar.");
          return;
        }
        toast.success(res.message ?? "Cambios guardados.");
        router.refresh();
        return;
      }

      const res = await createAtlasEntryAction(null, fd);
      if (!res.success) {
        toast.error(res.message ?? "No se pudo crear la entrada.");
        return;
      }
      toast.success(res.message ?? "Entrada creada.");
      const newId = res.data?.entryId;
      if (newId) {
        router.push(`${ROUTES.atlasAdmin}/${newId}`);
      }
      router.refresh();
    });
  }

  function handleCoverChange(next: { path: string | null; url: string | null }) {
    form.setValue("coverPath", next.path ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    setCoverUrl(next.url);
  }

  // isDirty drives the submit button copy + variant — the curator sees
  // "Sin cambios" once they've saved, so they don't second-guess themselves.
  const isDirty = form.formState.isDirty;
  const canSubmit = !pending && (!isEdit || isDirty);

  return (
    <Form {...form}>
      <form
        id={ATLAS_ENTRY_FORM_ID}
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-6"
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-5">
            <FormField
              control={form.control}
              name="section"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sección</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-1.5">
                      {ATLAS_SECTIONS.map((section) => (
                        <Chip
                          key={section}
                          pressed={field.value === section}
                          onPressedChange={() =>
                            field.onChange(section as AtlasSection)
                          }
                          tone="sage"
                        >
                          {ATLAS_SECTION_LABELS[section]}
                        </Chip>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ej. Niacinamida · función, concentraciones y combinaciones"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        placeholder="niacinamida"
                        className="pr-9"
                        onChange={(e) =>
                          field.onChange(e.target.value.toLowerCase())
                        }
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                        {slugStatus === "checking" ? (
                          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                        ) : slugStatus === "available" ? (
                          <CheckCircleIcon className="size-4 text-[#5C6E6C]" />
                        ) : slugStatus === "taken" ? (
                          <AlertCircleIcon className="size-4 text-destructive" />
                        ) : null}
                      </span>
                    </div>
                  </FormControl>
                  <p className="text-[11px] text-muted-foreground">
                    {slugStatus === "taken"
                      ? "Esa URL ya existe en esta sección."
                      : "Se autogenera desde el título. Edítalo para fijarlo."}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción corta</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={2}
                      placeholder="Resumen breve para la vista previa."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Body Markdown with live preview tabs. Editor + Preview share
                the same `bodyMd` value — switching tabs only changes the
                rendering surface, not the data. */}
            <FormField
              control={form.control}
              name="bodyMd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contenido (Markdown)</FormLabel>
                  <FormControl>
                    <Tabs defaultValue="editor" className="gap-3">
                      <TabsList variant="line" className="w-fit">
                        <TabsTrigger value="editor">Editor</TabsTrigger>
                        <TabsTrigger value="preview">Vista previa</TabsTrigger>
                      </TabsList>
                      <TabsContent value="editor">
                        <Textarea
                          {...field}
                          rows={14}
                          placeholder="## Heading&#10;- Bullet&#10;> Cita clínica"
                          className="font-mono text-xs"
                        />
                      </TabsContent>
                      <TabsContent value="preview">
                        <div className="min-h-[300px] rounded-md border bg-card p-4">
                          {field.value && field.value.trim().length > 0 ? (
                            <AtlasMarkdown source={field.value} />
                          ) : (
                            <p className="text-sm italic text-muted-foreground">
                              Vacío — escribí Markdown en la pestaña Editor.
                            </p>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </FormControl>
                  <p className="text-[11px] text-muted-foreground">
                    Soporta ## y ### encabezados, listas con `-`, listas
                    numeradas, blockquotes con `&gt;`, **negritas**, _itálicas_
                    y `código`.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <TagsField field={field} existingTags={existingTags} />
              )}
            />
          </div>

          <aside className="grid gap-5">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <FormControl>
                    <AtlasStatusSegmented
                      value={field.value as AtlasEntryStatus}
                      onChange={(next) => field.onChange(next)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Orden</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={field.value ?? 0}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value, 10) || 0)
                      }
                    />
                  </FormControl>
                  <p className="text-[11px] text-muted-foreground">
                    Menor primero. Empatados ordenan por fecha.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-2">
              <span className="text-sm font-medium">Portada</span>
              <AtlasCoverUpload
                entryId={entryId}
                currentUrl={coverUrl}
                currentPath={coverPath || null}
                onChange={handleCoverChange}
              />
              <p className="text-[11px] text-muted-foreground">
                La portada se guarda al presionar “
                {isEdit ? "Guardar cambios" : "Crear entrada"}”.
              </p>
            </div>
          </aside>
        </div>

        <footer className="sticky bottom-0 -mx-6 flex items-center justify-between gap-2 border-t bg-card px-6 py-4">
          <span className="text-xs text-muted-foreground">
            {!isEdit
              ? "Sin guardar"
              : isDirty
                ? "Hay cambios sin guardar"
                : "Todo al día"}
          </span>
          <Button
            type="submit"
            size="lg"
            disabled={!canSubmit || slugStatus === "taken"}
            className={cn(
              "gap-2",
              isEdit && !isDirty && "opacity-70",
            )}
          >
            <SparklesIcon className="size-4" />
            {pending
              ? "Guardando…"
              : isEdit
                ? isDirty
                  ? "Guardar cambios"
                  : "Sin cambios"
                : "Crear entrada"}
          </Button>
        </footer>
      </form>
    </Form>
  );
}

/**
 * Tag editor with native datalist autocomplete against existing tags.
 * Enter or comma adds a chip; existing tags filter the suggestions list
 * so the curator picks the canonical spelling instead of creating
 * duplicates ("rosacea" vs "rosácea").
 */
function TagsField({
  field,
  existingTags,
}: {
  field: {
    value: string[];
    onChange: (next: string[]) => void;
  };
  existingTags: readonly string[];
}) {
  // Suggestions = existing tags minus the ones already added in this form.
  const suggestions = existingTags.filter((t) => !field.value.includes(t));

  return (
    <FormItem>
      <FormLabel>Tags</FormLabel>
      <FormControl>
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-card p-2">
          {field.value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
            >
              {tag}
              <button
                type="button"
                aria-label={`Quitar ${tag}`}
                onClick={() =>
                  field.onChange(field.value.filter((t) => t !== tag))
                }
                className="text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            list="atlas-tag-suggestions"
            placeholder={
              field.value.length === 0
                ? "Agregar tag y pulsar Enter…"
                : "Otro tag…"
            }
            className="min-w-[160px] flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== ",") return;
              e.preventDefault();
              const raw = (e.target as HTMLInputElement).value.trim();
              if (!raw) return;
              const next = raw.toLowerCase().replace(/[^a-z0-9-+]/g, "-");
              if (next && !field.value.includes(next)) {
                field.onChange([...field.value, next]);
              }
              (e.target as HTMLInputElement).value = "";
            }}
          />
        </div>
      </FormControl>
      {/* Native <datalist> autocomplete — zero JS, accessible by default. */}
      <datalist id="atlas-tag-suggestions">
        {suggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <p className="text-[11px] text-muted-foreground">
        Hasta 20 tags. Sugerencias del Atlas existentes para evitar
        duplicados.
      </p>
      <FormMessage />
    </FormItem>
  );
}
