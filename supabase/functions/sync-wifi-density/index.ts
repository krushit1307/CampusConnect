import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

type AccessPoint = {
  id: string;
  event_id: string;
  mac_address: string;
  area_name: string;
  max_device_capacity: number;
};

type Reading = { macAddress: string; deviceCount: number };

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceRoleKey || req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const provider = (Deno.env.get("WIFI_ANALYTICS_PROVIDER") ?? "normalized").toLowerCase();
  const apiUrl = Deno.env.get("WIFI_ANALYTICS_API_URL") ?? "";
  const apiToken = Deno.env.get("WIFI_ANALYTICS_API_TOKEN") ?? "";
  const tenantId = Deno.env.get("ARUBA_TENANT_ID") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey);
  if (!apiUrl || !apiToken || !["meraki", "aruba", "normalized"].includes(provider)) {
    return new Response(JSON.stringify({ error: "Wi-Fi analytics provider is not configured" }), {
      status: 503,
      headers: jsonHeaders,
    });
  }

  const { data: accessPoints, error: accessPointError } = await supabase
    .from("event_wifi_access_points")
    .select("id, event_id, mac_address, area_name, max_device_capacity")
    .eq("enabled", true)
    .limit(5000);
  if (accessPointError) {
    return new Response(JSON.stringify({ error: "Could not load access-point mappings" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (provider === "meraki") headers["X-Cisco-Meraki-API-Key"] = apiToken;
  else headers.Authorization = `Bearer ${apiToken}`;
  if (provider === "aruba") headers.TenantID = tenantId;

  const response = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    console.error("Wi-Fi analytics API returned", response.status);
    return new Response(JSON.stringify({ error: "Wi-Fi analytics provider request failed" }), {
      status: 502,
      headers: jsonHeaders,
    });
  }
  const payload = await response.json();
  const readings = normalizeProviderPayload(payload);
  const readingsByMac = new Map(
    readings.map((reading) => [reading.macAddress, reading.deviceCount]),
  );
  const now = new Date().toISOString();
  let recorded = 0;
  let alerts = 0;

  for (const point of (accessPoints ?? []) as AccessPoint[]) {
    const deviceCount = readingsByMac.get(point.mac_address);
    if (deviceCount === undefined) continue;
    const { error: recordError } = await supabase.rpc("record_wifi_density_snapshot", {
      p_access_point_id: point.id,
      p_device_count: deviceCount,
      p_sampled_at: now,
      p_provider: provider,
    });
    if (recordError) {
      console.error(`Could not save density for ${point.id}`, recordError);
      continue;
    }
    recorded += 1;

    if (deviceCount < point.max_device_capacity * 1.2) continue;
    const { data: shouldAlert } = await supabase.rpc("mark_wifi_capacity_alerted", {
      p_access_point_id: point.id,
    });
    if (!shouldAlert) continue;
    alerts += await notifyAttendees(supabase, point, deviceCount, serviceRoleKey);
  }

  return new Response(
    JSON.stringify({
      provider,
      sampledAt: now,
      mappedAccessPoints: accessPoints?.length ?? 0,
      recorded,
      alerts,
    }),
    { status: 200, headers: jsonHeaders },
  );
});

function normalizeProviderPayload(payload: unknown): Reading[] {
  const records = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as Record<string, unknown>).data ??
        (payload as Record<string, unknown>).clients ??
        (payload as Record<string, unknown>).results ??
        [])
      : [];
  if (!Array.isArray(records)) return [];
  return records.flatMap((record) => {
    if (!record || typeof record !== "object") return [];
    const item = record as Record<string, unknown>;
    const rawMac =
      item.macAddress ?? item.mac ?? item.deviceMac ?? item.access_point_mac ?? item.bssid;
    const normalizedMac =
      typeof rawMac === "string" ? rawMac.trim().toUpperCase().replace(/-/g, ":") : "";
    const rawCount =
      item.clientCount ?? item.clients ?? item.deviceCount ?? item.count ?? item.numClients;
    const deviceCount = typeof rawCount === "number" ? rawCount : Number(rawCount);
    return /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(normalizedMac) &&
      Number.isFinite(deviceCount) &&
      deviceCount >= 0 &&
      deviceCount <= 1_000_000
      ? [{ macAddress: normalizedMac, deviceCount: Math.floor(deviceCount) }]
      : [];
  });
}

async function notifyAttendees(
  supabase: ReturnType<typeof createClient>,
  point: AccessPoint,
  deviceCount: number,
  serviceRoleKey: string,
): Promise<number> {
  const { data: attendees } = await supabase
    .from("event_rsvps")
    .select("user_id")
    .eq("event_id", point.event_id)
    .in("status", ["going", "approved"])
    .limit(5000);
  const userIds = [...new Set((attendees ?? []).map((row) => row.user_id).filter(Boolean))];
  const message = `${point.area_name} is crowded (${deviceCount}/${point.max_device_capacity} devices). Head to another event area if possible.`;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  await Promise.all(
    userIds.map(async (userId) => {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "capacity_overflow",
        title: `${point.area_name} is crowded`,
        message,
        link: `/events/${point.event_id}`,
        metadata: {
          event_id: point.event_id,
          access_point_id: point.id,
          device_count: deviceCount,
        },
      });
      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({
          user_id: userId,
          title: `${point.area_name} is crowded`,
          message,
          url: `/events/${point.event_id}`,
          type: "capacity_overflow",
          priority: "urgent",
        }),
      }).catch((error) => console.error("Capacity push failed", error));
    }),
  );
  return userIds.length;
}
