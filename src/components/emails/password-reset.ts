import "server-only";

import {
  button,
  divider,
  eyebrow,
  fineprint,
  heading,
  link,
  paragraph,
  renderEmail,
} from "./_shell";

interface PasswordResetProps {
  resetLink: string;
  appUrl: string;
}

/**
 * Email sent when the user requests a password reset from /forgot-password.
 * After clicking the link, the auth callback verifies + redirects to
 * /auth/setup where the user picks a new password.
 */
export function passwordResetHtml({
  resetLink,
  appUrl,
}: PasswordResetProps): string {
  return renderEmail({
    title: "Restablecé tu contraseña",
    preheader:
      "Pediste cambiar tu contraseña — usá el botón de abajo para elegir una nueva.",
    body: `
      ${eyebrow("Recuperar acceso")}
      ${heading("Restablecé tu contraseña")}
      ${paragraph(
        "Recibimos una solicitud para restablecer tu contraseña. Hacé clic en el botón para elegir una nueva — el enlace caduca en 30 minutos.",
      )}
      ${button(resetLink, "Restablecer contraseña")}
      ${paragraph(
        `¿No funciona el botón? Pedí uno nuevo desde ${link(`${appUrl}/forgot-password`, "olvidé mi contraseña")}.`,
        { html: true, muted: true },
      )}
      ${divider()}
      ${fineprint(
        "Si no pediste este cambio, podés ignorar este correo — tu contraseña actual sigue funcionando y nadie más tendrá acceso a tu cuenta.",
      )}
    `,
  });
}
