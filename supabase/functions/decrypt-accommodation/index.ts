import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { verifyAuth } from "../shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Missing database environment configuration.");
    }

    // Parse payload
    const { rsvpId } = await req.json();
    if (!rsvpId) {
      return new Response(JSON.stringify({ error: "rsvpId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Authenticate caller (verify JWT)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    let user;
    try {
      user = await verifyAuth(req, serviceClient);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized access: Invalid session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized access: No authenticated user." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Fetch RSVP, event and club details via service client
    const { data: rsvpData, error: dbError } = await serviceClient
      .from("event_rsvps")
      .select(
        `
        id,
        user_id,
        events (
          id,
          club_id,
          clubs (
            id,
            created_by
          )
        )
      `,
      )
      .eq("id", rsvpId)
      .single();

    if (dbError || !rsvpData) {
      console.error("DB Lookup failed for Decryption request:", dbError);
      return new Response(JSON.stringify({ error: "Resource not found or access denied." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const typedEvents = rsvpData.events as unknown as {
      id: string;
      club_id: string;
      clubs: {
        id: string;
        created_by: string;
      } | null;
    } | null;

    if (!typedEvents || !typedEvents.clubs) {
      return new Response(JSON.stringify({ error: "Invalid association mapping." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rsvpOwnerId = rsvpData.user_id;
    const clubCreatorId = typedEvents.clubs.created_by;

    // 3. Authorization Verification
    // Caller MUST be the primary Club President (club creator) OR the RSVP owner.
    // This blocks lower-tier admins, unrelated members, unrelated students, and public users.
    const isOwner = user.id === rsvpOwnerId;
    const isPrimaryPresident = user.id === clubCreatorId;

    if (!isOwner && !isPrimaryPresident) {
      return new Response(
        JSON.stringify({
          error:
            "Permission Denied: Only the Primary Club President or the RSVP owner is authorized.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Perform Decryption under user JWT context (to trigger DB function & audit logging)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization token header." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: decryptedText, error: rpcError } = await userClient.rpc(
      "get_decrypted_accommodation",
      {
        p_rsvp_id: rsvpId,
      },
    );

    if (rpcError) {
      console.error("Decryption RPC error invocation:", rpcError.message);
      return new Response(
        JSON.stringify({ error: "Fails to decrypt accommodation details or audit log error." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ decrypted: decryptedText }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server process error.";
    console.error("decrypt-accommodation route failure:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
