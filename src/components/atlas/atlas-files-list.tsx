import { AtlasFileImage } from "@/components/atlas/atlas-file-image";
import { AtlasFileViewerToggle } from "@/components/atlas/atlas-file-viewer-toggle";
import type { AtlasFile } from "@/services/atlas.service";

interface AtlasFilesListProps {
  files: AtlasFile[];
  /** Used as the iframe title / image alt for assistive tech. */
  entryTitle: string;
}

/**
 * Server Component. Builds the list shell + dispatches each file to the
 * matching client island:
 *   · PDF / HTML → `AtlasFileViewerToggle` (collapsible, lazy viewer)
 *   · image      → `AtlasFileImage` (lightbox dialog)
 *
 * No client JS for the list itself; the heavy viewers are pulled in
 * lazily by their island.
 */
export function AtlasFilesList({ files, entryTitle }: AtlasFilesListProps) {
  // Sort: HTML first (interactive headline), then PDFs, then images.
  const order = { html: 0, pdf: 1, image: 2 } as const;
  const sorted = [...files].sort((a, b) => order[a.kind] - order[b.kind]);

  if (sorted.length === 0) return null;

  return (
    <section aria-label="Recursos" className="grid gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Recursos ({sorted.length})
      </h2>
      <ul className="grid gap-3">
        {sorted.map((file) => {
          if (file.kind === "image") {
            return (
              <li key={file.id}>
                <AtlasFileImage
                  src={file.url}
                  alt={file.original_name}
                  caption={file.original_name}
                />
              </li>
            );
          }
          return (
            <li key={file.id} className="rounded-2xl border bg-card">
              <AtlasFileViewerToggle
                kind={file.kind}
                src={file.kind === "html" ? file.htmlRoute ?? file.url : file.url}
                title={entryTitle}
                fileName={file.original_name}
                sizeBytes={file.size_bytes}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
