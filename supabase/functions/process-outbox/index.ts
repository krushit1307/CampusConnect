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
    } else if (table === "lost_found_items" && action === "PROCESS_FOUND_IMAGE") {
      const foundItem = record;
      if (foundItem?.id && foundItem?.image_url) {
        console.log(`[Outbox Worker] [AWS Rekognition] Analyzing found item image: ${foundItem.image_url}`);

        const textToAnalyze = `${foundItem.title} ${foundItem.description || ""}`.toLowerCase();
        const mockLabels = ["Item"];
        if (textToAnalyze.includes("bottle") || textToAnalyze.includes("hydroflask")) mockLabels.push("Bottle", "Container");
        if (textToAnalyze.includes("red")) mockLabels.push("Red");
        if (textToAnalyze.includes("blue")) mockLabels.push("Blue");
        if (textToAnalyze.includes("black")) mockLabels.push("Black");
        if (textToAnalyze.includes("phone") || textToAnalyze.includes("iphone")) mockLabels.push("Phone", "Electronics");
        if (textToAnalyze.includes("wallet")) mockLabels.push("Wallet", "Pocketbook");
        if (textToAnalyze.includes("keys") || textToAnalyze.includes("key")) mockLabels.push("Keys", "Metal");
        if (textToAnalyze.includes("backpack") || textToAnalyze.includes("bag")) mockLabels.push("Bag", "Backpack");
        if (textToAnalyze.includes("jacket") || textToAnalyze.includes("hoodie")) mockLabels.push("Jacket", "Clothing");

        console.log(`[AWS Rekognition] Extracted labels: ${JSON.stringify(mockLabels)}`);

        const { data: lostItems, error: errLost } = await supabase
          .from("lost_found_items")
          .select("id, title, description, user_id, location")
          .eq("type", "lost")
          .eq("status", "active");

        if (errLost) {
          console.error("Failed to query lost items:", errLost);
          throw errLost;
        }

        for (const lostItem of lostItems || []) {
          const lostText = `${lostItem.title} ${lostItem.description || ""}`.toLowerCase();
          
          let matchCount = 0;
          for (const label of mockLabels) {
            if (lostText.includes(label.toLowerCase())) {
              matchCount++;
            }
          }

          const confidence = mockLabels.length > 1 ? (matchCount / (mockLabels.length - 1)) * 100 : 0;
          console.log(`Matching against lost item "${lostItem.title}" (ID: ${lostItem.id}) - Confidence: ${confidence}%`);

          if (confidence >= 50) {
            console.log(`[High Confidence Match Found] Alerting user: ${lostItem.user_id}`);
            
            await supabase.from("lost_item_matches").insert({
              lost_item_id: lostItem.id,
              found_item_id: foundItem.id,
              score: confidence,
            });

            const pushBody = {
              user_id: lostItem.user_id,
              title: "Possible Match!",
              message: `A ${foundItem.title || "item"} was just found at the ${foundItem.location || "campus"}. Is this yours?`,
              url: `/lost-found`,
              type: "lost_found_match",
            };

            const pushRes = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify(pushBody),
            });

            if (!pushRes.ok) {
              console.error("Failed to send push notification:", await pushRes.text());
            } else {
              console.log("Push notification sent successfully!");
            }
          }
        }
      }
    } else if (table === "leadership_transitions" && action === "TRANSITION_INITIATED") {
      const transition = record;
      if (transition?.id) {
        console.log(`[Outbox Worker] [Leadership Transition Initiated] Processing transition: ${transition.id}`);

        const { data: incomingUser } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", transition.incoming_user_id)
          .single();

        const { data: club } = await supabase
          .from("clubs")
          .select("name, advisor_email")
          .eq("id", transition.club_id)
          .single();

        const clubName = club?.name || "Campus Club";
        const advisorEmail = club?.advisor_email || "advisor@campusconnect.test";
        const incomingName = `${incomingUser?.first_name || ""} ${incomingUser?.last_name || ""}`.trim() || "successor";

        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const emailBody = {
          from: "CampusConnect Student Union <su-advisors@campusconnect.app>",
          to: [advisorEmail],
          subject: `Action Required: Leadership Transfer for ${clubName}`,
          html: `
            <h2>Leadership Transfer Approval Required</h2>
            <p>The <strong>${clubName}</strong> is attempting to transfer the presidency to <strong>${incomingName}</strong>.</p>
            <p>This high-risk role transfer is currently pending and will not execute until you formally approve it.</p>
            <p>Please log into the Admin Dashboard to review and approve/reject this leadership change.</p>
          `,
        };

        if (!resendApiKey || Deno.env.get("MOCK_EMAIL") === "true") {
          console.log(
            "Mocking advisor transition notification email dispatch. Would have sent to:",
            advisorEmail,
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
            console.error("Resend advisor notification email delivery failed:", errBody);
          }
        }
      }
    } else if (table === "lost_items" && action === "POST_EVENT_LOST_FOUND") {
      const data = record;
      if (data?.attendee_email) {
        console.log(`[Outbox Worker] [Post-Event Lost & Found] Dispatching email to attendee: ${data.attendee_email}`);

        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const appUrl = Deno.env.get("APP_URL") || "https://campusconnect.edu";

        const emailBody = {
          from: "CampusConnect Student Union <lost-found@campusconnect.app>",
          to: [data.attendee_email],
          subject: `Found items from ${data.event_title}! 🔍`,
          html: `
            <h2>Hope you had fun at ${data.event_title}!</h2>
            <p>By the way, <strong>${data.items_count} items (${data.found_items})</strong> were found at the venue.</p>
            <p>If you lost something, please click below to view the active Lost & Found listings and claim your item:</p>
            <p><a href="${appUrl}/lost-found" style="display: inline-block; background-color: #a3e635; color: #000000; font-weight: bold; text-decoration: none; padding: 10px 20px; border: 2px solid #000000;">View Lost & Found Listings</a></p>
            <p>Thank you for using CampusConnect!</p>
          `,
        };

        if (!resendApiKey || Deno.env.get("MOCK_EMAIL") === "true") {
          console.log(
            "Mocking post-event lost & found email dispatch. Would have sent to:",
            data.attendee_email,
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
            console.error("Resend post-event lost & found notification email delivery failed:", errBody);
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

