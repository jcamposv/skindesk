"use client";

import { useRef, useState, useTransition } from "react";
import {
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  Loader2Icon,
  TrashIcon,
  UploadCloudIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  attachAtlasFileAction,
  removeAtlasFileAction,
} from "@/actions/atlas.actions";
import { Button } from "@/components/ui/button";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  ATLAS_FILE_KIND_LABELS,
  ATLAS_FILE_MAX_BYTES,
  ATLAS_FILE_MIME_BY_KIND,
  atlasFileKindForMime,
  type AtlasFileKind,
} from "@/schemas/atlas.schema";
import type { AtlasFile } from "@/services/atlas.service";

interface AtlasFilesUploadProps {
  entryId: string;
  initial: AtlasFile[];
}

const ICON: Record<AtlasFileKind, typeof FileTextIcon> = {
  pdf: FileTextIcon,
  html: GlobeIcon,
  image: ImageIcon,
};

const TONE: Record<AtlasFileKind, string> = {
  pdf: "bg-[#F3DCD9] text-[#A1645F]",
  html: "bg-[#EAE6DC] text-[#5C6E6C]",
  image: "bg-[#F6E5C5] text-[#8E6628]",
};

// Browser-side accept list, derived from the schema mime map so it stays in
// sync with whatever the action allows. (`unique()` to avoid `image/jpeg`
// appearing twice if a new kind ever shares a mime.)
const ACCEPT = Array.from(
  new Set(
    Object.values(ATLAS_FILE_MIME_BY_KIND).flatMap((arr) => [...arr]),
  ),
).join(",");

/**
 * Multi-file uploader for an entry. Each file is sent directly to Supabase
 * Storage from the browser (RLS gates to super_admin) and then a server
 * action registers the metadata row. We don't need a single FormData blob
 * — uploading one at a time keeps memory flat and lets the user see
 * incremental progress on big PDF uploads.
 */
export function AtlasFilesUpload({
  entryId,
  initial,
}: AtlasFilesUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<AtlasFile[]>(initial);
  // Files being uploaded right now. We render them inline as ghosts so the
  // user gets immediate feedback before the server action returns.
  const [pendingUploads, setPendingUploads] = useState<
    Array<{ id: string; name: string; kind: AtlasFileKind; progress: number }>
  >([]);
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  async function uploadOne(file: File) {
    const kind = atlasFileKindForMime(file.type);
    if (!kind) {
      toast.error(`${file.name}: formato no soportado.`);
      return;
    }
    if (file.size > ATLAS_FILE_MAX_BYTES) {
      toast.error(`${file.name}: supera los 50 MB.`);
      return;
    }

    const tempId = crypto.randomUUID();
    setPendingUploads((prev) => [
      ...prev,
      { id: tempId, name: file.name, kind, progress: 0 },
    ]);

    try {
      const supabase = createBrowserSupabase();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? kind;
      // Storage object id matches the temp id so re-runs / retries don't
      // collide with previous attempts.
      const path = `entries/${entryId}/${tempId}.${ext}`;

      // Force the canonical Content-Type per kind. Browser-supplied
      // `file.type` is unreliable for HTML (drag-and-drop and some OS file
      // pickers report "text/plain" or empty), and the iframe viewer needs
      // the stored object to be served as `text/html` to render rather
      // than dump the source.
      const contentType =
        kind === "html"
          ? "text/html; charset=utf-8"
          : kind === "pdf"
            ? "application/pdf"
            : file.type;

      const { error: upErr } = await supabase.storage
        .from("atlas")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType,
        });
      if (upErr) {
        toast.error(`${file.name}: ${upErr.message}`);
        return;
      }

      const res = await attachAtlasFileAction({
        entryId,
        kind,
        storagePath: path,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        position: files.length + pendingUploads.length,
      });

      if (!res.success || !res.data) {
        toast.error(res.message ?? "No se pudo registrar el archivo.");
        // Roll back the upload so we don't leave an orphan.
        await supabase.storage.from("atlas").remove([path]).catch(() => {});
        return;
      }

      // Sign a URL so we can show the local row immediately. Falls back to
      // empty string when signing fails — the row still appears, just
      // without an open-able preview until the next reload.
      const { data: signed } = await supabase.storage
        .from("atlas")
        .createSignedUrl(path, 60 * 30);

      const newFile: AtlasFile = {
        id: res.data.fileId,
        entry_id: entryId,
        kind,
        storage_path: path,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        position: files.length + pendingUploads.length,
        created_at: new Date().toISOString(),
        url: signed?.signedUrl ?? "",
        // HTML guides render via the internal route handler, which uses
        // the file id we just got back from the server.
        htmlRoute:
          kind === "html" ? `/api/atlas/files/${res.data.fileId}/html` : null,
      };
      setFiles((prev) => [...prev, newFile]);
    } finally {
      setPendingUploads((prev) => prev.filter((p) => p.id !== tempId));
    }
  }

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    // Serial — keeps each row visible as it uploads, avoids hammering the
    // bucket policy with N concurrent INSERTs.
    for (const file of Array.from(list)) {
      await uploadOne(file);
    }
  }

  function handleRemove(fileId: string) {
    startTransition(async () => {
      const res = await removeAtlasFileAction(fileId);
      if (res.success) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      } else {
        toast.error(res.message ?? "No se pudo eliminar.");
      }
    });
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-[#F4F1EC] px-6 py-8 text-center transition-all",
          "hover:border-[#5C6E6C]/60 hover:bg-[#EFEAE3]",
          dragOver && "border-[#BB7154] bg-[#FBEFE7]",
        )}
      >
        <UploadCloudIcon className="size-7 text-muted-foreground" />
        <div className="text-sm font-medium">
          {dragOver
            ? "Suelta los archivos"
            : "Subir o arrastrar archivos"}
        </div>
        <div className="text-xs font-medium text-foreground/75">
          PDF · HTML · JPG / PNG / WEBP · máx 50 MB cada uno
        </div>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length === 0 && pendingUploads.length === 0 ? null : (
        <ul className="grid gap-2">
          {files.map((file) => {
            const Icon = ICON[file.kind];
            return (
              <li
                key={file.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-3"
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg",
                    TONE[file.kind],
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {file.original_name}
                  </p>
                  <p className="text-xs font-medium text-foreground/75">
                    {ATLAS_FILE_KIND_LABELS[file.kind]} ·{" "}
                    {formatBytes(file.size_bytes)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  disabled={isPending}
                  onClick={() => handleRemove(file.id)}
                  aria-label={`Eliminar ${file.original_name}`}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </li>
            );
          })}

          {pendingUploads.map((p) => {
            const Icon = ICON[p.kind];
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-dashed bg-card p-3 opacity-80"
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg",
                    TONE[p.kind],
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="flex items-center gap-1 text-xs font-medium text-foreground/75">
                    <Loader2Icon className="size-3 animate-spin" /> Subiendo…
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
