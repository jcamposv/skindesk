import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Ajustes</h2>
        <p className="text-sm text-muted-foreground">
          Gestiona tu cuenta y preferencias.
        </p>
      </div>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
          <CardDescription>Información básica de tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Email:</span>{" "}
            <span>{user?.email ?? "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Nombre:</span>{" "}
            <span>
              {(user?.user_metadata?.full_name as string | undefined) ?? "—"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
