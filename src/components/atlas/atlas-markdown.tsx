import { cn } from "@/lib/utils";

interface AtlasMarkdownProps {
  source: string;
  className?: string;
}

/**
 * Lightweight Markdown renderer for the body field of an Atlas entry. We
 * intentionally don't ship a full Markdown parser (no `react-markdown` /
 * `remark` dependency) — the Atlas body is short, curator-authored, and we
 * only need a handful of block-level constructs to feel like a reading
 * experience.
 *
 * Supported syntax (in priority order):
 *   ## Heading
 *   ### Heading
 *   - bullet list
 *   numbered list (1. …)
 *   > blockquote
 *   plain paragraphs
 *
 * Everything else is rendered as a paragraph with line breaks preserved.
 * Inline `**bold**` and `_italic_` get a minimal substitution pass.
 *
 * IMPORTANT: input is curator content authored by super_admin. We still
 * escape every fragment before injecting it so an accidental `<script>` in
 * the body can never execute. The inline `**bold**` / `_italic_`
 * substitution operates on already-escaped text so it cannot produce
 * arbitrary attributes.
 */
export function AtlasMarkdown({ source, className }: AtlasMarkdownProps) {
  const blocks = parse(source);
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none text-foreground/90",
        "[&_h2]:font-heading [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-medium",
        "[&_h3]:font-heading [&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-medium",
        "[&_p]:my-2 [&_p]:leading-relaxed",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-[#D2A96A] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
        "[&_strong]:font-semibold",
        className,
      )}
    >
      {blocks.map((block, idx) => (
        <div key={idx} dangerouslySetInnerHTML={{ __html: block }} />
      ))}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inline(s: string): string {
  // s is already escaped — operate on safe text only.
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])_([^_]+)_(?=$|[\s.,!?)])/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function parse(source: string): string[] {
  const lines = source.split(/\r?\n/);
  const blocks: string[] = [];

  let buffer: string[] = [];
  let mode: "p" | "ul" | "ol" | "quote" | null = null;

  const flush = () => {
    if (buffer.length === 0) {
      mode = null;
      return;
    }
    if (mode === "p") {
      blocks.push(`<p>${inline(buffer.join("<br>"))}</p>`);
    } else if (mode === "ul") {
      blocks.push(
        `<ul>${buffer.map((b) => `<li>${inline(b)}</li>`).join("")}</ul>`,
      );
    } else if (mode === "ol") {
      blocks.push(
        `<ol>${buffer.map((b) => `<li>${inline(b)}</li>`).join("")}</ol>`,
      );
    } else if (mode === "quote") {
      blocks.push(`<blockquote>${inline(buffer.join(" "))}</blockquote>`);
    }
    buffer = [];
    mode = null;
  };

  for (const rawLine of lines) {
    const line = escapeHtml(rawLine);
    if (line.trim() === "") {
      flush();
      continue;
    }
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      flush();
      blocks.push(`<h2>${inline(h2[1])}</h2>`);
      continue;
    }
    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3) {
      flush();
      blocks.push(`<h3>${inline(h3[1])}</h3>`);
      continue;
    }
    const li = /^[-*]\s+(.+)$/.exec(line);
    if (li) {
      if (mode !== "ul") flush();
      mode = "ul";
      buffer.push(li[1]);
      continue;
    }
    const oli = /^\d+\.\s+(.+)$/.exec(line);
    if (oli) {
      if (mode !== "ol") flush();
      mode = "ol";
      buffer.push(oli[1]);
      continue;
    }
    const q = /^&gt;\s+(.+)$/.exec(line);
    if (q) {
      if (mode !== "quote") flush();
      mode = "quote";
      buffer.push(q[1]);
      continue;
    }
    if (mode !== "p") flush();
    mode = "p";
    buffer.push(line);
  }
  flush();
  return blocks;
}
