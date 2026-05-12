"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  CameraIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { deleteSessionPhotoAction } from "@/actions/servicios.actions";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024; // mirror the bucket's file_size_limit
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
type AllowedMime = (typeof ALLOWED_MIME)[number];

function isAllowedMime(t: string): t is AllowedMime {
  return (ALLOWED_MIME as readonly string[]).includes(t);
}

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export interface PhotoUploaderProps {
  label: string;
  /** Stored object paths in the `servicios-photos` bucket. */
  paths: string[];
  /** Signed URLs for already-persisted paths (read from the service layer).
   *  Newly-uploaded paths fall back to a placeholder until the page refreshes. */
  urls?: string[];
  onChange: (next: string[]) => void;
  tenantId: string;
  clienteId: string;
  /** When the form persists an existing session row, deletes can splice the
   *  array column server-side. When null (e.g. inside add-service / add-session
   *  before save) deletes are storage-only. */
  sessionId?: string | null;
  tone?: "before" | "after";
  max?: number;
}

/**
 * Browser-side uploader for session before/after photos.
 *
 * Direct-to-storage upload (RLS on `servicios-photos` enforces tenant
 * isolation by path prefix). Path layout: `<tenant_id>/<cliente_id>/<uuid>.<ext>`.
 *
 * On cancel of the form: any uploaded paths sit unreferenced as orphans —
 * the action layer documents this; a cleanup cron is future work.
 */
export function PhotoUploader({
  label,
  paths,
  urls = [],
  onChange,
  tenantId,
  clienteId,
  sessionId = null,
  tone = "before",
  max = 4,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  // Local blob URLs keyed by storage path, used as instant preview while the
  // server-side signed URL isn't available yet. State drives render; the ref
  // mirrors it for the unmount cleanup so blob URLs added after mount are
  // still revoked (a [] effect captures only the initial empty object).
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const previewsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    return () => {
      Object.values(previewsRef.current).forEach((u) =>
        URL.revokeObjectURL(u),
      );
    };
  }, []);

  const toneClasses =
    tone === "before"
      ? "border-[#5C6E6C]/30 bg-[#E7ECEA]/40 text-[#4F605C]"
      : "border-[#BB7154]/30 bg-[#FBEFE7]/40 text-[#8C4A30]";

  function openPicker() {
    inputRef.current?.click();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = max - paths.length;
    const accepted = Array.from(files).slice(0, Math.max(0, remaining));
    if (accepted.length === 0) {
      toast.error(`Máximo ${max} fotos por sección.`);
      return;
    }

    setUploading(true);
    const supabase = createBrowserSupabase();
    const uploadedPaths: string[] = [];
    const newPreviews: Record<string, string> = {};

    for (const file of accepted) {
      if (!isAllowedMime(file.type)) {
        toast.error(`Formato no soportado (${file.name}). Usá JPG, PNG o WebP.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`"${file.name}" pesa más de 5 MB.`);
        continue;
      }

      const path = `${tenantId}/${clienteId}/${crypto.randomUUID()}.${extFor(file.type)}`;
      const { error } = await supabase.storage
        .from("servicios-photos")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (error) {
        toast.error(`No se pudo subir "${file.name}": ${error.message}`);
        continue;
      }
      uploadedPaths.push(path);
      newPreviews[path] = URL.createObjectURL(file);
    }

    setUploading(false);
    if (uploadedPaths.length > 0) {
      setPreviews((prev) => ({ ...prev, ...newPreviews }));
      onChange([...paths, ...uploadedPaths]);
    }
  }

  function handleRemove(path: string) {
    // Optimistic: remove locally first; revert on error.
    const next = paths.filter((p) => p !== path);
    onChange(next);
    const blobUrl = previews[path];
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setPreviews((prev) => {
        const rest = { ...prev };
        delete rest[path];
        return rest;
      });
    }
    startTransition(async () => {
      const result = await deleteSessionPhotoAction(path, sessionId ?? null);
      if (!result.success) {
        toast.error(result.message ?? "No se pudo eliminar la foto.");
        onChange(paths); // revert
      }
    });
  }

  return (
    <div className="grid gap-2">
      <label className="text-[12px] font-medium text-muted-foreground">
        {label}
      </label>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: max }).map((_, i) => {
          const path = paths[i];
          const filled = Boolean(path);
          // Prefer the freshly-created blob URL (instant) over the server
          // signed URL — both work, but the blob is always available right
          // after upload. Falls back to the signed URL for previously-saved
          // photos hydrated from the service layer.
          const previewSrc = path
            ? previews[path] ?? urls[i] ?? null
            : null;
          return (
            <div
              key={i}
              className={cn(
                "group relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border-2",
                filled
                  ? `${toneClasses} border-solid`
                  : "border-dashed border-border/60 bg-muted/30 text-muted-foreground",
              )}
            >
              {filled && path ? (
                <>
                  {previewSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewSrc}
                      alt={`${label} ${i + 1}`}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      Cargada
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(path)}
                    className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-white/95 text-foreground shadow-sm opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={`Quitar foto ${i + 1}`}
                  >
                    <XIcon className="size-3" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={uploading || paths.length >= max}
                  className="flex size-full items-center justify-center transition-colors hover:border-foreground/30 hover:bg-muted/50 disabled:opacity-50"
                  aria-label={`Subir foto ${i + 1}`}
                >
                  {uploading && i === paths.length ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <CameraIcon className="size-4 opacity-60" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_MIME.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="text-[10.5px] text-muted-foreground/80">
        {uploading
          ? "Subiendo…"
          : paths.length > 0
            ? `${paths.length} foto${paths.length === 1 ? "" : "s"} cargada${paths.length === 1 ? "" : "s"} · JPG/PNG/WebP, ≤ 5 MB`
            : "JPG, PNG o WebP · máximo 5 MB cada una"}
      </p>
    </div>
  );
}
