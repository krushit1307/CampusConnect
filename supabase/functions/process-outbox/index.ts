import { z } from "https://esm.sh/zod@3.24.2";
import { parseJsonBody } from "../_shared/validation.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";

const processOutboxPayloadSchema = z
  .object({
    table: z.string().min(1),
    action: z.string().min(1),
    record: z.record(z.any()).optional(), // Relaxed strict schema constraint to support matching objects (#3249)
  })
  .strict();

const processOutboxSchema = z
  .object({
    outbox_id: z.string().uuid("outbox_id must be a valid UUID"),
    payload: processOutboxPayloadSchema,
  })
  .strict();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = await parseJsonBody(processOutboxSchema, req);
    if (!parsed.ok) return parsed.response;
    const { outbox_id, payload } = parsed.data;

    console.log(
      `[Outbox Worker] Processing outbox event ${outbox_id}:`,
      JSON.stringify(payload, null, 2),
    );

    const { table, action, record } = payload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Simulate external side effects based on table and action
    if (table === "events" && action === "INSERT") {
      console.log(
        `[Outbox Worker] [Guaranteed Delivery] Dispatching invitations and search indexes for new event: ${record?.title || record?.id}`,
      );
      // In production, this would invoke SendGrid/Resend APIs and update search indexes
    } else if (table === "posts" && action === "INSERT") {
      console.log(
        `[Outbox Worker] [Guaranteed Delivery] Dispatching notifications for new post: ${record?.id}`,
      );
    } else if (table === "sponsor_pitches" && action === "PITCH_APPROVED") {
      const pitch = record;
      if (pitch?.id) {
        console.log(`[Outbox Worker] [Sponsorship Invoicing] Processing approved pitch: ${pitch.id}`);

        // Fetch pitch details
        const { data: pitchDetails, error: errPitch } = await supabase
          .from("sponsor_pitches")
          .select(`
            id,
            requested_amount,
            approved_amount,
            funding_requests (
              id,
              title,
              club_id,
              event_id,
              clubs (
                id,
                name,
                tax_id
              ),
              events (
                id,
                title
              )
            ),
            sponsorship_campaigns (
              id,
              company_name,
              sponsor_id
            )
          `)
          .eq("id", pitch.id)
          .single();

        if (errPitch || !pitchDetails) {
          console.error("Failed to retrieve pitch details:", errPitch);
          throw new Error("Pitch details not found");
        }

        const amountCents = pitchDetails.approved_amount ?? pitchDetails.requested_amount;
        const clubName = pitchDetails.funding_requests?.clubs?.name || "Campus Club";
        const clubTaxId = pitchDetails.funding_requests?.clubs?.tax_id || "XX-XXXXXXX";
        const companyName = pitchDetails.sponsorship_campaigns?.company_name || "Sponsor Corp";
        const sponsorId = pitchDetails.sponsorship_campaigns?.sponsor_id;
        const eventTitle = pitchDetails.funding_requests?.events?.title;
        const lineItemDescription = eventTitle
          ? `Event Sponsorship for event: ${eventTitle}`
          : `Sponsorship for funding request: ${pitchDetails.funding_requests?.title || "Funding"}`;

        // Get sponsor email
        let sponsorEmail = "sponsor@campusconnect.app";
        if (sponsorId) {
          const { data: sponsorProfile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", sponsorId)
            .single();
          if (sponsorProfile?.email) {
            sponsorEmail = sponsorProfile.email;
          }
        }

        // Initialize Stripe
        const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
        let stripeCustomerId = "cus_mock_sponsorship";
        let stripeInvoiceId = `in_mock_${crypto.randomUUID().replace(/-/g, "").substring(0, 24)}`;
        let stripeInvoicePdf = "https://stripe.com/invoice/mock.pdf";

        if (stripeSecretKey && !stripeSecretKey.startsWith("mock-")) {
          const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

          // Search or create Stripe Customer
          const customers = await stripe.customers.list({ email: sponsorEmail, limit: 1 });
          if (customers.data.length > 0) {
            stripeCustomerId = customers.data[0].id;
          } else {
            const customer = await stripe.customers.create({
              email: sponsorEmail,
              name: companyName,
            });
            stripeCustomerId = customer.id;
          }

          // Create Invoice Item
          await stripe.invoiceItems.create({
            customer: stripeCustomerId,
            amount: amountCents,
            currency: "usd",
            description: `${lineItemDescription} (Club Tax ID: ${clubTaxId})`,
          });

          // Create Invoice
          const invoice = await stripe.invoices.create({
            customer: stripeCustomerId,
            auto_advance: true,
            collection_method: "send_invoice",
            days_until_due: 30,
            description: `Sponsorship Invoice for ${clubName}`,
          });

          // Send Invoice
          const sentInvoice = await stripe.invoices.sendInvoice(invoice.id);
          stripeInvoiceId = sentInvoice.id;
          stripeInvoicePdf = sentInvoice.invoice_pdf || "";
        } else {
          console.log(`[Stripe Mock] Simulating Invoice Creation: Customer: ${companyName} (${sponsorEmail}), Amount: ${amountCents} cents`);
        }

        // Insert into sponsor_invoices
        const { error: errInsert } = await supabase
          .from("sponsor_invoices")
          .insert({
            pitch_id: pitch.id,
            stripe_invoice_id: stripeInvoiceId,
            stripe_customer_id: stripeCustomerId,
            stripe_invoice_pdf_url: stripeInvoicePdf,
            amount_cents: amountCents,
            status: "sent",
          });

        if (errInsert) {
          console.error("Failed to insert sponsor_invoices record:", errInsert);
          throw errInsert;
        }

        console.log(`[Outbox Worker] [Sponsorship Invoicing] Successfully enqueued and sent invoice ${stripeInvoiceId}`);
      }
    } else if (table === "lost_item_matches" && action === "INSERT") {
      const match = record;
      if (match?.lost_item_id && match?.found_item_id) {
        console.log(`[Outbox Worker] Processing match ${match.id} for lost_item_id: ${match.lost_item_id}, found_item_id: ${match.found_item_id}`);

        // Fetch details of both items
        const { data: lostItem, error: errLost } = await supabase
          .from("lost_items")
          .select("title, user_id")
          .eq("id", match.lost_item_id)
          .single();

        const { data: foundItem, error: errFound } = await supabase
          .from("lost_items")
          .select("title, user_id")
          .eq("id", match.found_item_id)
          .single();

        if (errLost || errFound || !lostItem || !foundItem) {
          console.error("Failed to retrieve matching item records:", errLost || errFound);
          throw new Error("Failed to retrieve items");
        }

        // Fetch profiles of both item owners
        const { data: profileLost, error: errProfLost } = await supabase
          .from("profiles")
          .select("email, first_name, last_name")
          .eq("id", lostItem.user_id)
          .single();

        const { data: profileFound, error: errProfFound } = await supabase
          .from("profiles")
          .select("email, first_name, last_name")
          .eq("id", foundItem.user_id)
          .single();

        if (errProfLost || errProfFound || !profileLost || !profileFound) {
          console.error("Failed to retrieve matching profiles:", errProfLost || errProfFound);
          throw new Error("Failed to retrieve user profiles");
        }

        // Prepare email notification payload
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const appUrl = Deno.env.get("APP_URL") || "https://campusconnect.edu";
        
        const emailList = [profileLost.email, profileFound.email];
        const emailBody = {
          from: "CampusConnect Lost & Found <notifications@campusconnect.app>",
          to: emailList,
          subject: `Match Found! We found your lost ${lostItem.title || "item"}`,
          html: `
            <h2>Lost & Found Match Found!</h2>
            <p>Hi ${profileLost.first_name || "there"} and ${profileFound.first_name || "there"},</p>
            <p>We found a high-probability match for the lost item: <strong>${lostItem.title}</strong>.</p>
            <p>A match was detected based on item details, spatial location, and temporal proximity.</p>
            <p>Please click below to connect and coordinate the return of the item:</p>
            <p><a href="${appUrl}/lost-found" style="display: inline-block; background-color: #a3e635; color: #000000; font-weight: bold; text-decoration: none; padding: 10px 20px; border: 2px solid #000000;">View Match & Connect</a></p>
            <p>Thank you for using CampusConnect!</p>
          `,
        };

        if (!resendApiKey || Deno.env.get("MOCK_EMAIL") === "true") {
          console.log(
            "Mocking notification email dispatch. Would have sent to:",
            emailList,
            emailBody,
          );
        } else {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify(emailBody),
          });
          if (!res.ok) {
            const errBody = await res.text();
            console.error("Resend matching notification email delivery failed:", errBody);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, outbox_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Outbox Worker Error]:", errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

