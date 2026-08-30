// =============================================================================
// Edge Function: Sponsor Reverse Payload (Digital Business Card Exchange)
// Issue: #4541 - Build an 'Interactive "Sponsor Lead" Digital Business Card Exchange'
//
// Triggered when a sponsor successfully scans a student's QR code.
// Sends the recruiter's digital business card + in-app notification to the student,
// and generates a .vcf file URL for 1-click contact import.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generates a vCard (.vcf) string from a recruiter profile.
 */
function generateRecruiterVCard(profile: {
  full_name: string;
  email: string;
  company_name: string;
  job_title?: string;
  linkedin_url?: string;
  calendly_url?: string;
  phone?: string;
  website_url?: string;
  bio?: string;
}, eventName?: string): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${profile.full_name}`,
    `N:${profile.full_name.split(" ").reverse().join(";")};;;`,
    `EMAIL;TYPE=INTERNET:${profile.email}`,
    profile.phone ? `TEL;TYPE=CELL:${profile.phone}` : null,
    profile.company_name ? `ORG:${profile.company_name}` : null,
    profile.job_title ? `TITLE:${profile.job_title}` : null,
    profile.linkedin_url ? `URL;TYPE=LinkedIn:${profile.linkedin_url}` : null,
    profile.calendly_url ? `URL;TYPE=Calendly:${profile.calendly_url}` : null,
    profile.website_url ? `URL;TYPE=Website:${profile.website_url}` : null,
    profile.bio ? `NOTE:${profile.bio}` : null,
    eventName ? `X-MET-AT:${eventName}` : null,
    "END:VCARD",
  ].filter(Boolean);

  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { student_user_id, event_id } = body;

    if (!student_user_id || !event_id) {
      return new Response(
        JSON.stringify({ error: "Missing student_user_id or event_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Get sponsor's recruiter profile
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("recruiter_profiles")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (profileError || !profileData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No active recruiter profile found. Please set up your Recruiter Profile first.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Create or update connection record
    const { data: connectionData, error: connectionError } = await supabaseAdmin
      .from("sponsor_lead_connections")
      .upsert(
        {
          sponsor_user_id: user.id,
          student_user_id,
          event_id,
          recruiter_profile_id: profileData.id,
          notification_sent: false,
          vcf_downloaded: false,
        },
        { onConflict: "sponsor_user_id,student_user_id,event_id" },
      )
      .select("id")
      .single();

    if (connectionError) {
      console.error("[ReversePayload] Connection error:", connectionError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create connection record." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Get event name for the notification
    const { data: eventData } = await supabaseAdmin
      .from("events")
      .select("title")
      .eq("id", event_id)
      .single();

    const eventName = eventData?.title || "the event";

    // 4. Generate VCF content
    const vcfContent = generateRecruiterVCard(
      {
        full_name: profileData.full_name,
        email: profileData.email,
        company_name: profileData.company_name,
        job_title: profileData.job_title,
        linkedin_url: profileData.linkedin_url,
        calendly_url: profileData.calendly_url,
        phone: profileData.phone,
        website_url: profileData.website_url,
        bio: profileData.bio,
      },
      eventName,
    );

    // 5. Send in-app notification to student
    const notificationMessage =
      `You just connected with ${profileData.full_name} from ${profileData.company_name}!` +
      (profileData.job_title ? ` (${profileData.job_title})` : "") +
      ` Click here to view their digital business card and book an interview.`;

    const { error: notifError } = await supabaseAdmin.from("notifications").insert({
      user_id: student_user_id,
      type: "reply",
      title: "New Connection!",
      message: notificationMessage,
      link: `/connections/${connectionData.id}`,
      is_read: false,
    });

    if (notifError) {
      console.error("[ReversePayload] Notification error:", notifError);
    }

    // 6. Update notification_sent flag
    await supabaseAdmin
      .from("sponsor_lead_connections")
      .update({ notification_sent: true })
      .eq("id", connectionData.id);

    // 7. Return success with recruiter info and VCF data
    return new Response(
      JSON.stringify({
        success: true,
        message: `Reverse payload delivered to student.`,
        connection_id: connectionData.id,
        recruiter: {
          full_name: profileData.full_name,
          company_name: profileData.company_name,
          job_title: profileData.job_title,
          email: profileData.email,
          linkedin_url: profileData.linkedin_url,
          calendly_url: profileData.calendly_url,
        },
        vcf_content: vcfContent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[ReversePayload] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
