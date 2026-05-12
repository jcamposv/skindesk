import "server-only";

import {
  callout,
  divider,
  eyebrow,
  fineprint,
  heading,
  link,
  paragraph,
  renderEmail,
  strong,
} from "./_shell";

interface CitaAgendadaProps {
  /** Personalised greeting target — the clienta's name. */
  clientaName: string;
  /** Display name of the profesional / business that scheduled it. */
  scheduledByName: string;
  /** Optional — service the cita is for (e.g. "Limpieza facial"). */
  servicioName: string | null;
  /** Tenant-local datetime (e.g. "miércoles 14 de mayo · 15:00"). */
  whenLabel: string;
  /** Optional — name of the assigned profesional shown in the body. */
  professionalName: string | null;
  /** Optional — notes/preparation the profesional left on the cita. */
  notes: string | null;
  /** Public app URL — used for the "ver agenda" link in the footer area. */
  appUrl: string;
}

/**
 * Sent to the clienta when a profesional/asistente books a new cita for
 * her. Mirrors the brand shell + helpers of the other transactional emails
 * (welcome, magic-link, invite) so the inbox experience stays consistent.
 *
 * Idempotency is handled by the caller via the cita id — Resend dedupes
 * within 24h, so accidental double-sends from action retries are safe.
 */
export function citaAgendadaHtml({
  clientaName,
  scheduledByName,
  servicioName,
  whenLabel,
  professionalName,
  notes,
  appUrl,
}: CitaAgendadaProps): string {
  const firstName = clientaName.split(" ")[0] || clientaName;

  const detailsRows: string[] = [
    `${strong("Fecha y hora")}: ${whenLabel}`,
  ];
  if (servicioName) detailsRows.push(`${strong("Servicio")}: ${servicioName}`);
  if (professionalName)
    detailsRows.push(`${strong("Profesional")}: ${professionalName}`);

  return renderEmail({
    title: "Tenés una cita agendada en SkinDesk",
    preheader: `${scheduledByName} agendó tu próxima cita: ${whenLabel}.`,
    body: `
      ${eyebrow("Nueva cita confirmada")}
      ${heading(`¡Hola ${firstName}!`)}
      ${paragraph(
        `${strong(scheduledByName)} acaba de agendar una cita para vos. Te dejamos los detalles abajo para que no se te pase.`,
        { html: true },
      )}
      ${callout(detailsRows.join("<br/>"), { html: true })}
      ${
        notes && notes.trim().length > 0
          ? paragraph(
              `${strong("Notas:")} ${notes.trim()}`,
              { html: true },
            )
          : ""
      }
      ${paragraph(
        "Si no podés asistir, avisanos con la mayor antelación posible respondiendo este correo.",
        { muted: true },
      )}
      ${divider()}
      ${fineprint(
        `Podés ver todas tus citas en cualquier momento desde tu portal: ${link(appUrl, "skindesk.co")}.`,
        { html: true },
      )}
    `,
  });
}
