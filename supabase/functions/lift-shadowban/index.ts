import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { signature, generatedApology, userId } = await req.json();

    if (!signature || !generatedApology) {
      return new Response(JSON.stringify({ error: "Missing signature or apology text." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client with the Service Role key to bypass RLS for administrative tasks
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Route the signed apology to the cold-storage audit log
    const { error: auditError } = await supabaseClient.from("audit_logs").insert([
      {
        user_id: userId,
        action: "shadowban_lifted",
        details: { signature, apology: generatedApology },
        created_at: new Date().toISOString(),
      },
    ]);

    if (auditError) throw auditError;

    // 2. Automatically lift the shadowban instantly
    const { error: updateError } = await supabaseClient
      .from("users") // Adjust if your table is named 'profiles' etc.
      .update({ is_shadowbanned: false })
      .eq("id", userId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, message: "Ban lifted and logged." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error lifting ban:", error);
    return new Response(JSON.stringify({ error: "Failed to process application." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
