import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  const from = Deno.env.get("SENDGRID_FROM_EMAIL") || "no-reply@campusconnect.app";
  if (!apiKey || apiKey.startsWith("mock-")) {
    console.log(`[Email Mock] to=${to} subject="${subject}"`);
    return true;
  }
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: { email: from }, subject, content: [{ type: "text/html", value: html }] }),
    });
    return res.ok;
  } catch (e) {
    console.error("[Email] failed", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all clubs with presidents
    const { data: clubs, error: clubErr } = await supabase.from("clubs").select("id,name");
    if (clubErr) throw clubErr;

    let warnings = 0;
    let successions = 0;

    for (const club of clubs || []) {
      const clubId = (club as { id: string }).id;
      const clubName = (club as { name: string }).name;

      // Resolve president and last_active
      const { data: presId } = await supabase.rpc("get_club_president", { club_uuid: clubId });
      if (!presId) continue;
      const presidentId = presId as unknown as string;
      const { data: profile } = await supabase.from("profiles").select("id,last_active_at,first_name,last_name").eq("id", presidentId).maybeSingle();
      const lastActive = (profile as { last_active_at: string | null } | null)?.last_active_at ?? null;
      const days = lastActive ? Math.floor((Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24)) : 0;

      // Check existing state to avoid duplicate warnings
      const { data: state } = await supabase.from("club_leadership_incapacity_state").select("status,warning_sent_at").eq("club_id", clubId).maybeSingle();
      const status = (state as { status: string } | null)?.status;

      if (days >= 30) {
        const { data: res } = await supabase.rpc("execute_president_succession_protocol", { p_club_id: clubId });
        if ((res as { success?: boolean } | null)?.success) successions++;
      } else if (days >= 21 && days < 30 && status !== "warning_sent" && status !== "succession_executed") {
        const { data: presProfile } = await supabase.from("profiles").select("first_name,last_name").eq("id", presidentId).maybeSingle();
        const pName = presProfile ? `${(presProfile as { first_name: string }).first_name} ${(presProfile as { last_name: string }).last_name}`.trim() : "President";
        const { data: presAuth } = await supabase.auth.admin.getUserById(presidentId);
        const email = (presAuth?.user as { email?: string } | null)?.email;
        if (email) {
          await sendEmail(email, "Warning: Impending Executive Lockout.", `<p>Hi ${pName},</p><p>Your account for club "${clubName}" has been inactive for ${days} days. On day 30 your Stripe Connect and Escrow keys will be revoked and Vice President promoted. Please log in to reset.</p>`);
        }
        await supabase.rpc("send_incapacity_warning", { p_club_id: clubId });
        warnings++;
      }
    }

    return new Response(JSON.stringify({ success: true, warnings, successions }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[president-incapacity-monitor]", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
