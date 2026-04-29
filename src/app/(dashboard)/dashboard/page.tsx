import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "ahí";

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Hola, {fullName}
        </h2>
        <p className="text-sm text-muted-foreground">
          Tu espacio para entender tu piel y construir rutinas personalizadas.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Perfil de piel</CardTitle>
            <CardDescription>
              Completa tu cuestionario para recibir recomendaciones.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Próximamente.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rutina del día</CardTitle>
            <CardDescription>
              Mañana y noche, paso a paso.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Próximamente.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Productos</CardTitle>
            <CardDescription>
              Análisis de ingredientes y compatibilidades.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Próximamente.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
