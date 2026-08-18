import { createClient } from "@/lib/supabase/client";

async function isRateLimited(prefix: string): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn("Upstash Redis not configured. Rate limiting bypassed.");
    return false;
  }

  const now = Math.floor(Date.now() / 60000); // Current minute
  const key = `ratelimit:apikey:${prefix}:${now}`;

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, "60"],
      ]),
    });

    if (!res.ok) {
      console.error("Upstash Redis pipeline failed:", await res.text());
      return false; // Fail open
    }

    const data = await res.json();
    const currentCount = data[0]?.result;
    return currentCount > 60; // 60 requests/minute
  } catch (err) {
    console.error("Rate limiting error:", err);
    return false; // Fail open
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const clubId = params.id;
  const authHeader = req.headers.get("Authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.substring(7).trim();
  const parts = token.split(".");
  if (parts.length !== 2) {
    return new Response(JSON.stringify({ error: "Invalid API key format" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [prefix, rawKey] = parts;

  // Rate Limiting
  const limited = await isRateLimited(prefix);
  if (limited) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded (60 requests/minute)" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient();

  // Verify Key
  const { data: isValid, error: authErr } = await supabase.rpc("authenticate_club_api_key", {
    p_prefix: prefix,
    p_raw_key: rawKey,
    p_club_id: clubId,
  });

  if (authErr || !isValid) {
    return new Response(JSON.stringify({ error: "Unauthorized API key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch upcoming events for this club
  const { data: events, error: fetchErr } = await supabase
    .from("events")
    .select("id, title, description, start_time, end_time, location, max_attendees")
    .eq("club_id", clubId)
    .eq("status", "published")
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true });

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ events }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
