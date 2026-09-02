// Issue #4837: Creates a DocuSign envelope from the event's NDA template
// and returns an embedded signing URL for the attendee's iframe.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { eventId } = await req.json();
    if (!eventId) throw new Error("Missing eventId");

    const { data: event, error: eventError } = await adminSupabase
      .from("events")
      .select("title, nda_template_url, requires_signature")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Event not found");
    if (!event.requires_signature || !event.nda_template_url) {
      throw new Error("This event does not require an NDA signature");
    }

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const docusignResponse = await fetch(
      `${Deno.env.get("DOCUSIGN_BASE_URI")}/restapi/v2.1/accounts/${Deno.env.get(
        "DOCUSIGN_ACCOUNT_ID",
      )}/envelopes`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("DOCUSIGN_ACCESS_TOKEN")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId: undefined,
          emailSubject: `NDA required: ${event.title}`,
          documents: [
            { documentBase64: undefined, name: "NDA", fileExtension: "pdf", documentId: "1", remoteUrl: event.nda_template_url },
          ],
          recipients: {
            signers: [
              {
                email: profile?.email,
                name: profile?.full_name || "Attendee",
                recipientId: "1",
                clientUserId: user.id,
              },
            ],
          },
          status: "sent",
          eventNotification: {
            url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/docusign-webhook`,
            events: ["envelope-completed"],
          },
        }),
      },
    );

    const envelope = await docusignResponse.json();
    if (!docusignResponse.ok) throw new Error(envelope.message || "DocuSign envelope creation failed");

    await adminSupabase.from("event_nda_signatures").upsert({
      event_id: eventId,
      user_id: user.id,
      envelope_id: envelope.envelopeId,
      status: "sent",
    });

    const viewResponse = await fetch(
      `${Deno.env.get("DOCUSIGN_BASE_URI")}/restapi/v2.1/accounts/${Deno.env.get(
        "DOCUSIGN_ACCOUNT_ID",
      )}/envelopes/${envelope.envelopeId}/views/recipient`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("DOCUSIGN_ACCESS_TOKEN")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnUrl: `${Deno.env.get("SITE_URL")}/events/${eventId}?nda=signed`,
          authenticationMethod: "none",
          email: profile?.email,
          userName: profile?.full_name || "Attendee",
          clientUserId: user.id,
        }),
      },
    );

    const view = await viewResponse.json();
    if (!viewResponse.ok) throw new Error(view.message || "Failed to create signing view");

    return new Response(JSON.stringify({ signingUrl: view.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});