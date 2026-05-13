"use client";

import { useState } from "react";
import Image from "next/image";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AtlasImageViewerProps {
  src: string;
  alt: string;
  /** Visible caption shown under the thumbnail. */
  caption?: string;
}

/**
 * Image attachment renderer. Renders a contained, lazily-loaded thumbnail
 * that opens a lightbox dialog on click. The dialog keeps the natural
 * aspect ratio so anatomical/clinical photos aren't cropped.
 */
export function AtlasImageViewer({
  src,
  alt,
  caption,
}: AtlasImageViewerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="group relative block w-full overflow-hidden rounded-2xl border bg-card"
          >
            <span className="relative block aspect-[4/3] w-full">
              <Image
                src={src}
                alt={alt}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover transition-transform group-hover:scale-[1.02]"
              />
            </span>
            {caption ? (
              <span className="block px-3 py-2 text-left text-xs text-muted-foreground">
                {caption}
              </span>
            ) : null}
          </button>
        }
      />
      <DialogContent className="max-w-[min(96vw,1100px)] gap-0 p-2 sm:p-4">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="relative max-h-[80vh] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="mx-auto h-auto max-h-[80vh] w-auto rounded-lg object-contain"
          />
        </div>
        {caption ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {caption}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
