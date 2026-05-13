import "server-only";

import {
  button,
  divider,
  eyebrow,
  fineprint,
  heading,
  paragraph,
  renderEmail,
  strong,
} from "./_shell";

interface ShareInviteProps {
  rutinaName: string;
  senderName: string;
  shareUrl: string;
}

/**
 * Profesional → Profesional share invite. Generic body — no clienta
 * names, no clinical notes, no producto detail (which would risk leaking
 * the source tenant's catalog if the email gets forwarded).
 */
export function shareInviteHtml({
  rutinaName,
  senderName,
  shareUrl,
}: ShareInviteProps): string {
  return renderEmail({
    title: `${senderName} compartió una rutina contigo`,
    preheader: `Recibiste la rutina "${rutinaName}". Necesitas una membresía activa para abrirla.`,
    body: `
      ${eyebrow("Rutina compartida")}
      ${heading(`${senderName} te compartió una rutina`)}
      ${paragraph(
        `${strong(rutinaName)} está disponible para que la veas en tu cuenta de SkinDesk. Si te resulta útil, puedes importarla a tu biblioteca con un clic — la copia queda bajo tu control y la original no se modifica.`,
        { html: true },
      )}
      ${button(shareUrl, "Ver la rutina")}
      ${paragraph(
        "Para abrir el enlace necesitas iniciar sesión con una cuenta de SkinDesk con membresía activa.",
        { muted: true },
      )}
      ${divider()}
      ${fineprint(
        "Este enlace no incluye datos de clientas, notas clínicas ni historial de asignaciones — esa información es privada de cada profesional.",
      )}
    `,
  });
}
