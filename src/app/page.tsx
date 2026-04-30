import Link from "next/link";
import { redirect } from "next/navigation";

import { PlanCard } from "@/components/marketing/plan-card";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ROUTES, dashboardForRole } from "@/lib/constants";
import { PLANS } from "@/lib/plans";
import { getCurrentSession } from "@/lib/supabase/server";

export default async function HomePage() {
  // Authed users skip the landing entirely — they belong on their dashboard.
  const session = await getCurrentSession();
  if (session) redirect(dashboardForRole(session.profile.role));

  return (
    <main className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <Logo size="md" />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            render={<Link href={ROUTES.login} />}
            className="hidden sm:inline-flex"
          >
            Iniciar sesión
          </Button>
          <Button
            variant="outline"
            render={<Link href={ROUTES.login} />}
            className="sm:hidden"
          >
            Entrar
          </Button>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-12 px-6 pt-10 pb-20 md:pt-20">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent-foreground ring-1 ring-accent/30">
            Software para cosmetología y estética
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Gestiona tu clínica de piel con el plan que necesitas
          </h1>
          <p className="max-w-2xl text-balance text-muted-foreground">
            Agenda, fichas de clientas, catálogo y reportes — todo en un solo
            lugar. Empieza con 14 días de prueba; sin permanencia, cancela
            cuando quieras.
          </p>
        </div>

        <div className="grid w-full gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.slug} plan={plan} />
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          ¿Eres clienta de una profesional? Te llegará una invitación por email.
          Las clientas no se registran solas.
        </p>
      </section>
    </main>
  );
}
