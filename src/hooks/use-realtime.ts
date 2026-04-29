"use client";

import { useEffect } from "react";
import type {
  RealtimePostgresChangesPayload,
  RealtimePostgresDeletePayload,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from "@supabase/supabase-js";
import { REALTIME_LISTEN_TYPES } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

type RealtimeOptions<T extends Record<string, unknown>> = {
  table: string;
  schema?: string;
  filter?: string;
  onInsert?: (payload: RealtimePostgresInsertPayload<T>) => void;
  onUpdate?: (payload: RealtimePostgresUpdatePayload<T>) => void;
  onDelete?: (payload: RealtimePostgresDeletePayload<T>) => void;
};

/**
 * Subscribes to postgres_changes on a Supabase table.
 * Pair with SWR's `mutate` to keep client cache in sync.
 */
export function useRealtime<T extends Record<string, unknown>>({
  table,
  schema = "public",
  filter,
  onInsert,
  onUpdate,
  onDelete,
}: RealtimeOptions<T>) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime:${schema}:${table}:${filter ?? "*"}`)
      .on<T>(
        REALTIME_LISTEN_TYPES.POSTGRES_CHANGES,
        { event: "*", schema, table, filter },
        (payload: RealtimePostgresChangesPayload<T>) => {
          if (payload.eventType === "INSERT")
            onInsert?.(payload as RealtimePostgresInsertPayload<T>);
          else if (payload.eventType === "UPDATE")
            onUpdate?.(payload as RealtimePostgresUpdatePayload<T>);
          else if (payload.eventType === "DELETE")
            onDelete?.(payload as RealtimePostgresDeletePayload<T>);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, schema, filter, onInsert, onUpdate, onDelete]);
}
