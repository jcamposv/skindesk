import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  AlertCircleIcon,
  ClockIcon,
  InboxIcon,
  Loader2Icon,
  MailCheckIcon,
} from "lucide-react";

import { AuthShell } from "@/components/shared/auth-shell";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { stripe } from "@/lib/stripe";

export const metadata: Metadata = { title: "Pago confirmado" };

interface PageProps {
  searchParams: Promise<{ session_id?: string }>;
}

type SessionState =
  | { kind: "complete"; email: string | null }
  | { kind: "pending" }
  | { kind: "error" };

async function resolveSessionState(sessionId: string): Promise<SessionState> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    // Trial subscriptions return payment_status "no_payment_required" — fall
    // back to status === "complete" so we don't misclassify a successful trial
    // signup as failed.
    if (
      session.status === "complete" ||
      session.payment_status === "paid"
    ) {
      return {
        kind: "complete",
        email: session.customer_details?.email ?? null,
      };
    }
    if (session.status === "open") {
      return { kind: "pending" };
    }
    return { kind: "error" };
  } catch (err) {
    console.error("[checkout/success] retrieve failed", err);
    return { kind: "error" };
  }
}

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams;
  if (!session_id) redirect(ROUTES.home);

  return (
    <AuthShell>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-10 px-6 py-12 text-center">
        <Suspense fallback={<VerifyingState />}>
          <SessionStateView sessionId={session_id} />
        </Suspense>
      </div>
    </AuthShell>
  );
}

function CompleteState({ email }: { email: string | null }) {
  return (
    <>
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
              <span className="font-medium text-foreground">{email}</span> con
              el enlace para activar tu cuenta.
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
    </>
  );
}

function PendingState() {
  return (
    <>
      <div className="flex size-24 items-center justify-center rounded-full bg-muted ring-1 ring-border">
        <ClockIcon
          className="size-11 text-muted-foreground"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>

      <div className="flex flex-col gap-4">
        <h1 className="text-balance text-4xl font-semibold tracking-tight">
          Tu pago se está procesando
        </h1>
        <p className="text-balance text-base text-muted-foreground">
          Esto puede tardar unos minutos. Cuando esté confirmado vas a recibir
          un email con el enlace para activar tu cuenta.
        </p>
      </div>

      <Button
        size="lg"
        variant="outline"
        className="h-11 w-full max-w-sm"
        render={<Link href={ROUTES.home} />}
      >
        Volver al inicio
      </Button>
    </>
  );
}

async function SessionStateView({ sessionId }: { sessionId: string }) {
  const state = await resolveSessionState(sessionId);
  if (state.kind === "complete") return <CompleteState email={state.email} />;
  if (state.kind === "pending") return <PendingState />;
  return <ErrorState />;
}

function VerifyingState() {
  return (
    <>
      <div className="flex size-24 items-center justify-center rounded-full bg-muted ring-1 ring-border">
        <Loader2Icon
          className="size-11 animate-spin text-muted-foreground"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>

      <div className="flex flex-col gap-4">
        <h1 className="text-balance text-4xl font-semibold tracking-tight">
          Confirmando tu pago…
        </h1>
        <p className="text-balance text-base text-muted-foreground">
          Estamos verificando con Stripe. Esto suele tardar menos de un
          segundo.
        </p>
      </div>
    </>
  );
}

function ErrorState() {
  return (
    <>
      <div className="flex size-24 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/20">
        <AlertCircleIcon
          className="size-11 text-destructive"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>

      <div className="flex flex-col gap-4">
        <h1 className="text-balance text-4xl font-semibold tracking-tight">
          No pudimos confirmar el pago
        </h1>
        <p className="text-balance text-base text-muted-foreground">
          Si recién pagaste, esperá un par de minutos y refrescá esta página.
          Si el problema persiste, escríbenos y te ayudamos a resolverlo.
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-3">
        <Button
          size="lg"
          className="h-11 w-full max-w-sm"
          render={<Link href={ROUTES.home} />}
        >
          Volver a elegir plan
        </Button>
        <Link
          href="mailto:hola@skindesk.app"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Contactar soporte
        </Link>
      </div>
    </>
  );
}
