import "server-only";

import {
  button,
  callout,
  divider,
  eyebrow,
  fineprint,
  heading,
  paragraph,
  renderEmail,
  strong,
} from "./_shell";

interface RutinaAssignedProps {
  clienteName: string;
  profesionalName: string;
  rutinaName: string;
  portalUrl: string;
  /** Optional message the profesional left on the assignment. Strip
   *  clinical content upstream — it's rendered inside the body. */
  message?: string | null;
}

/**
 * Cliente-facing notification triggered when a profesional assigns a
 * rutina. No clinical content, no producto detail — those live behind
 * portal auth.
 */
export function rutinaAssignedHtml({
  clienteName,
  profesionalName,
  rutinaName,
  portalUrl,
  message,
}: RutinaAssignedProps): string {
  const firstName = clienteName.split(" ")[0] || clienteName;
  const trimmed = message?.trim();

  return renderEmail({
    title: `${profesionalName} te asignó una rutina`,
    preheader: `Tu rutina "${rutinaName}" ya está disponible en tu portal de SkinDesk.`,
    body: `
      ${eyebrow("Tu nueva rutina")}
      ${heading(`Hola ${firstName},`)}
      ${paragraph(
        `${strong(profesionalName)} te asignó una rutina personalizada: ${strong(rutinaName)}. Desde tu portal puedes ver cada paso con sus productos y tiempos.`,
        { html: true },
      )}
      ${
        trimmed
          ? callout(`“${trimmed}”`, { tone: "info" })
          : ""
      }
      ${button(portalUrl, "Ver mi rutina")}
      ${paragraph(
        "Si tienes dudas sobre algún paso, escríbele a tu profesional desde el portal.",
        { muted: true },
      )}
      ${divider()}
      ${fineprint(
        "Si recibiste este correo por error, puedes ignorarlo — tu profesional puede actualizar la asignación en cualquier momento.",
      )}
    `,
  });
}
