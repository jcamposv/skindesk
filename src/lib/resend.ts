import "server-only";
import { Resend } from "resend";

import { EMAIL_FROM_DEV } from "@/lib/constants";

/**
 * Server-only Resend client.
 * NEVER import from a Client Component or expose RESEND_API_KEY in public env.
 */
export const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Default From address. Use the Resend sandbox in development; in production,
 * verify your domain in the Resend dashboard and override via env if desired.
 */
export const EMAIL_FROM =
  process.env.NODE_ENV === "production"
    ? `SkinDesk <noreply@${
        process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "") ??
        "skindesk.app"
      }>`
    : `SkinDesk <${EMAIL_FROM_DEV}>`;
