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
    title: `${senderName} compartió una rutina con vos`,
    preheader: `${senderName} te compartió la rutina "${rutinaName}". Necesitás membresía activa para abrirla.`,
    body: `
      ${eyebrow("Rutina compartida")}
      ${heading(`${senderName} te compartió una rutina`)}
      ${paragraph(
        `${strong(rutinaName)} está disponible para que la veas en tu cuenta SkinDesk. Si te sirve, podés importarla a tu biblioteca con un click — la copia queda totalmente bajo tu control y la original no se modifica.`,
        { html: true },
      )}
      ${button(shareUrl, "Ver la rutina")}
      ${paragraph(
        "Para abrir el link necesitás iniciar sesión con una cuenta de SkinDesk con membresía activa.",
        { muted: true },
      )}
      ${divider()}
      ${fineprint(
        "Este link no incluye datos de clientas, notas clínicas ni historial de asignaciones — son privados de cada profesional.",
      )}
    `,
  });
}
