import { renderToBuffer } from "@react-pdf/renderer";

import { RutinaPDF } from "@/components/rutinas/pdf/rutina-pdf";
import { getCurrentSession } from "@/lib/supabase/server";
import { getRutinaByShareToken } from "@/services/rutinas.service";

export const dynamic = "force-dynamic";

/**
 * GET /rutinas/share/<token>/pdf
 *
 * PDF download for the shared-template viewer. Mirrors the per-id route's
 * auth gate, but resolves through `getRutinaByShareToken` (admin client)
 * so cross-tenant professionals can pull the document. Asistentes and
 * inactive subscriptions are blocked here too — keeping parity with the
 * page's viewer.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  const session = await getCurrentSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "super_admin"
  ) {
    return new Response("Forbidden", { status: 403 });
  }
  if (session.profile.role !== "super_admin") {
    const status = session.tenant?.subscription_status ?? null;
    const isActive = status === "active" || status === "trialing";
    if (!isActive) {
      return new Response("Membresía inactiva", { status: 402 });
    }
  }

  const { token } = await ctx.params;
  const rutina = await getRutinaByShareToken(token);
  if (!rutina) {
    return new Response("Rutina no encontrada", { status: 404 });
  }

  // Shared templates never carry clienta data — pass `null` so the
  // brand strip falls back to the routine name.
  const buffer = await renderToBuffer(
    <RutinaPDF rutina={rutina} clientName={null} />,
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
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "rutina"
  );
}
