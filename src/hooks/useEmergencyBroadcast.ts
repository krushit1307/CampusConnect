// =============================================================================
// Hook: useEmergencyBroadcast
// Issue: #3165 - Emergency Campus Broadcast Override Module
// Description: Tracks whether a life-safety emergency is currently active.
// Always runs an initial fetch against `campus_emergencies` on mount (so
// clients who were offline when the alert fired still see it immediately),
// then subscribes to a Supabase Realtime channel named "system_broadcast"
// so every connected client is notified the instant an admin triggers or
// clears an alert.
// =============================================================================

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export interface CampusEmergency {
  id: string;
  title: string;
  message: string;
  severity: "warning" | "critical";
  active: boolean;
  triggered_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UseEmergencyBroadcastResult {
  emergency: CampusEmergency | null;
  loading: boolean;
}

export function useEmergencyBroadcast(): UseEmergencyBroadcastResult {
  const [emergency, setEmergency] = useState<CampusEmergency | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Edge case: a client that was offline (or just opening the app) will
    // never receive the realtime event that fired while it was disconnected,
    // so we always check the table directly on load.
    const fetchActiveEmergency = async () => {
      const { data, error } = await supabase
        .from("campus_emergencies" as any)
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;
      if (error) {
        console.error("[useEmergencyBroadcast] Failed to fetch active emergency:", error);
      } else {
        setEmergency((data as CampusEmergency | null) ?? null);
      }
      setLoading(false);
    };

    void fetchActiveEmergency();

    const channel = supabase
      .channel("system_broadcast")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campus_emergencies" },
        (payload) => {
          const row = (payload.new ?? null) as CampusEmergency | null;
          if (row && row.active) {
            setEmergency(row);
          } else if (payload.eventType === "UPDATE" && row && !row.active) {
            // The admin flipped `active` to false — clear it for this client,
            // but only if it's the same alert we're currently showing.
            setEmergency((current) => (current?.id === row.id ? null : current));
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { emergency, loading };
}