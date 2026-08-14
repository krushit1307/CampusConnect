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

    // Create regular client for auth verification
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const user = await verifyAuth(req, authClient);
    const userId = user.id;

    // Use service role key to perform user data deletion and Supabase Auth deletion
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch user data details for cleaning up files
    // Get all user uploads. Supposing files are saved under bucket folders named by user_id
    // First, let's clean up user avatars
    try {
      const avatarPath = `${userId}.png`;
      await supabase.storage.from("avatars").remove([avatarPath]);
    } catch (err) {
      console.warn("Avatar cleanup ignored:", err);
    }

    // Clean up general user data files in buckets if present.
    // E.g. photos/documents bucket named with user_id folder prefix
    const userBuckets = ["documents", "photos", "resumes", "covers"];
    for (const bucket of userBuckets) {
      try {
        const { data: files } = await supabase.storage.from(bucket).list(userId);
        if (files && files.length > 0) {
          const filePaths = files.map((f) => `${userId}/${f.name}`);
          await supabase.storage.from(bucket).remove(filePaths);
        }
      } catch (err) {
        console.warn(`Files cleanup ignored for bucket ${bucket}:`, err);
      }
    }

    // 2. Call the Postgres RPC delete_user_data(target_user_id)
    const { error: rpcError } = await supabase.rpc("delete_user_data", {
      target_user_id: userId,
    });

    if (rpcError) {
      throw rpcError;
    }

    // 3. Delete user from auth.users table using admin client
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      throw authError;
    }

    return new Response(
      JSON.stringify({ success: true, message: "Account and data deleted successfully." }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Account Deletion Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
