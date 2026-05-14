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

import { Button } from "@/components/ui/button";
import { useStorageUpload } from "@/hooks/use-storage-upload";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ATLAS_COVER_MAX_BYTES } from "@/schemas/atlas.schema";

interface AtlasCoverUploadProps {
  /** Stable identifier for the storage path. Pass the entry id (edit) or a
   *  newly minted UUID (create) — the parent form persists this id with
   *  the entry, so the cover path stays valid after the row is created. */
  entryId: string;
  currentUrl: string | null;
  currentPath: string | null;
  onChange: (next: { path: string | null; url: string | null }) => void;
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Cover image uploader for an Atlas entry. Composed on top of the shared
 * `useStorageUpload` hook so the validation / preview / sign workflow
 * stays consistent with the other storage-backed uploaders (Atlas files,
 * productos photo).
 */
export function AtlasCoverUpload({
  entryId,
  currentUrl,
  currentPath,
  onChange,
}: AtlasCoverUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const { upload, uploading, blobPreview } = useStorageUpload({
    bucket: "atlas",
    accept: ALLOWED,
    maxBytes: ATLAS_COVER_MAX_BYTES,
    makePath: (file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      return `entries/${entryId}/cover.${ext}`;
    },
    onUploaded: async ({ path, url }) => {
      // Best-effort cleanup of an old cover at a different extension so
      // we don't leak storage objects when the user swaps JPG → PNG.
      if (currentPath && currentPath !== path) {
        const supabase = createBrowserSupabase();
        await supabase.storage
          .from("atlas")
          .remove([currentPath])
          .catch(() => {});
      }
      onChange({ path, url });
    },
  });

  // What the preview block displays. Mirrors the upload primitive: the
  // blob is shown while uploading, then disappears so the form's
  // `currentUrl` (latest signed URL or null) becomes the source of truth.
  const previewSrc = blobPreview ?? currentUrl;

  async function handleRemove() {
    if (uploading) return;
    if (currentPath) {
      const supabase = createBrowserSupabase();
      await supabase.storage
        .from("atlas")
        .remove([currentPath])
        .catch(() => {});
    }
    onChange({ path: null, url: null });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void upload(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!uploading) setDragOver(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={uploading}
        aria-label={previewSrc ? "Cambiar portada" : "Subir portada"}
        className={cn(
          "group relative flex aspect-[5/3] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-[#F4F1EC] transition-all",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C6E6C]/40 focus-visible:ring-offset-2",
          "hover:border-[#5C6E6C]/60 hover:bg-[#EFEAE3]",
          dragOver && "scale-[1.01] border-[#BB7154] bg-[#FBEFE7]",
          uploading && "cursor-not-allowed opacity-80",
        )}
      >
        {previewSrc ? (
          <>
            <Image
              src={previewSrc}
              alt=""
              fill
              sizes="(min-width: 1024px) 500px, 100vw"
              className="object-cover"
            />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/0 text-white opacity-0 transition-all group-hover:bg-foreground/40 group-hover:opacity-100">
              <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                <RefreshCwIcon className="size-3.5" />
                Cambiar portada
              </span>
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-center">
            <UploadCloudIcon className="size-7 text-muted-foreground" />
            <span className="text-xs font-medium">
              {dragOver ? "Suelta la imagen" : "Subir o arrastrar portada"}
            </span>
            <span className="text-xs font-medium text-foreground/75">
              JPG, PNG o WEBP · máx 5 MB
            </span>
          </div>
        )}

        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </span>
        ) : null}

        {previewSrc && !uploading ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              void handleRemove();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                void handleRemove();
              }
            }}
            aria-label="Quitar portada"
            className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-white/95 text-destructive shadow-sm transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
          >
            <TrashIcon className="size-3.5" />
          </span>
        ) : null}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED.join(",")}
        className="sr-only"
        onChange={handleInputChange}
      />

      {previewSrc ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-fit gap-1.5 text-muted-foreground"
        >
          <ImagePlusIcon className="size-3.5" />
          Reemplazar
        </Button>
      ) : null}
    </div>
  );
}
