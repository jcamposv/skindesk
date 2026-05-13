"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  CameraIcon,
  ImagePlusIcon,
  Loader2Icon,
  TrashIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { updateAvatarUrlAction } from "@/actions/avatar.actions";
import { ClienteAvatar } from "@/components/clientes/cliente-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024; // mirror the bucket's file_size_limit
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
type AllowedMime = (typeof ALLOWED_MIME)[number];

function isAllowedMime(t: string): t is AllowedMime {
  return (ALLOWED_MIME as readonly string[]).includes(t);
}

interface AvatarUploadProps {
  /** The auth.users.id whose folder we'll upload into. */
  profileId: string;
  /** Current avatar URL (null when none). */
  currentUrl: string | null;
  /** Stored path inside the storage bucket. Lets us delete the exact
   *  object on replace/remove without guessing the extension. */
  currentPath: string | null;
  /** Used for the fallback initials and ARIA. */
  name: string;
  /** Avatar trigger size — passed to ClienteAvatar. */
  size?: "md" | "lg" | "xl";
  /** Bucket name. Default `avatars`. */
  bucket?: string;
  /** Optional ring class for the trigger avatar. */
  ringClassName?: string;
  /** When set, revalidates the cliente detail route after save. */
  clienteId?: string;
  /** Notification + analytics hook. */
  onUploaded?: (url: string) => void;
}

/**
 * Reusable avatar trigger that opens a Dialog for uploading a new image.
 *
 * Flow:
 *   1. User clicks the avatar (or hovers and clicks the camera badge).
 *   2. Dialog opens with a drag-and-drop zone + file picker.
 *   3. On file selected: client-side validation (size, MIME) + preview.
 *   4. "Subir foto" → `supabase.storage.from(bucket).upload()` from the
 *      browser → public URL → `updateAvatarUrlAction(profileId, url)` to
 *      persist the URL on the profile.
 *   5. Dialog closes, parent re-renders with the new URL.
 *
 * "Eliminar foto" deletes the storage object + clears `avatar_url`.
 */
export function AvatarUpload({
  profileId,
  currentUrl,
  currentPath,
  name,
  size = "lg",
  bucket = "avatars",
  ringClassName,
  clienteId,
  onUploaded,
}: AvatarUploadProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative inline-flex shrink-0 cursor-pointer rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB7154]/40 focus-visible:ring-offset-2"
        aria-label={`Cambiar foto de ${name}`}
      >
        <ClienteAvatar
          name={name}
          imageUrl={currentUrl}
          size={size}
          className={ringClassName}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <CameraIcon className="size-5 text-white" />
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full bg-[#BB7154] text-white shadow-md ring-2 ring-card"
        >
          <CameraIcon className="size-2.5" />
        </span>
      </button>

      {open ? (
        <UploadDialog
          open={open}
          onOpenChange={setOpen}
          profileId={profileId}
          currentUrl={currentUrl}
          currentPath={currentPath}
          name={name}
          bucket={bucket}
          clienteId={clienteId}
          onUploaded={onUploaded}
        />
      ) : null}
    </>
  );
}

// ─── Dialog body ────────────────────────────────────────────────────────────

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  currentUrl: string | null;
  currentPath: string | null;
  name: string;
  bucket: string;
  clienteId?: string;
  onUploaded?: (url: string) => void;
}

