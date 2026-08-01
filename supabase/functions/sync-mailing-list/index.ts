import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to compute MD5 hash for Mailchimp subscriber hash
async function getMd5Hash(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message.toLowerCase());
  const hashBuffer = await crypto.subtle.digest("MD5", msgUint8);
  return encodeHex(hashBuffer);
}

// Simple retry helper
async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status >= 500 || res.status === 429) {
        console.warn(`[sync-mailing-list] API error (${res.status}). Retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i))); // Exponential backoff
        continue;
      }
      return res; // Client error (e.g. 400), don't retry
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`[sync-mailing-list] Network error. Retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries reached");
}

serve(async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const record = body?.record || body;
    const email = record?.email;
    const optIn = record?.newsletter_opt_in === true || record?.newsletter_opt_in === "true";

    if (!email || !optIn) {
      return new Response(JSON.stringify({ message: "No email or opt-in not true. Skipping." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("MAILCHIMP_API_KEY");
    const listId = Deno.env.get("MAILCHIMP_LIST_ID");
    const dataCenter = apiKey ? apiKey.split("-")[1] : "us1";

    if (!apiKey || !listId) {
      console.log(`[Mock Mode] Syncing ${email} to mailing list (opted in)`);
      return new Response(JSON.stringify({ message: "Mock sync successful", email }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscriberHash = await getMd5Hash(email);
    const url = `https://${dataCenter}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`;

    // UPSERT with PUT for Idempotency
    const response = await fetchWithRetry(url, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${btoa(`anystring:${apiKey}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: email,
        status_if_new: "subscribed",
        status: "subscribed",
      }),
    });

    const resData = await response.json();

    if (!response.ok) {
      throw new Error(`Mailchimp Error: ${JSON.stringify(resData)}`);
    }

    return new Response(JSON.stringify({ message: "Synced successfully", email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("sync-mailing-list error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
