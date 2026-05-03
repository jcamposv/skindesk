import "server-only";

/**
 * Shared HTML scaffold for every transactional SkinDesk email. Centralises
 * the brand palette (balsam, artemis, aquatone, copper, cream), the header
 * with the hosted logo, the accent strip and the footer — so individual
 * templates only describe their own body content and stay short.
 *
 * We render plain HTML (no React Email) on purpose: keeps the dependency
 * surface tiny, renders predictably across Gmail / Outlook / Apple Mail,
 * and the templates stay easy to read without a preview server.
 */

// Brand palette in hex — email clients don't support oklch; values mirror
// the canonical comments in src/app/globals.css.
export const COLORS = {
  balsam: "#5C6E6C",
  balsamDark: "#4A5957",
  balsamMuted: "#7E8E8C",
  artemis: "#D2A96A",
  dustyRose: "#C58F8A",
  aquatone: "#A6B7AA",
  copper: "#BB7154",
  cream: "#F5F4EF",
  cardBg: "#FFFFFF",
  cardBorder: "#EFECE5",
  cardShade: "#FAF8F2",
  text: "#1F1F1F",
  textSoft: "#3F3F3F",
  textMuted: "#6B6B6B",
  textFaint: "#A3A3A3",
} as const;

/**
 * Horizontal lockup with icon + "SkinDesk" + tagline already baked in.
 * Renders as a single image — we don't add HTML text alongside it because
 * the wordmark and tagline are already part of the file.
 */
const LOGO_URL =
  "https://yzxuqlpqhtljzbhyqbes.supabase.co/storage/v1/object/public/email/logo-email-2.png";

const LOGO_WIDTH_PX = 200;

const COPYRIGHT_YEAR = new Date().getFullYear();

/** Support inbox surfaced everywhere we used to say "reply to this email". */
export const SUPPORT_EMAIL = "support@skindesk.co";

/** Brand tagline — no longer baked into the logo, lives in the outer footer. */
const TAGLINE = "Software para cosmetología y estética";

interface ShellProps {
  /** <title> tag for clients that show it. */
  title: string;
  /**
   * Hidden preview text shown by Gmail / Apple Mail in the inbox list. Keep
   * to ~90 characters; longer values get truncated.
   */
  preheader: string;
  /**
   * Inner HTML for the card body. Use the helpers below (`heading`,
   * `paragraph`, `button`, etc.) instead of raw inline styles so every
   * template stays visually consistent.
   */
  body: string;
}

export function renderEmail({ title, preheader, body }: ShellProps): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escape(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${COLORS.cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Helvetica,Arial,sans-serif;color:${COLORS.text};-webkit-font-smoothing:antialiased;">
    <span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:transparent;">${escape(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.cream};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:${COLORS.cardBg};border-radius:16px;border:1px solid ${COLORS.cardBorder};overflow:hidden;">
            <tr>
              <td style="padding:28px 40px 20px;">${renderHeader()}</td>
            </tr>
            <tr>
              <td style="padding:0 40px;">
                <div style="height:2px;background:${COLORS.artemis};"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 36px;">${body}</td>
            </tr>
            <tr>
              <td style="background:${COLORS.cardShade};padding:18px 40px;border-top:1px solid ${COLORS.cardBorder};text-align:center;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.textMuted};">¿Necesitás ayuda? Escribinos a <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLORS.balsam};text-decoration:underline;font-weight:500;">${SUPPORT_EMAIL}</a>.</p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 4px;font-size:11px;line-height:1.6;color:${COLORS.textMuted};letter-spacing:0.02em;">${escape(TAGLINE)}</p>
          <p style="margin:0;font-size:11px;line-height:1.6;color:${COLORS.textFaint};letter-spacing:0.04em;">© ${COPYRIGHT_YEAR} SkinDesk</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// ----- Header ----------------------------------------------------------------

/**
 * Horizontal lockup that already includes the icon, "SkinDesk" wordmark
 * and tagline as part of the image. Rendered as a single <img> centred at
 * the top of the card.
 */
function renderHeader(): string {
  return `<img src="${LOGO_URL}" alt="SkinDesk" width="${LOGO_WIDTH_PX}" style="display:block;width:${LOGO_WIDTH_PX}px;height:auto;border:0;outline:none;text-decoration:none;" />`;
}

// ----- Body content helpers --------------------------------------------------

export function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:24px;font-weight:600;line-height:1.3;color:${COLORS.text};letter-spacing:-0.015em;">${escape(text)}</h1>`;
}

export function eyebrow(text: string): string {
  return `<p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${COLORS.balsamMuted};">${escape(text)}</p>`;
}

/**
 * Body paragraph. Pass `html: true` only when you've assembled the children
 * yourself with the inline helpers — otherwise the raw text is escaped.
 */
export function paragraph(
  content: string,
  options?: { muted?: boolean; html?: boolean },
): string {
  const color = options?.muted ? COLORS.textMuted : COLORS.textSoft;
  const text = options?.html ? content : escape(content);
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${color};">${text}</p>`;
}

export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr><td align="left" bgcolor="${COLORS.balsam}" style="border-radius:10px;background:${COLORS.balsam};">
        <a href="${escape(href)}" style="display:inline-block;background:${COLORS.balsam};color:#ffffff;padding:14px 30px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:-0.005em;line-height:1;mso-padding-alt:0;">${escape(label)}</a>
      </td></tr>
    </table>`;
}

/** Inline link styled in balsam with underline. */
export function link(href: string, label: string): string {
  return `<a href="${escape(href)}" style="color:${COLORS.balsam};text-decoration:underline;font-weight:500;">${escape(label)}</a>`;
}

export function strong(text: string): string {
  return `<strong style="font-weight:600;color:${COLORS.text};">${escape(text)}</strong>`;
}

export function divider(): string {
  return `<hr style="border:0;border-top:1px solid ${COLORS.cardBorder};margin:28px 0;" />`;
}

/** Small note used for "if you didn't request this…" disclaimers. */
export function fineprint(content: string, options?: { html?: boolean }): string {
  const text = options?.html ? content : escape(content);
  return `<p style="margin:0;font-size:13px;line-height:1.6;color:${COLORS.textMuted};">${text}</p>`;
}

/** Accent callout strip — used for tips / warnings. */
export function callout(
  content: string,
  options?: { tone?: "info" | "warn"; html?: boolean },
): string {
  const tone = options?.tone ?? "info";
  const accent = tone === "warn" ? COLORS.copper : COLORS.artemis;
  const bg = tone === "warn" ? "#FAF1ED" : "#FBF5EA";
  const text = options?.html ? content : escape(content);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      <tr><td style="background:${bg};border-left:3px solid ${accent};border-radius:8px;padding:14px 18px;">
        <p style="margin:0;font-size:14px;line-height:1.6;color:${COLORS.textSoft};">${text}</p>
      </td></tr>
    </table>`;
}

export function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
