"use client";

import { useState } from "react";
import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  ExpandIcon,
  Loader2Icon,
  ShieldCheckIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface AtlasHtmlViewerProps {
  /** Internal route URL (`/api/atlas/files/<id>/html`) that streams the
   *  guide with the canonical `Content-Type: text/html` header. The route
   *  handler is auth-gated so it inherits the same role / status checks
   *  the page already runs. */
  src: string;
  /** Used for the iframe `title` for assistive tech. */
  title: string;
}

/**
 * Sandboxed HTML viewer.
 *
 * Security model:
 *   • `sandbox="allow-scripts"` — uploaded guides may run JS for tabs,
 *     accordions, charts (Chart.js, etc.). Omitting it would break most of
 *     what these files are designed to do.
 *   • We deliberately DO NOT add `allow-same-origin`. Without it the iframe
 *     gets a unique opaque origin, so:
 *       - it can't read `document.cookie` (no auth/session leak)
 *       - it can't reach `localStorage`/`sessionStorage` of SkinDesk
 *       - it can't fetch our /api endpoints with the user's session
 *       - it can't read the parent `window` (window.parent.* is opaque)
 *   • No `allow-forms` / `allow-popups` / `allow-top-navigation` — the
 *     guide stays inert outside its rectangle.
 *   • The src is a short-lived signed Supabase Storage URL, so even if the
 *     URL leaks it stops working in ~30 min.
 *   • `referrerpolicy="no-referrer"` so the guide can't see where it was
 *     loaded from (which would otherwise expose the signed token).
 *
 * NB: the viewer can't talk to SkinDesk and SkinDesk can't read what the
 * user sees inside the guide. That's intentional — it's exactly the
 * isolation we want for third-party-authored content.
 */
export function AtlasHtmlViewer({ src, title }: AtlasHtmlViewerProps) {
  const [loaded, setLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheckIcon className="size-3.5 text-[#5C6E6C]" />
          Guía interactiva · aislada del resto de SkinDesk
        </span>
        <div className="flex items-center gap-1">
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
        </div>
      </div>

      <div
        className={
          fullscreen
            ? "fixed inset-0 z-50 flex flex-col gap-2 bg-background p-4"
            : "relative overflow-hidden rounded-2xl border bg-card"
        }
      >
        {fullscreen ? (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheckIcon className="size-3.5" />
              {title}
            </span>
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
          // No allow-same-origin → unique opaque origin → no cookie / storage
          // / parent-window access. allow-scripts is required for the guide
          // to actually work (Chart.js, tabs, etc.).
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          src={src}
          title={title}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={
            fullscreen
              ? "h-full w-full flex-1 rounded-xl border bg-white"
              : "block h-[640px] w-full bg-white"
          }
        />
      </div>

      <p className="flex items-start gap-1.5 text-xs font-medium text-foreground/75">
        <AlertTriangleIcon className="mt-0.5 size-3 shrink-0 text-[#D2A96A]" />
        Esta guía corre dentro de un sandbox: no puede leer cookies, sesiones
        ni datos de SkinDesk.
      </p>
    </div>
  );
}
