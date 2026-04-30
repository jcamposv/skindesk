import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2Icon } from "lucide-react";

import { Logo } from "@/components/shared/logo";
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
    } else {
      // Still processing or failed — let the user know to check their inbox.
    }
  } catch {
    // Bad session id — fall through to the generic message.
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <Logo size="sm" />
      <CheckCircle2Icon className="size-14 text-accent" aria-hidden />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          ¡Pago confirmado!
        </h1>
        <p className="text-sm text-muted-foreground">
          {email ? (
            <>
              Te enviamos un email a <span className="font-medium">{email}</span>{" "}
              con el enlace para activar tu cuenta.
            </>
          ) : (
            "Te enviamos un email con el enlace para activar tu cuenta."
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          Revisa también tu carpeta de spam si no lo encuentras en unos minutos.
        </p>
      </div>
      <Link
        href={ROUTES.login}
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Ir a iniciar sesión
      </Link>
    </main>
  );
}
