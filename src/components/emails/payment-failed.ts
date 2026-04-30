import "server-only";

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
    ? `Volveremos a intentarlo automáticamente el ${escape(nextAttempt)}.`
    : `Para evitar la suspensión de tu cuenta, actualizá tu método de pago lo antes posible.`;

  const invoiceLink = hostedInvoiceUrl
    ? `<p style="margin:16px 0 0;font-size:13px;color:#737373;line-height:1.6;">¿Querés pagar esta factura ahora? <a href="${escape(hostedInvoiceUrl)}" style="color:#5C6E6C;">Ver y pagar la factura</a>.</p>`
    : "";

  return `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8" /><title>Tu pago no se procesó</title></head>
  <body style="margin:0;background:#f5f4ef;font-family:'Inter',Arial,sans-serif;color:#0a0a0a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ef;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:520px;width:100%;">
          <tr><td style="background:#5C6E6C;padding:24px 32px;color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.01em;">SkinDesk</td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;line-height:1.3;">Tu pago no se procesó</h1>
            <p style="margin:0 0 16px;line-height:1.6;color:#404040;">No pudimos cobrar <strong>${escape(amountDue)}</strong> por tu suscripción al plan <strong>${escape(planName)}</strong>. Suele ser por una tarjeta vencida o con saldo insuficiente.</p>
            <p style="margin:0 0 16px;line-height:1.6;color:#404040;">${retryLine}</p>
            <p style="margin:24px 0;">
              <a href="${escape(manageBillingUrl)}" style="display:inline-block;background:#5C6E6C;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:500;">Actualizar método de pago</a>
            </p>
            ${invoiceLink}
            <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
            <p style="margin:0;font-size:13px;color:#737373;line-height:1.6;">¿Necesitás ayuda? Respondé este correo y te respondemos directo.</p>
          </td></tr>
          <tr><td style="background:#fafafa;padding:16px 32px;font-size:12px;color:#a3a3a3;text-align:center;">
            SkinDesk · Software para cosmetología y estética
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
