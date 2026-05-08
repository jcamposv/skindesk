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
  strong,
} from "./_shell";

interface ClienteInviteProps {
  /** Personalized greeting target. */
  clientaName: string;
  /** Profesional / business that sent the invite — appears in the body. */
  invitedByName: string;
  /** Magic action_link returned by `auth.admin.generateLink({type:'invite'})`. */
  inviteLink: string;
  /** Used to point at the public site for the "didn't expect this?" line. */
  appUrl: string;
}

/**
 * First-touch invite that goes out when a profesional creates a clienta from
 * /clientes. Same brand shell as the welcome / magic-link / recovery emails
 * so the clienta gets a consistent SkinDesk experience even before she lands
 * inside the app.
 */
export function clienteInviteHtml({
  clientaName,
  invitedByName,
  inviteLink,
  appUrl,
}: ClienteInviteProps): string {
  const firstName = clientaName.split(" ")[0] || clientaName;

  return renderEmail({
    title: "Te invitaron a tu portal SkinDesk",
    preheader: `${invitedByName} te creó un portal personal para tu seguimiento estético.`,
    body: `
      ${eyebrow("Tu portal personal")}
      ${heading(`¡Hola ${firstName}! ✨`)}
      ${paragraph(
        `${strong(invitedByName)} te dio acceso a tu portal de seguimiento en SkinDesk — un espacio privado donde vas a poder ver tus rutinas, citas, fotos de evolución y notas de tu cosmetóloga, todo en un solo lugar.`,
        { html: true },
      )}
      ${button(inviteLink, "Activar mi portal")}
      ${paragraph(
        "Hacé clic en el botón para crear tu contraseña y entrar por primera vez. El enlace caduca en 7 días.",
        { muted: true },
      )}
      ${divider()}
      ${fineprint(
        `Si no esperabas este correo, podés ignorarlo o escribirnos para que lo eliminemos. También podés visitar ${link(appUrl, "skindesk.co")} para conocer la plataforma.`,
        { html: true },
      )}
    `,
  });
}
