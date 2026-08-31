// ============================================================
// CampusConnect – Event Carpool Service
// src/services/EventCarpoolService.ts
// Issue #3663: Dynamic Carpool/Ride-Share Matchmaker
// ============================================================

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// ── Types ────────────────────────────────────────────────────

export type CarpoolStatus = "active" | "full" | "completed" | "cancelled";
export type CarpoolRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled";

export interface Carpool {
  id: string;
  event_id: string;
  driver_user_id: string;
  driver_name: string;
  driver_avatar: string | null;
  seats_offered: number;
  seats_taken: number;
  departure_time: string;
  location_string: string;
  notes: string | null;
  status: CarpoolStatus;
  created_at: string;
  updated_at: string;
  requests?: CarpoolRequest[];
}

export interface CarpoolRequest {
  id: string;
  carpool_id: string;
  rider_user_id: string;
  rider_name: string;
  rider_avatar: string | null;
  status: CarpoolRequestStatus;
  pickup_notes: string | null;
  created_at: string;
  responded_at: string | null;
}

export interface CreateCarpoolInput {
  event_id: string;
  driver_user_id: string;
  seats_offered: number;
  departure_time: string;
  location_string: string;
  notes?: string;
}

export interface CreateCarpoolRequestInput {
  carpool_id: string;
  rider_user_id: string;
  pickup_notes?: string;
}

// ── Service Functions ────────────────────────────────────────

export async function getEventCarpools(eventId: string): Promise<Carpool[]> {
  const { data, error } = await supabase
    .from("carpools")
    .select(`*, carpool_requests(*)`)
    .eq("event_id", eventId)
    .order("departure_time", { ascending: true });

  if (error) throw new Error(`Failed to fetch carpools: ${error.message}`);
  return (data || []).map(mapCarpoolRow);
}

export async function getCarpoolById(
  carpoolId: string,
): Promise<Carpool | null> {
  const { data, error } = await supabase
    .from("carpools")
    .select(`*, carpool_requests(*)`)
    .eq("id", carpoolId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch carpool: ${error.message}`);
  }
  return mapCarpoolRow(data);
}

export async function createCarpool(
  input: CreateCarpoolInput,
): Promise<Carpool> {
  const { data, error } = await supabase
    .from("carpools")
    .insert({
      event_id: input.event_id,
      driver_user_id: input.driver_user_id,
      seats_offered: input.seats_offered,
      departure_time: input.departure_time,
      location_string: input.location_string,
      notes: input.notes || null,
      status: "active",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create carpool: ${error.message}`);
  return mapCarpoolRow(data);
}

export async function cancelCarpool(carpoolId: string): Promise<void> {
  const { error } = await supabase
    .from("carpools")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", carpoolId);

  if (error) throw new Error(`Failed to cancel carpool: ${error.message}`);
}

export async function requestCarpoolSeat(
  input: CreateCarpoolRequestInput,
): Promise<CarpoolRequest> {
  const { data, error } = await supabase
    .from("carpool_requests")
    .insert({
      carpool_id: input.carpool_id,
      rider_user_id: input.rider_user_id,
      pickup_notes: input.pickup_notes || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to request seat: ${error.message}`);
  return mapRequestRow(data);
}

export async function acceptCarpoolRequest(
  requestId: string,
): Promise<void> {
  const { error } = await supabase
    .from("carpool_requests")
    .update({
      status: "accepted",
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) throw new Error(`Failed to accept request: ${error.message}`);
}

export async function declineCarpoolRequest(
  requestId: string,
): Promise<void> {
  const { error } = await supabase
    .from("carpool_requests")
    .update({
      status: "declined",
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) throw new Error(`Failed to decline request: ${error.message}`);
}

export async function cancelCarpoolRequest(
  requestId: string,
): Promise<void> {
  const { error } = await supabase
    .from("carpool_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) throw new Error(`Failed to cancel request: ${error.message}`);
}

export async function getCarpoolRequests(
  carpoolId: string,
): Promise<CarpoolRequest[]> {
  const { data, error } = await supabase
    .from("carpool_requests")
    .select("*")
    .eq("carpool_id", carpoolId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch requests: ${error.message}`);
  return (data || []).map(mapRequestRow);
}

export async function getMyEventCarpools(
  eventId: string,
  userId: string,
): Promise<{ driving: Carpool[]; riding: Carpool[] }> {
  const { data: drivingData, error: drivingError } = await supabase
    .from("carpools")
    .select("*, carpool_requests(*)")
    .eq("event_id", eventId)
    .eq("driver_user_id", userId)
    .neq("status", "cancelled");

  if (drivingError)
    throw new Error(`Failed to fetch driving carpools: ${drivingError.message}`);

  const { data: ridingData, error: ridingError } = await supabase
    .from("carpool_requests")
    .select(`carpool_id, carpools!inner(*, carpool_requests(*))`)
    .eq("rider_user_id", userId)
    .in("status", ["pending", "accepted"])
    .eq("carpools.event_id", eventId);

  if (ridingError)
    throw new Error(`Failed to fetch riding carpools: ${ridingError.message}`);

  const driving = (drivingData || []).map(mapCarpoolRow);
  const ridingMap = new Map<string, Carpool>();
  for (const row of ridingData || []) {
    const carpool = mapCarpoolRow((row as any).carpools);
    if (carpool.status !== "cancelled") ridingMap.set(carpool.id, carpool);
  }

  return { driving, riding: Array.from(ridingMap.values()) };
}

export async function hasUserRequested(
  carpoolId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("carpool_requests")
    .select("id")
    .eq("carpool_id", carpoolId)
    .eq("rider_user_id", userId)
    .in("status", ["pending", "accepted"])
    .maybeSingle();

  if (error) throw new Error(`Failed to check request status: ${error.message}`);
  return data !== null;
}

export async function initiateDriverRiderDM(
  driverId: string,
  riderId: string,
  eventTitle: string,
): Promise<void> {
  const introMessage = `Hi! You've been matched for carpool to "${eventTitle}". Coordinate your pickup details here.`;

  const { error } = await supabase.from("direct_messages").insert({
    sender_id: riderId,
    receiver_id: driverId,
    encrypted_content: introMessage,
    iv: "system-init",
  });

  if (error) console.error("Failed to initiate DM:", error.message);
}

// ── Helpers ──────────────────────────────────────────────────

function mapCarpoolRow(row: any): Carpool {
  return {
    id: row.id,
    event_id: row.event_id,
    driver_user_id: row.driver_user_id,
    driver_name: row.driver_name || "Unknown Driver",
    driver_avatar: row.driver_avatar || null,
    seats_offered: row.seats_offered,
    seats_taken: row.seats_taken ?? 0,
    departure_time: row.departure_time,
    location_string: row.location_string,
    notes: row.notes,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    requests: (row.carpool_requests || []).map(mapRequestRow),
  };
}

function mapRequestRow(row: any): CarpoolRequest {
  return {
    id: row.id,
    carpool_id: row.carpool_id,
    rider_user_id: row.rider_user_id,
    rider_name: row.rider_name || "Unknown Rider",
    rider_avatar: row.rider_avatar || null,
    status: row.status,
    pickup_notes: row.pickup_notes,
    created_at: row.created_at,
    responded_at: row.responded_at,
  };
}
