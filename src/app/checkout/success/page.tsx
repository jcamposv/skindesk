import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InboxIcon, MailCheckIcon } from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { stripe } from "@/lib/stripe";

export const metadata: Metadata = { title: "Pago confirmado" };

interface PageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams;
  if (!session_id) redirect(ROUTES.home);

  // We don't trust the URL on its own — fetch the session to confirm the
  // user actually completed the checkout. The webhook is what creates the
  // account; this page is just a friendly confirmation.
  let email: string | null = null;
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === "paid" || session.status === "complete") {
      email = session.customer_details?.email ?? null;
    }
  } catch {
    // Bad session id — fall through to the generic message.
  }

  return (
    <main className="flex min-h-svh flex-col">
      <header className="border-b border-border px-6 py-4 sm:px-10">
        <Link href={ROUTES.home} aria-label="SkinDesk">
          <Logo size="md" />
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-10 px-6 py-12 text-center">
        <div className="relative">
          <div
            className="absolute -inset-3 rounded-full bg-accent/5"
            aria-hidden
          />
          <div className="relative flex size-24 items-center justify-center rounded-full bg-accent/10 ring-1 ring-accent/20">
            <MailCheckIcon
              className="size-11 text-accent"
              strokeWidth={1.5}
              aria-hidden
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-balance text-4xl font-semibold tracking-tight">
            ¡Pago confirmado!
          </h1>
          <p className="text-balance text-base text-muted-foreground">
            {email ? (
              <>
                Te enviamos un email a{" "}
                <span className="font-medium text-foreground">{email}</span>{" "}
                con el enlace para activar tu cuenta.
              </>
            ) : (
              "Te enviamos un email con el enlace para activar tu cuenta."
            )}
          </p>
        </div>

        <div className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-left">
          <InboxIcon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              ¿No lo encuentras?
            </span>{" "}
            Revisá también tu carpeta de spam o promociones — el enlace puede
            tardar hasta un minuto en llegar.
          </p>
        </div>

        <Button
          size="lg"
          className="h-11 w-full max-w-sm"
          render={<Link href={ROUTES.login} />}
        >
          Ir a iniciar sesión
        </Button>
      </div>

      <footer className="border-t border-border px-6 py-6 sm:px-10">
        <div className="mx-auto flex max-w-md flex-col items-center gap-1 text-center text-xs text-muted-foreground">
          <div className="space-x-3">
            <Link
              href="#"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Términos
            </Link>
            <span aria-hidden>·</span>
            <Link
              href="#"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Política de privacidad
            </Link>
          </div>
          <p>© {new Date().getFullYear()} SkinDesk. Todos los derechos reservados.</p>
        </div>
      </footer>
    </main>
  );
}
