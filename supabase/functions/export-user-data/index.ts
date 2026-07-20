import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client using Deno environment secrets
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Authenticate the user using the shared verifyAuth middleware
    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Securely query only the records belonging to the authenticated user
    const [profileRes, postsRes, commentsRes, rsvpsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("posts").select("*").eq("author_id", user.id),
      supabase.from("comments").select("*").eq("author_id", user.id),
      supabase.from("event_rsvps").select("*").eq("user_id", user.id),
    ]);

    // Handle database query failures gracefully
    if (profileRes.error) throw profileRes.error;
    if (postsRes.error) throw postsRes.error;
    if (commentsRes.error) throw commentsRes.error;
    if (rsvpsRes.error) throw rsvpsRes.error;

    // Compile all fetched personal data
    const compiledData = {
      profile: profileRes.data,
      posts: postsRes.data ?? [],
      comments: commentsRes.data ?? [],
      rsvps: rsvpsRes.data ?? [],
      exported_at: new Date().toISOString(),
    };

    // Format the response with double-space indentation
    const jsonString = JSON.stringify(compiledData, null, 2);

    // Return the Response configured for downloading as a file
    return new Response(jsonString, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="user_data_export.json"',
      },
    });
  } catch (error) {
    console.error("User Data Export Error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred exporting your data." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
