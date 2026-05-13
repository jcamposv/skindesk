import { renderToBuffer } from "@react-pdf/renderer";

import { RutinaPDF } from "@/components/rutinas/pdf/rutina-pdf";
import { getCurrentSession } from "@/lib/supabase/server";
import { getClienteById } from "@/services/clientes.service";
import { getRutinaWithSteps } from "@/services/rutinas.service";

export const dynamic = "force-dynamic";

/**
 * GET /rutinas/<id>/pdf
 *
 * Streams a single-template PDF of the rutina. Auth + tenant scoping flow
 * through `getRutinaWithSteps` → Supabase RLS; if the caller doesn't have
 * access the query returns null and we 404. Signed product photo URLs are
 * minted inside the service (1h TTL) which is plenty for a server-side
 * render.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getCurrentSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await ctx.params;
  const rutina = await getRutinaWithSteps(id);
  if (!rutina) {
    return new Response("Rutina no encontrada", { status: 404 });
  }

  // For assignment-kind rutinas, surface the clienta's name in the brand
  // strip (mirrors the design reference). Templates pass null and the
  // pill falls back to the rutina name.
  let clientName: string | null = null;
  if (rutina.kind === "assignment" && rutina.cliente_id) {
    const cliente = await getClienteById(rutina.cliente_id).catch(() => null);
    clientName = cliente?.profile.full_name ?? null;
  }

  const buffer = await renderToBuffer(
    <RutinaPDF rutina={rutina} clientName={clientName} />,
  );

  const filename = `rutina-${slugify(rutina.name)}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "rutina";
}
