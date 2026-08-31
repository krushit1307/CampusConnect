// Issue #4837: Consumes DocuSign's `envelope-completed` webhook. Only after
// this fires do we mark the NDA as signed, unblocking checkout/RSVP finalization.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const payload = await req.json();

    const envelopeId: string | undefined = payload?.data?.envelopeId ?? payload?.envelopeId;
    const status: string | undefined =
      payload?.data?.envelopeSummary?.status ?? payload?.status;
    const eventType: string | undefined = payload?.event;

    if (!envelopeId) {
      return new Response(JSON.stringify({ error: "Missing envelopeId" }), { status: 400 });
    }

    // Only act on the completed signature event.
    if (eventType !== "envelope-completed" && status?.toLowerCase() !== "completed") {
      return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200 });
    }

    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: signatureRow, error: updateError } = await adminSupabase
      .from("event_nda_signatures")
      .update({ status: "completed", signed_at: new Date().toISOString() })
      .eq("envelope_id", envelopeId)
      .select("event_id, user_id")
      .single();

    if (updateError || !signatureRow) {
      console.error("[docusign-webhook] No matching signature row for envelope", envelopeId);
      return new Response(JSON.stringify({ error: "Signature record not found" }), { status: 404 });
    }

    // Finalize any pending free RSVP now that the NDA is signed, and issue
    // the ticket (QR code is generated client-side from ticket_id + signature).
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("public_key")
      .eq("id", signatureRow.user_id)
      .maybeSingle();

    const { data: insertedRsvp } = await adminSupabase
      .from("event_rsvps")
      .upsert(
        {
          event_id: signatureRow.event_id,
          user_id: signatureRow.user_id,
          status: "CONFIRMED",
          created_at: new Date().toISOString(),
        },
        { onConflict: "event_id,user_id" },
      )
      .select("id, ticket_id, version")
      .single();

    if (insertedRsvp?.ticket_id && profile?.public_key) {
      const { signTicket } = await import("../_shared/ticket-crypto.ts");
      await signTicket(
        insertedRsvp.ticket_id,
        signatureRow.event_id,
        profile.public_key,
        insertedRsvp.version || 1,
      );
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error("[docusign-webhook] error:", err);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), { status: 500 });
  }
});