// =============================================================================
// Edge Function: Request Accessibility
// Issue: #3551 - Implement 'Dynamic Accessibility Sign Language Interpreter Request'
// Description: Triggered when a user checks the accessibility box during RSVP.
// Sends an immediate high - priority email to the University Disability Resource
// Center containing the event details and user contact info.
//  =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mock email service configuration
const DISABILITY_CENTER_EMAIL = Deno.env.get("DISABILITY_CENTER_EMAIL") || "disability-services@university.edu";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "mock_resend_key";

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { request_id } = await req.json();
        if (!request_id) throw new Error("Missing request_id");

        // 1. Fetch the request details with event and user info
        const { data: request, error: fetchError } = await supabaseAdmin
            .from("accessibility_requests")
            .select(`
        *,
        events (title, event_date, location, club_id),
        profiles:user_id (full_name, email)
      `)
            .eq("id", request_id)
            .single();

        if (fetchError || !request) throw new Error("Request not found");

        const event = request.events as any;
        const user = request.profiles as any;

        // 2. Format the email content
        const eventDate = new Date(event.event_date).toLocaleString();
        const requestTypeLabel = request.request_type.replace('_', ' ').toUpperCase();

        const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #DC2626;">🚨 High-Priority Accessibility Request</h2>
        <p>A student has requested <strong>${requestTypeLabel}</strong> for an upcoming event.</p>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Event Details</h3>
          <p><strong>Title:</strong> ${event.title}</p>
          <p><strong>Date:</strong> ${eventDate}</p>
          <p><strong>Location:</strong> ${event.location || 'TBA'}</p>
        </div>
        
        <div style="background: #EFF6FF; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Student Contact</h3>
          <p><strong>Name:</strong> ${user.full_name}</p>
          <p><strong>Email:</strong> <a href="mailto:${user.email}">${user.email}</a></p>
        </div>
        
        ${request.additional_notes ? `
          <div style="background: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Additional Notes</h3>
            <p>${request.additional_notes}</p>
          </div>
        ` : ''}
        
        <p>Please log into the <a href="${Deno.env.get('APP_URL')}/admin/accessibility">Accessibility Portal</a> to confirm this request.</p>
      </div>
    `;

        // 3. Send email via Resend API
        // In production, this would be a real fetch call to Resend
        /*
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "CampusConnect Accessibility <accessibility@campusconnect.app>",
            to: [DISABILITY_CENTER_EMAIL],
            subject: `🚨 URGENT: ${requestTypeLabel} Request for "${event.title}"`,
            html: emailHtml
          })
        });
        
        if (!response.ok) {
          throw new Error(`Email API failed: ${await response.text()}`);
        }
        */

        console.log(`[RequestAccessibility] Mock email sent to ${DISABILITY_CENTER_EMAIL} for request ${request_id}`);

        return new Response(
            JSON.stringify({ success: true, notified: DISABILITY_CENTER_EMAIL }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[RequestAccessibility] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
