import "server-only";

interface WelcomeProfesionalProps {
  fullName: string;
  planName: string;
  magicLink: string;
  /** Public URL of the app — used for the "alternative login" link. */
  appUrl: string;
}

/**
 * Plain-HTML transactional template for the post-checkout welcome email.
 * We avoid React Email here to keep the dependency surface small — this
 * email is short, doesn't reuse layout primitives, and doesn't need a
 * preview server. Switch to React Email if SkinDesk grows past 3-4
 * transactional templates.
 */
export function welcomeProfesionalHtml({
  fullName,
  planName,
  magicLink,
  appUrl,
}: WelcomeProfesionalProps): string {
  // The Balsam-on-cream palette mirrors the in-app design without going
  // wild with custom CSS — most email clients still render inline styles
  // best, so we keep this template simple.
  return `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8" /><title>Bienvenida a SkinDesk</title></head>
  <body style="margin:0;background:#f5f4ef;font-family:'Inter',Arial,sans-serif;color:#0a0a0a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ef;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:520px;width:100%;">
          <tr><td style="background:#5C6E6C;padding:24px 32px;color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.01em;">SkinDesk</td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;line-height:1.3;">Hola ${escape(fullName)}, ¡bienvenida a SkinDesk!</h1>
            <p style="margin:0 0 16px;line-height:1.6;color:#404040;">Tu suscripción al plan <strong>${escape(planName)}</strong> ya está activa. Para entrar a tu panel solo hace falta que confirmes tu cuenta:</p>
            <p style="margin:24px 0;">
              <a href="${escape(magicLink)}" style="display:inline-block;background:#5C6E6C;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:500;">Activar mi cuenta</a>
            </p>
            <p style="margin:16px 0 0;font-size:13px;color:#737373;line-height:1.6;">Este enlace caduca en 1 hora. Si caduca, pedí uno nuevo desde <a href="${escape(appUrl)}/login" style="color:#5C6E6C;">la página de inicio de sesión</a>.</p>
            <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
            <p style="margin:0 0 8px;font-size:13px;color:#404040;line-height:1.6;"><strong>Tip:</strong> después de tu primer ingreso te vamos a pedir crear una contraseña — así podés iniciar sesión rápido sin esperar el magic link cada vez.</p>
            <p style="margin:8px 0 0;font-size:13px;color:#737373;line-height:1.6;">¿Preguntas? Respondé este correo y te contestamos directo.</p>
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
