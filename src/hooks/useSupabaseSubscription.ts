import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type PostgresChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

export interface UseSupabaseSubscriptionOptions<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Database table name to subscribe to */
  table: string;
  /** Database schema name (default: 'public') */
  schema?: string;
  /** Change event type to listen for: 'INSERT' | 'UPDATE' | 'DELETE' | '*' (default: '*') */
  event?: PostgresChangeEvent;
  /** Filter string e.g. 'user_id=eq.123' */
  filter?: string;
  /** Custom realtime channel name (default: auto-generated from schema, table, event, filter) */
  channelName?: string;
  /** Whether the subscription is active (default: true) */
  enabled?: boolean;
  /** Callback fired whenever a matching database change is received */
  onData?: (payload: RealtimePostgresChangesPayload<T>) => void;
  /** Callback fired whenever subscription status changes */
  onStatus?: (status: `${REALTIME_SUBSCRIBE_STATES}`, err?: Error) => void;
}

export type REALTIME_SUBSCRIBE_STATES =
  "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR" | "IDLE";

export function useSupabaseSubscription<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  optionsOrTable: UseSupabaseSubscriptionOptions<T> | string,
  filterArg?: string,
  callbackArg?: (payload: RealtimePostgresChangesPayload<T>) => void,
) {
  const options: UseSupabaseSubscriptionOptions<T> =
    typeof optionsOrTable === "string"
      ? {
          table: optionsOrTable,
          filter: filterArg,
          onData: callbackArg,
        }
      : optionsOrTable;

  const {
    table,
    schema = "public",
    event = "*",
    filter,
    channelName,
    enabled = true,
    onData,
    onStatus,
  } = options;

  const [status, setStatus] = useState<REALTIME_SUBSCRIBE_STATES>("IDLE");
  const [error, setError] = useState<Error | null>(null);

  // Store latest callbacks in refs to prevent unnecessary re-subscriptions on re-render
  const onDataRef = useRef(onData);
  const onStatusRef = useRef(onStatus);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  useEffect(() => {
    if (!enabled || !table) {
      setStatus("IDLE");
      return;
    }

    const supabase = createClient();
    const name =
      channelName ||
      `realtime_${schema}_${table}_${event.toLowerCase()}${filter ? `_${filter}` : ""}`;

    const channel: RealtimeChannel = supabase.channel(name);

    const postgresChangesFilter: {
      event: PostgresChangeEvent;
      schema: string;
      table: string;
      filter?: string;
    } = {
      event,
      schema,
      table,
    };

    if (filter) {
      postgresChangesFilter.filter = filter;
    }

    channel
      .on(
        "postgres_changes",
        postgresChangesFilter,
        (payload: RealtimePostgresChangesPayload<T>) => {
          onDataRef.current?.(payload);
        },
      )
      .subscribe((subscribeStatus, err) => {
        const currentStatus = subscribeStatus as REALTIME_SUBSCRIBE_STATES;
        setStatus(currentStatus);
        if (err) {
          setError(err);
        } else {
          setError(null);
        }
        onStatusRef.current?.(currentStatus, err);
      });

    return () => {
      void supabase.removeChannel(channel);
      setStatus("CLOSED");
    };
  }, [table, schema, event, filter, channelName, enabled]);

  return {
    status,
    error,
  };
}
