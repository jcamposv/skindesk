"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

interface UseStorageUploadParams {
  /** Supabase Storage bucket id. Caller is responsible for RLS. */
  bucket: string;
  /** Compute the canonical object path for a given file. Receives the
   *  file so callers can use its extension; the consumer of the hook
   *  picks how to namespace (per-tenant, per-entry, etc.). */
  makePath: (file: File) => string;
  /** Browser-side MIME allowlist. Returning false rejects the file. */
  accept: readonly string[];
  /** Hard size cap in bytes. */
  maxBytes: number;
  /** Signed URL TTL in seconds. Defaults to 1h. */
  signedUrlTtl?: number;
  /** TTL on the storage cache-control header. Defaults to 1h. */
  cacheControl?: string;
  /** Optional: per-kind content-type override. Stops Supabase from
   *  storing `application/octet-stream` for files whose `file.type` is
   *  unreliable (HTML / some PDFs). */
  contentType?: (file: File) => string;
  /** Fired once the upload + signing completes successfully. Returns the
   *  caller-provided path (stable across re-uploads) plus the freshly
   *  signed URL the parent should show as preview. */
  onUploaded: (next: { path: string; url: string | null }) => void;
}

interface UseStorageUploadResult {
  /** Drag/drop & file-picker handler. Pass the dropped file or the
   *  `<input type=file>` change event's file. */
  upload: (file: File) => Promise<void>;
  /** Whether an upload is currently in flight. */
  uploading: boolean;
  /** Transient blob URL shown while the file is being uploaded — clears
   *  itself when the upload resolves so the parent's `currentUrl` prop
   *  takes over rendering. */
  blobPreview: string | null;
  /** Cleanup helper for callers that want to drop a preview without
   *  triggering an upload (e.g. swapping form values). */
  reset: () => void;
}

/**
 * Browser-side storage upload primitive shared by the Atlas cover, the
 * Atlas attached-files uploader, and the productos photo uploader. Owns
 * the validation → blob preview → upload → sign workflow so each callsite
 * focuses on UI shape, not data plumbing.
 *
 * The hook deliberately does NOT own the persisted path — it only emits
 * `{path, url}` to the parent on success. Storing the path (in form state,
 * RHF, or a separate field) belongs to the consumer.
 */
export function useStorageUpload({
  bucket,
  makePath,
  accept,
  maxBytes,
  signedUrlTtl = 60 * 60,
  cacheControl = "3600",
  contentType,
  onUploaded,
}: UseStorageUploadParams): UseStorageUploadResult {
  const [uploading, setUploading] = useState(false);
  const [blobPreview, setBlobPreview] = useState<string | null>(null);
  // Track the latest in-flight blob URL so cancel / fast re-upload doesn't
  // leak object URLs.
  const activeBlobRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    if (activeBlobRef.current) {
      URL.revokeObjectURL(activeBlobRef.current);
      activeBlobRef.current = null;
    }
    setBlobPreview(null);
  }, []);

  const upload = useCallback(
    async (file: File) => {
      if (!(accept as readonly string[]).includes(file.type)) {
        toast.error(`${file.name}: formato no permitido.`);
        return;
      }
      if (file.size > maxBytes) {
        toast.error(
          `${file.name}: supera el límite de ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`,
        );
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      activeBlobRef.current = objectUrl;
      setBlobPreview(objectUrl);
      setUploading(true);

      try {
        const supabase = createBrowserSupabase();
        const path = makePath(file);
        const resolvedType = contentType ? contentType(file) : file.type;

        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(path, file, {
            cacheControl,
            upsert: true,
            contentType: resolvedType,
          });
        if (upErr) {
          toast.error(`${file.name}: ${upErr.message}`);
          return;
        }

        const { data: signed } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, signedUrlTtl);

        onUploaded({ path, url: signed?.signedUrl ?? null });
      } finally {
        setUploading(false);
        // Clear the blob in the same tick as the parent's state update —
        // React 19 batches them so the user sees a clean handoff with no
        // flicker between blob and signed URL.
        if (activeBlobRef.current === objectUrl) {
          activeBlobRef.current = null;
          setBlobPreview(null);
        }
        URL.revokeObjectURL(objectUrl);
      }
    },
    [accept, bucket, cacheControl, contentType, makePath, maxBytes, onUploaded, signedUrlTtl],
  );

  return { upload, uploading, blobPreview, reset };
}
