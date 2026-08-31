import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EventLayoutZone, EventZoneCheckin } from "@/lib/eventLayoutHeatmap";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  from?: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        order?: (
          col: string,
          opts?: { ascending: boolean },
        ) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
  channel?: (name: string) => {
    on: (...args: unknown[]) => unknown;
    subscribe?: () => unknown;
  };
  removeChannel?: (channel: unknown) => void;
};

function asZones(data: unknown): EventLayoutZone[] {
  if (!Array.isArray(data)) return [];
  return data as EventLayoutZone[];
}

function asCheckins(data: unknown): EventZoneCheckin[] {
  if (!Array.isArray(data)) return [];
  return data as EventZoneCheckin[];
}

export function useEventLayoutHeatmap(
  eventId: string | null,
  venue?: { width_ft: number; height_ft: number },
) {
  const [zones, setZones] = useState<EventLayoutZone[]>([]);
  const [checkins, setCheckins] = useState<EventZoneCheckin[]>([]);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    const client = createClient() as unknown as RpcClient;
    if (typeof client.rpc !== "function") {
      setIsLoading(false);
      return;
    }
    const { data } = await client.rpc("ensure_event_layout_zones", {
      p_event_id: eventId,
      p_width_ft: venue?.width_ft ?? 100,
      p_height_ft: venue?.height_ft ?? 60,
    });
    setZones(asZones(data));

    try {
      const checkinQuery = client.from?.("event_zone_checkins")?.select(
        "id, event_id, zone_id, ticket_payload, scanned_at",
      );
      const ordered = checkinQuery?.eq("event_id", eventId)?.order;
      if (typeof ordered === "function") {
        const { data: recent } = await ordered("scanned_at", { ascending: false });
        setCheckins(asCheckins(recent).slice(0, 20));
      }
    } catch {
      // Table may be missing in tests or older local DBs.
    }

    try {
      const alertQuery = client.from?.("campus_security_alerts")?.select("message, created_at");
      const ordered = alertQuery?.eq("event_id", eventId)?.order;
      if (typeof ordered === "function") {
        const { data: alerts } = await ordered("created_at", { ascending: false });
        const latest = Array.isArray(alerts) ? alerts[0] : null;
        setSecurityMessage(
          latest && typeof latest === "object" && latest && "message" in latest
            ? String((latest as { message: string }).message)
            : null,
        );
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  }, [eventId, venue?.width_ft, venue?.height_ft]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!eventId) return;
    const client = createClient() as unknown as RpcClient;
    if (typeof client.channel !== "function") return undefined;

    const channel = client.channel(`event-layout-heatmap:${eventId}`);
    const bind = (table: string, event: "*" | "INSERT") => {
      if (typeof channel.on !== "function") return;
      channel.on("postgres_changes", {
        event,
        schema: "public",
        table,
        filter: `event_id=eq.${eventId}`,
      }, () => {
        void refresh();
      });
    };
    bind("event_layout_zones", "*");
    bind("event_zone_checkins", "INSERT");
    bind("campus_security_alerts", "INSERT");
    if (typeof channel.subscribe === "function") channel.subscribe();

    return () => {
      client.removeChannel?.(channel);
    };
  }, [eventId, refresh]);

  return { zones, checkins, securityMessage, isLoading, refresh };
}
