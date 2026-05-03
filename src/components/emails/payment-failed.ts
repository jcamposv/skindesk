import "server-only";

import {
  button,
  callout,
  divider,
  eyebrow,
  fineprint,
  heading,
  link,
  paragraph,
  renderEmail,
  strong,
  SUPPORT_EMAIL,
} from "./_shell";

interface PaymentFailedProps {
  planName: string;
  /** Localised currency string, e.g. "$39.00". */
  amountDue: string;
  /** Human-friendly next retry date in Spanish, or null when Stripe won't retry. */
  nextAttempt: string | null;
  /** Stripe's hosted invoice URL — direct link to view & pay this specific invoice. */
  hostedInvoiceUrl: string | null;
  /** Where to send users for ongoing billing management. */
  manageBillingUrl: string;
}

/**
 * Notification we send when Stripe `invoice.payment_failed` fires for a
 * recurring charge (renewal or end-of-trial). Stripe retries automatically
 * per the Smart Retries schedule configured in Dashboard → Billing → Smart
 * Retries; this email gives the profesional context + a fast path to fix
 * the card before the retry.
 */
export function paymentFailedHtml({
  planName,
  amountDue,
  nextAttempt,
  hostedInvoiceUrl,
  manageBillingUrl,
}: PaymentFailedProps): string {
  const retryLine = nextAttempt
    ? `Volveremos a intentarlo automáticamente el ${strong(nextAttempt)}.`
    : `Para evitar la suspensión de tu cuenta, actualizá tu método de pago lo antes posible.`;

  const invoiceLine = hostedInvoiceUrl
    ? paragraph(
        `¿Querés pagar esta factura ahora? ${link(hostedInvoiceUrl, "Ver y pagar la factura")}.`,
        { html: true, muted: true },
      )
    : "";

  return renderEmail({
    title: "Tu pago no se procesó",
    preheader: `No pudimos cobrar ${amountDue} de tu plan ${planName}. Actualizá tu método de pago.`,
    body: `
      ${eyebrow("Acción requerida")}
      ${heading("Tu pago no se procesó")}
      ${paragraph(
        `No pudimos cobrar ${strong(amountDue)} por tu suscripción al plan ${strong(planName)}. Suele ser por una tarjeta vencida o con saldo insuficiente.`,
        { html: true },
      )}
      ${callout(retryLine, { tone: "warn", html: true })}
      ${button(manageBillingUrl, "Actualizar método de pago")}
      ${invoiceLine}
      ${divider()}
      ${fineprint(
        `¿Necesitás ayuda? Escribinos a ${link(`mailto:${SUPPORT_EMAIL}`, SUPPORT_EMAIL)}.`,
        { html: true },
      )}
    `,
  });
}
