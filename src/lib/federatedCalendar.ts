import { supabase } from "./supabase";

/**
 * Client-side service for the Dynamic Multi-Campus Shared Calendar.
 *
 * Provides functions to:
 *   - Fetch a merged calendar of local + federated events
 *   - Toggle event federation broadcast
 *   - Get federation admin stats
 *   - Manage campus broadcast preferences
 */

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location: string | null;
  banner_url: string | null;
  source: "local" | "federated";
  club_name?: string;
  created_by?: string;
  host_institution?: string;
  origin_domain?: string;
  origin_event_id?: string;
  is_federated_public?: boolean;
  federated_payload?: Record<string, unknown>;
}

export interface UnifiedCalendarResult {
  events: CalendarEvent[];
  local_count: number;
  remote_count: number;
  total_count: number;
}

export interface FederationStats {
  trusted_campuses: number;
  federated_events: number;
  remote_events_received: number;
  broadcasts_24h: number;
  recent_activity: FederationActivity[];
}

export interface FederationActivity {
  id: string;
  action: "broadcast" | "update" | "delete" | "ingest";
  target_domain: string | null;
  status: "success" | "failed" | "pending";
  details: Record<string, unknown>;
  created_at: string;
}

export interface FederationToggleResult {
  success: boolean;
  is_federated_public?: boolean;
  message?: string;
  error?: string;
}

/**
 * Fetch the unified calendar (local + remote events merged by date).
 */
export async function getUnifiedCalendar(options: {
  startDate?: string;
  endDate?: string;
  includeRemote?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<UnifiedCalendarResult> {
  const params = new URLSearchParams();
  if (options.startDate) params.set("start_date", options.startDate);
  if (options.endDate) params.set("end_date", options.endDate);
  if (options.includeRemote === false) params.set("include_remote", "false");
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));

  const { data, error } = await supabase.functions.invoke(
    `federated-calendar-sync?${params.toString()}`,
    { method: "GET" }
  );

  if (error) {
    console.error("Failed to fetch unified calendar:", error);
    return { events: [], local_count: 0, remote_count: 0, total_count: 0 };
  }

  return data as UnifiedCalendarResult;
}

/**
 * Toggle whether an event is broadcast to partner campuses.
 * Only club presidents/admins can do this.
 */
export async function toggleEventFederation(
  eventId: string,
  isFederated: boolean
): Promise<FederationToggleResult> {
  const { data, error } = await supabase.rpc("toggle_event_federation", {
    p_event_id: eventId,
    p_is_federated: isFederated,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as FederationToggleResult;
}

/**
 * Get federation stats for the admin panel.
 */
export async function getFederationStats(): Promise<FederationStats | null> {
  const { data, error } = await supabase.rpc("get_federation_stats");

  if (error) {
    console.error("Failed to fetch federation stats:", error);
    return null;
  }

  return data as FederationStats;
}

/**
 * Get all trusted federated servers.
 */
export async function getFederatedServers() {
  const { data, error } = await supabase
    .from("federated_servers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch federated servers:", error);
    return [];
  }

  return data || [];
}

/**
 * Manually trigger broadcast of a federated event to all trusted peers.
 */
export async function broadcastEvent(eventId: string) {
  const { data, error } = await supabase.functions.invoke(
    "federate-event-broadcast",
    { body: { event_id: eventId } }
  );

  if (error) {
    return { success: false, error: error.message };
  }

  return data;
}

/**
 * Get remote events from a specific campus.
 */
export async function getRemoteEventsFromCampus(domain: string) {
  const { data, error } = await supabase
    .from("remote_events")
    .select("*")
    .eq("origin_server_domain", domain)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Failed to fetch remote events:", error);
    return [];
  }

  return data || [];
}
