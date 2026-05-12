"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  ImagePlusIcon,
  Loader2Icon,
  RefreshCwIcon,
  TrashIcon,
  UploadCloudIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ProductoCategoria } from "@/schemas/productos.schema";

import { ProductoIllustration } from "./producto-illustration";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

interface ProductoPhotoUploadProps {
  tenantId: string;
  /** Stable id used to name the storage object — pass either the producto's
   *  id (edit) or a freshly minted UUID (create). The path is
   *  `${tenantId}/${productoId}/photo.<ext>` so re-uploads overwrite. */
  productoId: string;
  /** Current signed URL for display. Comes from the parent form (server-
   *  rendered initial), then live-replaced after upload. */
  currentUrl: string | null;
  /** Current path inside the bucket. Persisted by the form. */
  currentPath: string | null;
  /** Fallback illustration shown when neither URL nor path is present. */
  fallbackCategory: ProductoCategoria;
  /** Notifies the form when path/url changes so RHF can mark dirty. */
  onChange: (next: { path: string | null; url: string | null }) => void;
}

/**
 * Browser-side upload zone for the product photo.
 *
 * Why browser-side: Server Actions can't stream multi-MB binary efficiently
 * (FormData files go through Next's middleware and bloat the action payload).
 * Direct upload from the browser to Supabase Storage is faster and keeps
 * the server action lean — it only persists the path string.
 *
 * State machine:
 *   idle → picking → uploading → idle (with new path/url)
 * Failures stay on idle and surface a toast.
 */
export function ProductoPhotoUpload({
  tenantId,
  productoId,
  currentUrl,
  currentPath,
  fallbackCategory,
  onChange,
}: ProductoPhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);

  function pickFile() {
    if (uploading) return;
    fileInputRef.current?.click();
  }

  /**
   * Single entry point for both the file picker and the drag-and-drop
   * handler. Validates MIME + size, runs the optimistic local preview, then
   * uploads to Storage and swaps in the signed URL.
   */
  async function processFile(file: File) {
    if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
      toast.error("Formato no permitido. Usá JPG, PNG o WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("La imagen supera los 5 MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setUploading(true);
    try {
      const supabase = createBrowserSupabase();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${tenantId}/${productoId}/photo.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("productos-photos")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });

      if (uploadErr) {
        toast.error(uploadErr.message);
        setPreviewUrl(currentUrl);
        URL.revokeObjectURL(objectUrl);
        return;
      }

      // Clean up old object when the extension changed (e.g. JPG over a
      // previous PNG). Best-effort — orphan files are non-fatal.
      if (currentPath && currentPath !== path) {
        await supabase.storage
          .from("productos-photos")
          .remove([currentPath])
          .catch(() => {});
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from("productos-photos")
        .createSignedUrl(path, 60 * 60);
      if (signErr || !signed) {
        toast.error("Foto subida pero no se pudo previsualizar.");
        setPreviewUrl(currentUrl);
        URL.revokeObjectURL(objectUrl);
        onChange({ path, url: null });
        return;
      }

      onChange({ path, url: signed.signedUrl });
      setPreviewUrl(signed.signedUrl);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setUploading(false);
    }
  }

  async function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file twice
    if (file) await processFile(file);
  }

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    if (uploading) return;
    if (currentPath) {
      const supabase = createBrowserSupabase();
      await supabase.storage
        .from("productos-photos")
        .remove([currentPath])
        .catch(() => {});
    }
    setPreviewUrl(null);
    onChange({ path: null, url: null });
  }

  // ─── Drag handlers ───────────────────────────────────────────────────────
  // `dragenter` and `dragover` both need preventDefault for `drop` to fire.
  // We use a counter-less approach: any `dragleave` clears the visual state
  // — good enough because the drop zone is a single element with no nested
  // children that would trigger `dragleave` on hover-through.

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (uploading) return;
    setDragOver(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  }

  const hasPreview = Boolean(previewUrl);

  return (
    <div className="grid gap-3">
      {/* The image area itself is the click + drop target. Visually it's a
          button so screen readers announce it correctly. */}
      <button
        type="button"
        onClick={pickFile}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={uploading}
        aria-label={hasPreview ? "Cambiar foto del producto" : "Subir foto del producto"}
        className={cn(
          "group relative flex aspect-[4/5] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-[#F4F1EC] transition-all",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C6E6C]/40 focus-visible:ring-offset-2",
          "hover:border-[#5C6E6C]/60 hover:bg-[#EFEAE3]",
          dragOver && "scale-[1.02] border-[#BB7154] bg-[#FBEFE7]",
          uploading && "cursor-not-allowed opacity-80",
        )}
      >
        {previewUrl ? (
          <>
            <Image
              src={previewUrl}
              alt=""
              fill
              sizes="220px"
              className="object-cover"
            />
            {/* Hover overlay: only shows the "change" affordance over an
                existing photo. Keep it subtle — the photo is the content. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/0 text-white opacity-0 transition-all group-hover:bg-foreground/40 group-hover:opacity-100 group-focus-visible:bg-foreground/40 group-focus-visible:opacity-100"
            >
              <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                <RefreshCwIcon className="size-3.5" />
                Cambiar foto
              </span>
            </span>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="size-16 opacity-80 group-hover:opacity-100">
              <ProductoIllustration category={fallbackCategory} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <UploadCloudIcon className="size-3.5" />
                {dragOver ? "Soltá la imagen" : "Subir o arrastrar foto"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                JPG, PNG o WEBP · máx 5 MB
              </span>
            </div>
          </div>
        )}

        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </span>
        ) : null}

        {/* Quitar — sits on top of the preview, stops click propagation so
            it doesn't trigger the parent's "change photo" flow. */}
        {hasPreview && !uploading ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => handleRemove(e)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleRemove(e as unknown as React.MouseEvent);
              }
            }}
            aria-label="Quitar foto"
            className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-white/95 text-destructive shadow-sm transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
          >
            <TrashIcon className="size-3.5" />
          </span>
        ) : null}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_MIME.join(",")}
        className="sr-only"
        onChange={handleInputChange}
      />

      {!hasPreview ? (
        <p className="text-[11px] text-muted-foreground">
          También podés arrastrar la imagen. Si no subís foto, mostramos la
          ilustración por categoría.
        </p>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={pickFile}
          disabled={uploading}
          className="w-fit gap-1.5 text-muted-foreground"
        >
          <ImagePlusIcon className="size-3.5" />
          Reemplazar
        </Button>
      )}
    </div>
  );
}
