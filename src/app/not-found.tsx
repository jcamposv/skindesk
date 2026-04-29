import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="max-w-md text-center">
        <Compass className="mx-auto mb-4 size-10 text-primary" aria-hidden />
        <h2 className="mb-2 text-xl font-semibold">Página no encontrada</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          La ruta que buscas no existe o fue movida.
        </p>
        <Button render={<Link href={ROUTES.dashboard} />}>
          Ir al dashboard
        </Button>
      </div>
    </div>
  );
}
