import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface RemoteEvent {
  id: string;
  origin_server_domain: string;
  origin_event_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  banner_url: string | null;
  host_institution: string;
  federated_payload: Record<string, unknown>;
  created_at: string;
}

export function useFederatedEvents() {
  const [remoteEvents, setRemoteEvents] = useState<RemoteEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRemoteEvents() {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from("remote_events")
          .select("*")
          .order("start_time", { ascending: true });

        if (fetchError) throw fetchError;
        setRemoteEvents((data as RemoteEvent[]) || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchRemoteEvents();
  }, []);

  return { remoteEvents, loading, error };
}
