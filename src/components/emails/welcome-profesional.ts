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
  // First-name greeting feels personal; gender stays neutral by saying
  // "te damos la bienvenida" instead of "bienvenida/bienvenido".
  const firstName = fullName.trim().split(/\s+/)[0] || fullName;

  return renderEmail({
    title: "Tu cuenta de SkinDesk está lista",
    preheader: `Tu plan ${planName} ya está activo. Activa tu cuenta para entrar al panel.`,
    body: `
      ${eyebrow("Tu cuenta está lista")}
      ${heading(`Hola ${firstName}, te damos la bienvenida a SkinDesk.`)}
      ${paragraph(
        `Tu suscripción al plan ${strong(planName)} ya está activa. Para entrar a tu panel solo necesitas confirmar tu cuenta — el enlace caduca en 30 minutos.`,
        { html: true },
      )}
      ${button(magicLink, "Activar mi cuenta")}
      ${paragraph(
        `¿No te llegó o ya expiró? Solicita uno nuevo desde ${link(`${appUrl}/login`, "la página de inicio de sesión")}.`,
        { html: true, muted: true },
      )}
      ${callout(
        `${strong("Sugerencia:")} en tu primer ingreso te pediremos crear una contraseña — así inicias sesión sin esperar un enlace nuevo cada vez.`,
        { html: true },
      )}
      ${divider()}
      ${fineprint(
        `¿Tienes preguntas? Escríbenos a ${link(`mailto:${SUPPORT_EMAIL}`, SUPPORT_EMAIL)}.`,
        { html: true },
      )}
    `,
  });
}
