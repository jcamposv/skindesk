import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentSession } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inicio" };

export default async function ClientaHomePage() {
  // Layout already enforces role=clienta and authentication, so the session
  // is non-null here. cache() makes this a free re-read.
  const session = await getCurrentSession();
  const fullName =
    session?.profile.full_name ??
    session?.user.email?.split("@")[0] ??
    "ahí";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Hola
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Próxima cita</CardTitle>
          <CardDescription>Reserva o gestiona tus tratamientos.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No tienes citas agendadas.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tu rutina</CardTitle>
          <CardDescription>Lo que toca esta semana.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Próximamente.
        </CardContent>
      </Card>
    </div>
  );
}
