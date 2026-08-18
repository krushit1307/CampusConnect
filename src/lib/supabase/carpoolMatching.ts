import { supabase } from "./client";

export type CarpoolVehicle = {
  id: string;
  event_id: string;
  driver_user_id: string;
  available_seats: number;
  departure_time: string;
  pickup_neighborhood: string;
  notes: string | null;
  status: string;
};

export type CarpoolRequest = {
  id: string;
  event_id: string;
  rider_user_id: string;
  pickup_neighborhood: string;
  departure_time: string;
  status: string;
  matched_vehicle_id: string | null;
};

export type CarpoolOffer = {
  id: string;
  vehicle_id: string;
  request_id: string;
  status: string;
};

export type CarpoolMatch = {
  request_id: string;
  rider_user_id: string;
  pickup_neighborhood: string;
  departure_time: string;
  score: number;
  rider_profile?: {
    full_name: string;
    avatar_url: string;
  };
};

type RpcResult = {
  success: boolean;
  message: string;
  group_id?: string;
};

export async function createVehicle(
  vehicle: Omit<CarpoolVehicle, "id" | "status">,
): Promise<{ data: CarpoolVehicle | null; error: unknown }> {
  const { data, error } = await supabase
    .from("carpool_vehicles")
    .insert([vehicle])
    .select()
    .single();
  return { data: data as CarpoolVehicle, error };
}

export async function createRequest(
  request: Omit<CarpoolRequest, "id" | "status" | "matched_vehicle_id">,
): Promise<{ data: CarpoolRequest | null; error: unknown }> {
  const { data, error } = await supabase
    .from("carpool_requests")
    .insert([request])
    .select()
    .single();
  return { data: data as CarpoolRequest, error };
}

export async function fetchMyVehicle(
  eventId: string,
  userId: string,
): Promise<{ data: CarpoolVehicle | null; error: unknown }> {
  const { data, error } = await supabase
    .from("carpool_vehicles")
    .select("*")
    .eq("event_id", eventId)
    .eq("driver_user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return { data: data as CarpoolVehicle, error };
}

export async function fetchMyRequest(
  eventId: string,
  userId: string,
): Promise<{ data: CarpoolRequest | null; error: unknown }> {
  const { data, error } = await supabase
    .from("carpool_requests")
    .select("*")
    .eq("event_id", eventId)
    .eq("rider_user_id", userId)
    .neq("status", "cancelled")
    .maybeSingle();
  return { data: data as CarpoolRequest, error };
}

export async function getCarpoolMatches(
  vehicleId: string,
): Promise<{ data: CarpoolMatch[] | null; error: unknown }> {
  const { data, error } = await supabase.rpc("get_carpool_matches", {
    p_vehicle_id: vehicleId,
  });
  if (error) return { data: null, error };

  // Fetch profiles for the matches
  const matches = (data as any[]) || [];
  if (matches.length > 0) {
    const userIds = matches.map((m) => m.rider_user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);

    if (profiles) {
      matches.forEach((m) => {
        m.rider_profile = profiles.find((p) => p.id === m.rider_user_id);
      });
    }
  }
  return { data: matches as CarpoolMatch[], error: null };
}

export async function fetchIncomingOffers(
  requestId: string,
): Promise<{ data: any[] | null; error: unknown }> {
  const { data, error } = await supabase
    .from("carpool_offers")
    .select(
      `
      id,
      status,
      vehicle:carpool_vehicles (
        id,
        departure_time,
        pickup_neighborhood,
        driver:profiles!carpool_vehicles_driver_user_id_fkey(full_name, avatar_url)
      )
    `,
    )
    .eq("request_id", requestId)
    .eq("status", "pending");
  return { data, error };
}

export async function offerRide(
  vehicleId: string,
  requestId: string,
): Promise<{ data: RpcResult | null; error: unknown }> {
  const { data, error } = await supabase.rpc("offer_carpool_ride", {
    p_vehicle_id: vehicleId,
    p_request_id: requestId,
  });
  return { data: data as RpcResult, error };
}

export async function acceptOffer(
  offerId: string,
): Promise<{ data: RpcResult | null; error: unknown }> {
  const { data, error } = await supabase.rpc("accept_carpool_offer", {
    p_offer_id: offerId,
  });
  return { data: data as RpcResult, error };
}

export async function cancelVehicle(vehicleId: string): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from("carpool_vehicles")
    .update({ status: "cancelled" })
    .eq("id", vehicleId);
  return { error };
}

export async function cancelRequest(requestId: string): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from("carpool_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId);
  return { error };
}
