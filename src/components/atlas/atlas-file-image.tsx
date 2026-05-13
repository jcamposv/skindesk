"use client";

import dynamic from "next/dynamic";

// Image attachments use the existing AtlasImageViewer (Dialog-based
// lightbox). It's client-only by definition (Dialog is reactive); we
// `next/dynamic`-load it so the JS only ships when at least one image
// attachment is on the page.
const AtlasImageViewer = dynamic(
  () =>
    import("@/components/atlas/atlas-image-viewer").then(
      (m) => m.AtlasImageViewer,
    ),
  { ssr: false },
);

interface AtlasFileImageProps {
  src: string;
  alt: string;
  caption?: string;
}

/** Thin client island wrapping the lightbox viewer. Lets the parent
 *  `AtlasFilesList` stay a Server Component while keeping the dialog
 *  interaction client-side. */
export function AtlasFileImage(props: AtlasFileImageProps) {
  return <AtlasImageViewer {...props} />;
}
