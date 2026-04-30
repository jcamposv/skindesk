import "server-only";

interface MagicLinkProps {
  magicLink: string;
  /** Public URL of the app — used in copy and footer. */
  appUrl: string;
}

/**
 * Email sent when the user requests a magic-link sign-in from /login. Same
 * brand shell as the welcome email so every transactional email feels like
 * SkinDesk and not Supabase's defaults.
 */
export function magicLinkHtml({ magicLink, appUrl }: MagicLinkProps): string {
  return `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8" /><title>Tu enlace de acceso a SkinDesk</title></head>
  <body style="margin:0;background:#f5f4ef;font-family:'Inter',Arial,sans-serif;color:#0a0a0a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ef;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:520px;width:100%;">
          <tr><td style="background:#5C6E6C;padding:24px 32px;color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.01em;">SkinDesk</td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;line-height:1.3;">Iniciá sesión en SkinDesk</h1>
            <p style="margin:0 0 16px;line-height:1.6;color:#404040;">Hace clic en el botón para iniciar sesión sin tener que tipear contraseña:</p>
            <p style="margin:24px 0;">
              <a href="${escape(magicLink)}" style="display:inline-block;background:#5C6E6C;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:500;">Iniciar sesión</a>
            </p>
            <p style="margin:16px 0 0;font-size:13px;color:#737373;line-height:1.6;">El enlace caduca en 1 hora. Si no funciona, podés pedir uno nuevo desde <a href="${escape(appUrl)}/login" style="color:#5C6E6C;">la página de inicio de sesión</a>.</p>
            <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0;" />
            <p style="margin:0;font-size:13px;color:#737373;line-height:1.6;">Si no pediste este enlace, podés ignorar este correo — nadie podrá entrar a tu cuenta.</p>
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
