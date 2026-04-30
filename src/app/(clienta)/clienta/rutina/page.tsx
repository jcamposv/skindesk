import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Rutina" };

export default function ClientaRutinaPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Rutina</h1>
        <p className="text-sm text-muted-foreground">
          Tu ritual de mañana y noche, paso a paso.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Aún no tienes rutina</CardTitle>
          <CardDescription>
            Tu profesional configurará tu rutina personalizada después de tu
            primera cita.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Próximamente.
        </CardContent>
      </Card>
    </div>
  );
}
