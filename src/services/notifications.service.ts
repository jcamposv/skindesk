import "server-only";

import { rutinaAssignedHtml } from "@/components/emails/rutina-assigned";
import { shareInviteHtml } from "@/components/emails/share-invite";
import { env } from "@/lib/env";
import { EMAIL_FROM, resend } from "@/lib/resend";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type NotificationKind = Database["public"]["Enums"]["notification_kind"];
type NotificationStatus = Database["public"]["Enums"]["notification_status"];

interface SendResult {
  ok: boolean;
  /** Resend's email id on success — useful when wiring up bounce/delivery
   *  webhooks. */
  providerId?: string;
  error?: string;
}

/**
 * Central place for every outbound email we send. Each function:
 *   1. Writes a `notification_events` row with status='queued'.
 *   2. Calls Resend with the rendered HTML body (templates use the shared
 *      `_shell` so every email gets the same logo / palette / footer).
 *   3. Updates the event row to 'sent' / 'failed' based on the result.
 *
 * Why HTML strings, not React components: the existing auth + Stripe
 * emails render plain HTML via `_shell`. Keeping the new ones on the
 * same path means one brand template, no @react-email dependency in the
 * runtime path, and consistent rendering across Gmail / Outlook / Apple
 * Mail.
 */

/** Profesional → Profesional share invite. */
export async function sendShareInviteEmail(params: {
  tenantId: string | null;
  recipientEmail: string;
  rutinaName: string;
  senderName: string;
  shareUrl: string;
}): Promise<SendResult> {
  return sendOne({
    tenantId: params.tenantId,
    kind: "share_invite",
    recipient: params.recipientEmail,
    payload: {
      rutinaName: params.rutinaName,
      senderName: params.senderName,
      shareUrl: params.shareUrl,
    },
    subject: `${params.senderName} compartió una rutina con vos`,
    html: shareInviteHtml({
      rutinaName: params.rutinaName,
      senderName: params.senderName,
      shareUrl: params.shareUrl,
    }),
  });
}

/** Profesional → Clienta assignment notification. */
export async function sendRutinaAssignedEmail(params: {
  tenantId: string;
  recipientEmail: string;
  clienteName: string;
  profesionalName: string;
  rutinaName: string;
  message?: string | null;
}): Promise<SendResult> {
  const portalUrl = `${env.NEXT_PUBLIC_APP_URL}/clienta`;
  return sendOne({
    tenantId: params.tenantId,
    kind: "rutina_assigned",
    recipient: params.recipientEmail,
    payload: {
      clienteName: params.clienteName,
      profesionalName: params.profesionalName,
      rutinaName: params.rutinaName,
      // Don't store free-form clinical content in the audit log payload
      // — only the fact that a message was attached. The email body
      // includes the message; we just don't persist it here.
      hasMessage: Boolean(params.message?.trim()),
    },
    subject: `${params.profesionalName} te asignó una rutina`,
    html: rutinaAssignedHtml({
      clienteName: params.clienteName,
      profesionalName: params.profesionalName,
      rutinaName: params.rutinaName,
      portalUrl,
      message: params.message ?? null,
    }),
  });
}

// ─── Internal ──────────────────────────────────────────────────────────────

type JsonPayload = Database["public"]["Tables"]["notification_events"]["Insert"]["payload"];

interface SendOneArgs {
  tenantId: string | null;
  kind: NotificationKind;
  recipient: string;
  payload: JsonPayload;
  subject: string;
  html: string;
}

async function sendOne(args: SendOneArgs): Promise<SendResult> {
  const supabase = await createClient();

  // 1. Pre-log the attempt so a Resend timeout / render failure doesn't
  //    leave us blind. Wrap in try/catch — a logging failure should not
  //    abort the email itself.
  let eventId: string | null = null;
  try {
    const { data: event } = await supabase
      .from("notification_events")
      .insert({
        tenant_id: args.tenantId,
        kind: args.kind,
        recipient: args.recipient,
        payload: args.payload,
        status: "queued" satisfies NotificationStatus,
      })
      .select("id")
      .single();
    eventId = event?.id ?? null;
  } catch (e) {
    console.warn("[notifications] failed to pre-log event:", e);
  }

  // 2. Fire the send. HTML is pre-rendered upstream so Resend has no
  //    React work to do — eliminates the @react-email/render dependency
  //    path that previously broke the share-invite send.
  let providerId: string | undefined;
  let errorMessage: string | undefined;
  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: args.recipient,
      subject: args.subject,
      html: args.html,
    });
    if (result.error) {
      errorMessage = result.error.message ?? "Resend error";
    } else {
      providerId = result.data?.id;
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "Resend error.";
  }

  // 3. Best-effort audit update — log failures don't mask send result.
  if (eventId) {
    try {
      if (errorMessage) {
        await supabase
          .from("notification_events")
          .update({
            status: "failed" satisfies NotificationStatus,
            error: errorMessage,
          })
          .eq("id", eventId);
      } else {
        await supabase
          .from("notification_events")
          .update({
            status: "sent" satisfies NotificationStatus,
            provider_id: providerId ?? null,
            sent_at: new Date().toISOString(),
          })
          .eq("id", eventId);
      }
    } catch (e) {
      console.warn("[notifications] failed to update event row:", e);
    }
  }

  if (errorMessage) return { ok: false, error: errorMessage };
  return { ok: true, providerId };
}
