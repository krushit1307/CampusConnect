import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { zipSync, strToU8 } from "https://esm.sh/fflate@0.8.2";
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
    // Create a regular client to verify user auth
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const user = await verifyAuth(req, authClient);
    const userId = user.id;

    // Use service role key to bypass RLS for broad queries and storage upload
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Create a pending job
    const { data: job, error: jobError } = await supabase
      .from("data_export_jobs")
      .insert({ user_id: userId, status: "processing" })
      .select()
      .single();

    if (jobError) throw jobError;

    // We execute the processing asynchronously so we can return 200 immediately
    // to the frontend, preventing timeout for large exports.
    // However, Deno Deploy / Edge Functions might terminate if the response is sent.
    // Since we are generating this quickly, let's just await it. (If timeout is 50s, it's fine).

    // 2. Fetch Data
    const exportData: any = {
      generated_at: new Date().toISOString(),
      user_id: userId,
    };

    // Profiles
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
    exportData.profile = profile || {};

    // RSVPs
    const { data: rsvps } = await supabase.from("event_rsvps").select("*").eq("user_id", userId);
    exportData.event_rsvps = rsvps || [];

    // Posts
    const { data: posts } = await supabase.from("posts").select("*").eq("author_id", userId);
    exportData.posts = posts || [];

    // Comments
    const { data: comments } = await supabase.from("comments").select("*").eq("author_id", userId);
    exportData.comments = comments || [];

    // Chat Messages
    const { data: chatMessages } = await supabase
      .from("event_chat_messages")
      .select("*")
      .eq("user_id", userId);
    exportData.event_chat_messages = chatMessages || [];

    // Preferences
    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();
    exportData.user_preferences = preferences || {};

    // 3. Compress data
    const jsonStr = JSON.stringify(exportData, null, 2);
    const zipped = zipSync({
      "export.json": strToU8(jsonStr),
    });

    // 4. Upload to storage
    const storagePath = `${userId}/${job.id}/export.zip`;
    const { error: uploadError } = await supabase.storage
      .from("data-exports")
      .upload(storagePath, zipped, {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // 5. Generate Signed URL (valid for 48 hours)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("data-exports")
      .createSignedUrl(storagePath, 48 * 60 * 60);

    if (signedUrlError) throw signedUrlError;

    // 6. Update job status
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("data_export_jobs")
      .update({
        status: "completed",
        storage_path: storagePath,
        completed_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq("id", job.id);

    // 7. Send Email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const emailBody = {
        from: "CampusConnect <notifications@campusconnect.app>",
        to: user.email,
        subject: "Your Data Export is Ready",
        html: `
          <h2>Your Data Export is Ready</h2>
          <p>Hi,</p>
          <p>You recently requested a copy of your personal data on CampusConnect. The file is ready and will be available for 48 hours.</p>
          <p><a href="${signedUrlData.signedUrl}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; font-weight: bold; font-family: monospace;">Download export.zip</a></p>
          <p>If you didn't request this, please contact support immediately.</p>
        `,
      };

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify(emailBody),
      });
    } else {
      console.log("Mock email sent with link:", signedUrlData.signedUrl);
    }

    return new Response(JSON.stringify({ message: "Export completed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Export Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
