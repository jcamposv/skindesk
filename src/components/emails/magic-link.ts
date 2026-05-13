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

interface MagicLinkProps {
  magicLink: string;
  appUrl: string;
}

/**
 * Email sent when the user requests a magic-link sign-in from /login. Same
 * brand shell as the welcome and recovery emails so every transactional
 * email feels like SkinDesk and not Supabase's defaults.
 */
export function magicLinkHtml({ magicLink, appUrl }: MagicLinkProps): string {
  return renderEmail({
    title: "Tu enlace de acceso a SkinDesk",
    preheader:
      "Iniciá sesión sin contraseña — el enlace caduca en 30 minutos.",
    body: `
      ${eyebrow("Acceso seguro")}
      ${heading("Iniciá sesión en SkinDesk")}
      ${paragraph(
        "Haz clic en el botón para entrar sin tener que tipear contraseña — el enlace caduca en 30 minutos.",
      )}
      ${button(magicLink, "Iniciar sesión")}
      ${paragraph(
        `¿No te llegó? Pide otro desde ${link(`${appUrl}/login`, "la página de inicio de sesión")}.`,
        { html: true, muted: true },
      )}
      ${divider()}
      ${fineprint(
        "Si no pediste este enlace, puedes ignorar este correo — nadie más tendrá acceso a tu cuenta.",
      )}
    `,
  });
}
