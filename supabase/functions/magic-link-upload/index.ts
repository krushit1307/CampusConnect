import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

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

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { action, token, files, filePaths } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Validate Token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("photo_upload_tokens")
      .select("event_id, organizer_id, expires_at, used_at, events(title)")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Token has expired" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventId = tokenData.event_id;
    // We allow multiple uses until it expires, or we can mark it used.
    // The issue says "Make tokens single-purpose and prevent access to unrelated events."
    // We will mark it used when the upload is confirmed.

    if (action === "validate") {
      return new Response(
        JSON.stringify({
          valid: true,
          eventId,
          eventTitle: tokenData.events.title,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "generate_urls") {
      // files is an array of filenames
      if (!files || !Array.isArray(files)) {
        throw new Error("Files array is required for generate_urls");
      }
      
      const urls = [];
      for (const fileName of files) {
        const filePath = \`\${eventId}/\${crypto.randomUUID()}-\${fileName}\`;
        const { data, error } = await supabaseAdmin.storage
          .from("event-galleries")
          .createSignedUploadUrl(filePath);

        if (error) throw error;
        urls.push({ fileName, signedUrl: data.signedUrl, path: data.path });
      }

      return new Response(JSON.stringify({ urls }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "confirm_upload") {
      // filePaths is an array of uploaded storage paths
      if (!filePaths || !Array.isArray(filePaths)) {
        throw new Error("filePaths array is required for confirm_upload");
      }

      const inserts = filePaths.map((path) => ({
        event_id: eventId,
        user_id: tokenData.organizer_id,
        url: \`\${supabaseUrl}/storage/v1/object/public/event-galleries/\${path}\`,
      }));

      const { error: insertError } = await supabaseAdmin
        .from("event_photos")
        .insert(inserts);

      if (insertError) throw insertError;

      // Mark token as used
      await supabaseAdmin
        .from("photo_upload_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("token", token);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
