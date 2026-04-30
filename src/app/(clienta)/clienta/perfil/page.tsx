import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { ROUTES } from "@/lib/constants";
import { getCurrentSession } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Perfil" };

export default async function ClientaPerfilPage() {
  const session = await getCurrentSession();
  if (!session) redirect(ROUTES.login);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Tu información y preferencias.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
          <CardDescription>Datos básicos asociados a tu correo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Email:</span>{" "}
            <span>{session.profile.email}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Nombre:</span>{" "}
            <span>{session.profile.full_name ?? "—"}</span>
          </div>
        </CardContent>
      </Card>

      <SignOutButton className="w-full" />
    </div>
  );
}
