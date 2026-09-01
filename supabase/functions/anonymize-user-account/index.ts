import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { verifyAuth } from "../shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const user = await verifyAuth(req, authClient);
    const userId = user.id;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Purge storage files (photos, avatars, documents) for this user
    try {
      await supabase.storage.from("avatars").remove([`${userId}.png`]);
    } catch (err) {
      console.warn("Avatar removal warning:", err);
    }

    const photoBuckets = ["photos", "uploads", "media"];
    for (const bucket of photoBuckets) {
      try {
        const { data: files } = await supabase.storage.from(bucket).list(userId);
        if (files && files.length > 0) {
          const paths = files.map((f) => `${userId}/${f.name}`);
          await supabase.storage.from(bucket).remove(paths);
        }
      } catch (err) {
        console.warn(`Photos cleanup warning for ${bucket}:`, err);
      }
    }

    // 2. Call the Postgres RPC anonymize_user_account(userId)
    const { data: rpcData, error: rpcError } = await supabase.rpc("anonymize_user_account", {
      target_user_id: userId,
    });

    if (rpcError) {
      throw rpcError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account anonymization completed successfully.",
        anonymizedEmail: `deleted_user_${userId}@campusconnect.edu`,
        purgedChatMessagesCount: rpcData?.purged_messages ?? 0,
        purgedPhotosCount: rpcData?.purged_photos ?? 0,
        retainedRsvpsCount: rpcData?.retained_rsvps ?? 0,
        retainedLedgerTransactionsCount: rpcData?.retained_transactions ?? 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Cryptographic Anonymization Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
