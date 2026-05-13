"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { FileTextIcon, GlobeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ATLAS_FILE_KIND_LABELS,
  type AtlasFileKind,
} from "@/schemas/atlas.schema";

const AtlasPdfViewer = dynamic(
  () =>
    import("@/components/atlas/atlas-pdf-viewer").then((m) => m.AtlasPdfViewer),
  { ssr: false },
);
const AtlasHtmlViewer = dynamic(
  () =>
    import("@/components/atlas/atlas-html-viewer").then(
      (m) => m.AtlasHtmlViewer,
    ),
  { ssr: false },
);

const ICON: Record<Exclude<AtlasFileKind, "image">, typeof FileTextIcon> = {
  pdf: FileTextIcon,
  html: GlobeIcon,
};

const TONE: Record<Exclude<AtlasFileKind, "image">, string> = {
  pdf: "bg-[#F3DCD9] text-[#A1645F]",
  html: "bg-[#EAE6DC] text-[#5C6E6C]",
};

interface AtlasFileViewerToggleProps {
  kind: Exclude<AtlasFileKind, "image">;
  /** For PDF: signed Supabase URL. For HTML: the internal route URL
   *  (`/api/atlas/files/<id>/html`) so the iframe always gets `text/html`. */
  src: string;
  title: string;
  fileName: string;
  sizeBytes: number;
}

/**
 * Per-row client island for PDF / HTML attachments. Owns:
 *   · open/closed state
 *   · the lazy mount of the matching viewer (`next/dynamic`)
 *
 * The image attachment is a separate component (`AtlasFileImage`) because
 * its UX is a lightbox dialog, not an inline expander.
 *
 * Why this is a self-contained island instead of separate "header"/"panel"
 * pieces: the panel needs to render in the same DOM subtree as the toggle
 * for the visual border to flow continuously, and the toggle state must
 * drive both. Splitting it would require either a portal or always-mounted
 * hidden content — defeating the lazy viewer goal.
 */
export function AtlasFileViewerToggle({
  kind,
  src,
  title,
  fileName,
  sizeBytes,
}: AtlasFileViewerToggleProps) {
  const [open, setOpen] = useState(false);
  const Icon = ICON[kind];

  return (
    <>
      <div className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-lg",
            TONE[kind],
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{fileName}</p>
          <p className="text-[11px] text-muted-foreground">
            {ATLAS_FILE_KIND_LABELS[kind]} · {formatBytes(sizeBytes)}
          </p>
        </div>
        <Button
          type="button"
          variant={open ? "outline" : "default"}
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Ocultar" : "Abrir"}
        </Button>
      </div>
      {open ? (
        <div className="border-t p-4">
          {kind === "pdf" ? (
            <AtlasPdfViewer src={src} title={title} fileName={fileName} />
          ) : (
            <AtlasHtmlViewer src={src} title={title} />
          )}
        </div>
      ) : null}
    </>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
