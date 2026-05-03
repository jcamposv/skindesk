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

interface WelcomeProfesionalProps {
  fullName: string;
  planName: string;
  magicLink: string;
  appUrl: string;
}

/**
 * Welcome email dispatched right after a successful Stripe checkout. The
 * embedded magic-link logs the user in and routes them to /auth/setup so
 * they can pick a password before reaching the dashboard.
 */
export function welcomeProfesionalHtml({
  fullName,
  planName,
  magicLink,
  appUrl,
}: WelcomeProfesionalProps): string {
  // Keep the user-facing greeting safely escaped — fullName comes straight
  // from Stripe metadata. The shell helpers each escape what they receive,
  // so we only need to escape when we hand-assemble HTML in `paragraph(…,
  // { html: true })`.
  return renderEmail({
    title: "Bienvenida a SkinDesk",
    preheader: `Tu plan ${planName} ya está activo — activá tu cuenta para entrar al panel.`,
    body: `
      ${eyebrow("Tu cuenta está lista")}
      ${heading(`Hola ${fullName}, ¡bienvenida a SkinDesk!`)}
      ${paragraph(
        `Tu suscripción al plan ${strong(planName)} ya está activa. Para entrar a tu panel solo hace falta que confirmes tu cuenta — el enlace caduca en 30 minutos.`,
        { html: true },
      )}
      ${button(magicLink, "Activar mi cuenta")}
      ${paragraph(
        `¿No te llegó o expiró? Pedí uno nuevo desde ${link(`${appUrl}/login`, "la página de inicio de sesión")}.`,
        { html: true, muted: true },
      )}
      ${callout(
        `${strong("Tip:")} después de tu primer ingreso te vamos a pedir crear una contraseña — así podés iniciar sesión rápido sin esperar el magic link cada vez.`,
        { html: true },
      )}
      ${divider()}
      ${fineprint(
        `¿Preguntas? Escribinos a ${link(`mailto:${SUPPORT_EMAIL}`, SUPPORT_EMAIL)}.`,
        { html: true },
      )}
    `,
  });
}