function UploadDialog({
  open,
  onOpenChange,
  profileId,
  currentUrl,
  currentPath,
  name,
  bucket,
  clienteId,
  onUploaded,
}: UploadDialogProps) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<{ file: File; url: string } | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();

  const file = selected?.file ?? null;
  const previewUrl = selected?.url ?? null;

  // Revoke the object URL when the selection changes or the dialog closes.
  // We don't read state here — only release the resource.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const acceptFile = useCallback((next: File) => {
    if (!isAllowedMime(next.type)) {
      toast.error("Formato no soportado. Usa JPG, PNG, WebP o GIF.");
      return;
    }
    if (next.size > MAX_BYTES) {
      toast.error("La imagen pesa más de 5 MB.");
      return;
    }
    setSelected({ file: next, url: URL.createObjectURL(next) });
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
  }, []);

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) acceptFile(dropped);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) acceptFile(picked);
    // reset so picking the same file twice still fires onChange
    e.target.value = "";
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createBrowserSupabase();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      // Stable path per profile so we always replace the previous avatar
      // (upsert) and never accumulate orphan files. If the previous file
      // had a different extension, delete it after the new upload so the
      // bucket doesn't accumulate stale objects.
      const path = `${profileId}/avatar.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });

      if (uploadErr) {
        toast.error(uploadErr.message);
        setUploading(false);
        return;
      }

      // If the previous avatar lived at a DIFFERENT path (different ext),
      // remove it now to avoid orphaned objects.
      if (currentPath && currentPath !== path) {
        await supabase.storage
          .from(bucket)
          .remove([currentPath])
          .catch(() => {
            // best-effort — losing the old object is non-fatal.
          });
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path);

      // Cache-bust so <img> picks up the new bytes when extension is reused.
      const finalUrl = `${publicUrl}?v=${Date.now()}`;

      const result = await updateAvatarUrlAction(
        profileId,
        finalUrl,
        path,
        clienteId,
      );

      if (!result.success) {
        toast.error(result.message ?? "No se pudo guardar la foto.");
        setUploading(false);
        return;
      }

      toast.success("Foto actualizada.");
      onUploaded?.(finalUrl);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado.";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    startTransition(async () => {
      // Delete the exact stored path. If we don't have one (legacy data
      // before avatar_path was added), no-op the storage delete.
      if (currentPath) {
        const supabase = createBrowserSupabase();
        await supabase.storage
          .from(bucket)
          .remove([currentPath])
          .catch(() => {
            // best-effort
          });
      }

      const result = await updateAvatarUrlAction(
        profileId,
        null,
        null,
        clienteId,
      );
      if (!result.success) {
        toast.error(result.message ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Foto eliminada.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Foto de perfil</DialogTitle>
          <DialogDescription>
            Subí una imagen para {name}. JPG, PNG, WebP o GIF. Máximo 5 MB.
          </DialogDescription>
        </DialogHeader>

        {/* Body: dropzone + (preview when file selected) */}
        <div className="grid gap-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB7154]/40",
              dragOver
                ? "border-[#BB7154] bg-[#F6E0D6]/40"
                : file
                  ? "border-[#5C6E6C]/40 bg-[#FBF9F4]/60"
                  : "border-border/70 bg-muted/30 hover:border-foreground/30 hover:bg-muted/40",
            )}
            aria-label="Soltar archivo o hacer clic para elegir"
          >
            <input
              id={inputId}
              ref={inputRef}
              type="file"
              accept={ALLOWED_MIME.join(",")}
              className="hidden"
              onChange={onPickFile}
            />

            {previewUrl ? (
              <div className="grid w-full place-items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Vista previa"
                  className="size-28 rounded-full object-cover ring-4 ring-[#F6E0D6]"
                />
                <p className="max-w-full truncate text-[12px] text-muted-foreground">
                  {file?.name}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelection();
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                >
                  <XIcon className="size-3" />
                  Elegir otra
                </button>
              </div>
            ) : (
              <>
                <span
                  aria-hidden
                  className="flex size-10 items-center justify-center rounded-full bg-[#F6E0D6] text-[#BB7154]"
                >
                  <UploadCloudIcon className="size-5" />
                </span>
                <p className="text-[13px] font-medium">
                  Arrastra una imagen aquí
                </p>
                <p className="text-[11.5px] text-muted-foreground">
                  o haz clic para elegirla desde tu computadora
                </p>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-[11.5px] font-medium text-foreground/80 ring-1 ring-border/60">
                  <ImagePlusIcon className="size-3" />
                  Seleccionar archivo
                </span>
              </>
            )}
          </div>

          {currentUrl && !file ? (
            <p className="text-center text-[11px] text-muted-foreground">
              Tienes una foto cargada. Subí una nueva para reemplazarla.
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:flex-row sm:justify-between">
          <div>
            {currentUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={uploading}
                className="gap-1.5 text-[#7B3D3D] hover:bg-[#F8EAE9]/60"
              >
                <TrashIcon className="size-4" />
                Eliminar foto
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading}
                />
              }
            >
              Cancelar
            </DialogClose>
            <Button
              type="button"
              variant="cta"
              size="sm"
              onClick={handleUpload}
              disabled={!file || uploading}
              className="gap-1.5"
            >
              {uploading ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <UploadCloudIcon className="size-4" />
              )}
              {uploading ? "Subiendo…" : "Subir foto"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
