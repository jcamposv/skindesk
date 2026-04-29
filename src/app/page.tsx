import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { APP_DESCRIPTION, ROUTES } from "@/lib/constants";

export default function HomePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-6 text-center">
      <Logo size="lg" />
      <p className="max-w-xl text-balance text-muted-foreground">
        {APP_DESCRIPTION}
      </p>
      <div className="flex gap-3">
        <Button render={<Link href={ROUTES.login} />}>Iniciar sesión</Button>
        <Button variant="outline" render={<Link href={ROUTES.register} />}>
          Crear cuenta
        </Button>
      </div>
    </main>
  );
}
