import { NextResponse } from "next/server";

import { createClient, getCurrentSession } from "@/lib/supabase/server";

/**
 * GET /api/atlas/files/<fileId>/html
 *
 * Streams an Atlas HTML guide back to the browser with the canonical
 * `Content-Type: text/html` header. Two reasons for the route:
 *
 *   1. **Bypass storage Content-Type quirks.** Files uploaded before the
 *      content-type fix landed (or via tools that don't set it) are
 *      served from Supabase as `text/plain` / `application/octet-stream`,
 *      which makes the iframe render the source code instead of the page.
 *      This route re-serves with the correct header regardless.
 *
 *   2. **Single URL for inline iframe AND "open in new tab".** The reader
 *      uses this URL as the iframe `src` so we no longer ship the file
 *      inline as `srcDoc` (cheap on payload). Same URL works for the
 *      "Abrir" button in a new tab — the user gets a real HTML page,
 *      not a download.
 *
 * Auth: every staff role can read published Atlas content; super_admin
 * additionally sees drafts. We mirror the same gate the page uses so a
 * direct hit on the route can't bypass it.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ fileId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { fileId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) {
    return new NextResponse("Invalid file id", { status: 400 });
  }

  const session = await getCurrentSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const role = session.profile.role;
  if (role !== "super_admin" && role !== "profesional" && role !== "asistente") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = await createClient();

  // Pull the file row with its parent entry status. RLS already gates non-
  // super_admin to files whose entry is `published`, so the inner select
  // is paranoia — we mirror it here to fail fast with a 404 instead of an
  // RLS-empty response.
  const { data: file, error: fileErr } = await supabase
    .from("atlas_files")
    .select("storage_path, kind, original_name, atlas_entries(status)")
    .eq("id", fileId)
    .maybeSingle();

  if (fileErr || !file) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (file.kind !== "html") {
    return new NextResponse("Not an HTML guide", { status: 400 });
  }

  // Defence in depth: even though RLS hid non-published rows from
  // professionals, double-check status when we have it.
  const entryStatus = Array.isArray(file.atlas_entries)
    ? file.atlas_entries[0]?.status
    : file.atlas_entries?.status;
  if (role !== "super_admin" && entryStatus !== "published") {
    return new NextResponse("Not found", { status: 404 });
  }

  // Download from storage server-side. RLS on storage.objects also lets
  // staff SELECT objects in the `atlas` bucket so this works for every
  // allowed role with the user's session.
  const { data: blob, error: dlErr } = await supabase.storage
    .from("atlas")
    .download(file.storage_path);
  if (dlErr || !blob) {
    return new NextResponse("Storage error", { status: 502 });
  }

  const arrayBuffer = await blob.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Keep the sandbox-friendly bits. The iframe in the viewer has its
      // own sandbox; these belt-and-braces headers harden the route in
      // case someone hits it directly.
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      // No caching across users — RLS branches by role and entry status,
      // so a cached response could leak draft content to a professional
      // who hits the URL after a super_admin previewed it.
      "Cache-Control": "private, no-store",
    },
  });
}
