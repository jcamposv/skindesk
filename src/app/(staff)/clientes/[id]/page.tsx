import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ClienteDetailHeader } from "@/components/clientes/cliente-detail-header";
import { ClienteDetailTabs } from "@/components/clientes/cliente-detail-tabs";
import {
  TABS,
  type TabKey,
} from "@/components/clientes/cliente-detail-tabs-config";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { createClient, getCurrentSession } from "@/lib/supabase/server";
import { getClienteById } from "@/services/clientes.service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const cliente = await getClienteById(supabase, id).catch(() => null);
  const name = cliente?.profile.full_name ?? "Clienta";
  return { title: `${name} · Clientes` };
}

function parseTab(
  raw: string | string[] | undefined,
): TabKey | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return undefined;
  const match = TABS.find((t) => t.key === v);
  return match?.key;
}

export default async function ClienteDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);

  if (
    session.profile.role !== "profesional" &&
    session.profile.role !== "asistente" &&
    session.profile.role !== "super_admin"
  ) {
    redirect(dashboardForRole(session.profile.role));
  }

  const supabase = await createClient();
  const cliente = await getClienteById(supabase, id);
  if (!cliente) notFound();

  return (
    // `min-w-0` is critical: without it, any descendant that exceeds the
    // viewport (long names, the tab bar, etc.) would push this grid wider
    // than the staff layout's content area and create page-level horizontal
    // scroll. Containing the overflow at the page root keeps everything
    // responsive without per-component patches.
    <div className="grid min-w-0 gap-6">
      <ClienteDetailHeader cliente={cliente} />
      <ClienteDetailTabs cliente={cliente} initialTab={parseTab(sp.tab)} />
    </div>
  );
}
