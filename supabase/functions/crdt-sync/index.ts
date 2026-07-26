// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
// @ts-ignore
import * as Y from "https://esm.sh/yjs@13.6.20";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Helper: Convert Uint8Array to base64 string safely
function uint8ArrayToBase64(arr: Uint8Array): string {
  let bin = "";
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    bin += String.fromCharCode(arr[i]);
  }
  return btoa(bin);
}

// Helper: Convert base64 string to Uint8Array safely
function base64ToUint8Array(base64: string): Uint8Array {
  const bin = atob(base64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return arr;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);

    if (req.method === "GET") {
      const eventId = url.searchParams.get("eventId");
      if (!eventId) {
        return new Response(JSON.stringify({ error: "Missing eventId parameter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch the current document state
      const { data, error } = await supabase
        .from("event_crdt_states")
        .select("state")
        .eq("event_id", eventId)
        .maybeSingle();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return new Response(JSON.stringify({ state: data?.state ?? "" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const { eventId, update, textDescription } = await req.json();

      if (!eventId || !update) {
        return new Response(JSON.stringify({ error: "Missing eventId or update parameter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Fetch current document state from db
      const { data: existingRecord, error: fetchError } = await supabase
        .from("event_crdt_states")
        .select("state")
        .eq("event_id", eventId)
        .maybeSingle();

      if (fetchError) {
        throw new Error(`Database fetch error: ${fetchError.message}`);
      }

      // 2. Initialize Yjs Doc and apply current state if exists
      const doc = new Y.Doc();
      if (existingRecord?.state) {
        Y.applyUpdate(doc, base64ToUint8Array(existingRecord.state));
      }

      // 3. Apply the incoming delta/update
      Y.applyUpdate(doc, base64ToUint8Array(update));

      // 4. Encode the merged state back to Base64
      const mergedStateArray = Y.encodeStateAsUpdate(doc);
      const mergedStateBase64 = uint8ArrayToBase64(mergedStateArray);

      // 5. Update or insert the new state
      if (existingRecord) {
        const { error: updateError } = await supabase
          .from("event_crdt_states")
          .update({
            state: mergedStateBase64,
            updated_at: new Date().toISOString(),
          })
          .eq("event_id", eventId);

        if (updateError) {
          throw new Error(`Database update error: ${updateError.message}`);
        }
      } else {
        const { error: insertError } = await supabase.from("event_crdt_states").insert({
          event_id: eventId,
          state: mergedStateBase64,
        });

        if (insertError) {
          throw new Error(`Database insert error: ${insertError.message}`);
        }
      }

      // 6. Cache the readable plain text representation in the main events table
      if (typeof textDescription === "string") {
        const { error: eventUpdateError } = await supabase
          .from("events")
          .update({ description: textDescription })
          .eq("id", eventId);

        if (eventUpdateError) {
          console.error(
            `Failed to cache description text in events table: ${eventUpdateError.message}`,
          );
        }
      }

      return new Response(JSON.stringify({ success: true, state: mergedStateBase64 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("crdt-sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
