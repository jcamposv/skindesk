import "server-only";

/**
 * Calendar-provider abstraction.
 *
 * The citas module persists every appointment to Postgres (the source of
 * truth). External calendars (Google Calendar, Outlook, ICS feeds) are
 * downstream consumers — they get a copy after a successful local write.
 *
 * Today we ship a single `LocalCalendarProvider` (no-op for external
 * sync). The interface exists so the citas action can route through it
 * unconditionally; when the Google provider lands, only the registry
 * mapping below has to change — no UI or action surgery.
 *
 * Sync metadata lives on `citas` itself (`external_provider`,
 * `external_event_id`, `external_calendar_id`, `external_sync_status`,
 * `external_synced_at`) so the provider is stateless from the app's
 * perspective.
 */

import type { Database } from "@/types/database.types";

type CitaRow = Database["public"]["Tables"]["citas"]["Row"];

export interface CalendarSyncEvent {
  /** Local cita id — used as idempotency key for external upserts. */
  citaId: string;
  /** Display title; provider may use this for the calendar entry's name. */
  title: string;
  /** ISO datetime. */
  startAt: string;
  endAt: string;
  /** Optional notes — body of the external event. */
  notes: string | null;
  /** Internal status; provider decides if it maps to a colour / category. */
  status: CitaRow["status"];
  /** Pre-existing external id when re-syncing an updated cita. */
  externalEventId?: string | null;
  /** Calendar to write into (e.g. a Google Calendar id). */
  externalCalendarId?: string | null;
}

export interface CalendarSyncResult {
  /** What we persist back into `citas.external_event_id`. */
  externalEventId: string | null;
  /** `'pending' | 'synced' | 'error' | 'disabled'` — written to
   *  `external_sync_status`. */
  status: "pending" | "synced" | "error" | "disabled";
  /** Human-readable message; logged but not surfaced to the user. */
  message?: string;
}

export interface CalendarProvider {
  readonly name: string;
  /** Create or update the external event. Idempotent on `event.citaId`. */
  upsert(event: CalendarSyncEvent): Promise<CalendarSyncResult>;
  /** Delete the external event. No-op when `externalEventId` is null. */
  remove(externalEventId: string | null): Promise<CalendarSyncResult>;
}

/** Default provider — does nothing, returns `disabled` so the column
 *  shape is consistent. Used until a real provider (Google, etc.) is
 *  wired up. */
export const LocalCalendarProvider: CalendarProvider = {
  name: "local",
  async upsert(event) {
    return {
      externalEventId: event.externalEventId ?? null,
      status: "disabled",
      message: "No external calendar provider configured.",
    };
  },
  async remove() {
    return {
      externalEventId: null,
      status: "disabled",
      message: "No external calendar provider configured.",
    };
  },
};

/** Pick the active provider for a tenant. Today everyone gets the
 *  no-op; later this will read the tenant's integration settings. */
export function getCalendarProvider(_tenantId: string | null): CalendarProvider {
  return LocalCalendarProvider;
}
