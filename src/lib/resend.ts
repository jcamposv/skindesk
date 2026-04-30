import "server-only";
import { Resend } from "resend";

import { EMAIL_FROM_DEV } from "@/lib/constants";

/**
 * Server-only Resend client.
 * NEVER import from a Client Component or expose RESEND_API_KEY in public env.
 */
export const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * From address used by every transactional send.
 *
 * Source-of-truth is the `EMAIL_FROM` env var (set in `.env.local` / Vercel)
 * — the domain MUST be verified in Resend Dashboard or sends will 403. We
 * default to `updates.mantenix.com` (the SkinDesk transactional subdomain)
 * in production, and to Resend's sandbox `onboarding@resend.dev` in dev so
 * the local flow doesn't require domain setup.
 *
 * Note: the Resend sandbox only delivers to your Resend account email.
 */
export const EMAIL_FROM =
  process.env.EMAIL_FROM ??
  (process.env.NODE_ENV === "production"
    ? "SkinDesk <noreply@updates.mantenix.com>"
    : `SkinDesk <${EMAIL_FROM_DEV}>`);
