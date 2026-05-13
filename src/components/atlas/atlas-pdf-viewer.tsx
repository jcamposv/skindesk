"use client";

import { useState } from "react";
import {
  DownloadIcon,
  ExternalLinkIcon,
  ExpandIcon,
  Loader2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface AtlasPdfViewerProps {
  src: string;
  title: string;
  /** Original filename — surfaced on the download fallback. */
  fileName?: string;
}

/**
 * Lazy PDF viewer using the browser's built-in PDF plugin via `<iframe>`.
 *
 * Why no pdf.js: shipping pdf.js doubles the JS budget for the Atlas reader
 * and the native viewer in modern browsers covers everything the brief
 * needs (pagination, zoom, fit-to-width, text search). On platforms that
 * don't render PDFs inline (some mobile webviews) the iframe falls back to
 * a download — the "Descargar" CTA below covers that case.
 *
 * We add `#view=FitH&toolbar=1` to the signed URL so the document opens
 * fit-to-width and shows the native viewer toolbar (zoom, page nav).
 */
export function AtlasPdfViewer({ src, title, fileName }: AtlasPdfViewerProps) {
  const [loaded, setLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const viewerSrc = `${src}#view=FitH&toolbar=1`;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={() => setFullscreen((v) => !v)}
        >
          <ExpandIcon className="size-3.5" />
          {fullscreen ? "Salir" : "Ampliar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          render={
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir en una pestaña nueva"
            />
          }
        >
          <ExternalLinkIcon className="size-3.5" />
          Abrir
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          render={
            <a
              href={src}
              download={fileName ?? true}
              aria-label="Descargar PDF"
            />
          }
        >
          <DownloadIcon className="size-3.5" />
          Descargar
        </Button>
      </div>

      <div
        className={
          fullscreen
            ? "fixed inset-0 z-50 flex flex-col gap-2 bg-background p-4"
            : "relative overflow-hidden rounded-2xl border bg-card"
        }
      >
        {fullscreen ? (
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFullscreen(false)}
            >
              Cerrar
            </Button>
          </div>
        ) : null}

        {!loaded ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 backdrop-blur-sm">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        <iframe
          src={viewerSrc}
          title={title}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={
            fullscreen
              ? "h-full w-full flex-1 rounded-xl border bg-white"
              : "block h-[720px] w-full bg-white"
          }
        />
      </div>
    </div>
  );
}
