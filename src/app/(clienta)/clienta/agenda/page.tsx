import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Agenda" };

export default function ClientaAgendaPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Tus próximas citas y reservas.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Sin citas agendadas</CardTitle>
          <CardDescription>
            Cuando reserves un tratamiento aparecerá aquí.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Próximamente.
        </CardContent>
      </Card>
    </div>
  );
}
