import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate user from Authorization token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse request payload parameters
    const { eventId } = await req.json();
    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Confirm the event exists and the user is the organizer
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, created_by")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.created_by !== user.id) {
      return new Response(JSON.stringify({ error: "Only the event organizer can export RSVPs." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Return accepted status immediately to avoid client request timeout
    const response = new Response(
      JSON.stringify({
        status: "processing",
        message: "Export has started. You will receive an email shortly.",
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );

    // 5. Stream and process the export in the background asynchronously
    (async () => {
      try {
        console.log(`[Export Service] Starting background export pipeline for event ${eventId}`);

        // A. Setup chunk-by-chunk paginated query stream to avoid memory exhaustion
        const rsvpStream = new ReadableStream({
          async start(controller) {
            // Write CSV headers
            controller.enqueue("User Name,Email,RSVP Date,Status\n");

            let offset = 0;
            const limit = 500;

            while (true) {
              const { data: rsvps, error: rsvpError } = await supabase
                .from("event_rsvps")
                .select("user_id, checked_in, rsvp_at, profiles (full_name)")
                .eq("event_id", eventId)
                .range(offset, offset + limit - 1)
                .order("rsvp_at", { ascending: true });

              if (rsvpError) {
                console.error("[Export Service] Query failure:", rsvpError);
                controller.error(rsvpError);
                return;
              }

              if (!rsvps || rsvps.length === 0) {
                break;
              }

              for (const r of rsvps) {
                const { data: userData } = await supabase.auth.admin.getUserById(r.user_id);
                const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;

                const name = profile?.full_name ?? "";
                const email = userData?.user?.email ?? "";
                const rsvpDate = r.rsvp_at ?? "";
                const status = r.checked_in ? "Checked In" : "Registered";

                const escapeValue = (val: string) => {
                  const str = String(val ?? "");
                  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
                };

                const csvLine = `${escapeValue(name)},${escapeValue(email)},${escapeValue(rsvpDate)},${escapeValue(status)}\n`;
                controller.enqueue(csvLine);
              }

              offset += limit;
            }
            controller.close();
          },
        });

        // B. Pipe text entries through TextEncoder and Compression Stream (gzip)
        const zippedStream = rsvpStream
          .pipeThrough(new TextEncoderStream())
          .pipeThrough(new CompressionStream("gzip"));

        const streamResponse = new Response(zippedStream);
        const compressedBlob = await streamResponse.blob();

        // C. Upload zipped file to exports storage bucket
        const fileName = `exports/${eventId}_${Date.now()}.csv.gz`;
        const { error: uploadError } = await supabase.storage
          .from("exports")
          .upload(fileName, compressedBlob, {
            contentType: "application/gzip",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Failed to upload to exports storage: ${uploadError.message}`);
        }

        // D. Generate secure 15-minute signed URL
        const { data: signedData, error: signedError } = await supabase.storage
          .from("exports")
          .createSignedUrl(fileName, 900); // 15 mins = 900s

        if (signedError || !signedData?.signedUrl) {
          throw new Error(`Failed to create signed URL: ${signedError?.message}`);
        }

        const downloadUrl = signedData.signedUrl;
        const recipientEmail = user.email || "";

        if (!recipientEmail) {
          throw new Error("Recipient email address is missing.");
        }

        // E. Deliver signed URL download link using Resend
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const emailBody = {
          from: "CampusConnect <exports@campusconnect.app>",
          to: [recipientEmail],
          subject: `Your RSVP Export for ${event.title} is Ready! 📅`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
                  .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
                  .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; text-align: center; }
                  .logo { font-size: 20px; font-weight: bold; color: #4f46e5; }
                  .btn-container { text-align: center; margin: 28px 0; }
                  .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; }
                  .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <span class="logo">📅 RSVP Export Pipeline</span>
                  </div>
                  <p>Hello Event Organizer,</p>
                  <p>Your requested RSVP data export for event <strong>${event.title}</strong> has been successfully generated and compressed.</p>
                  <p>Please click the button below to download the zip file. This download link will expire in <strong>15 minutes</strong> for security reasons.</p>
                  <div class="btn-container">
                    <a href="${downloadUrl}" class="btn">Download RSVP List</a>
                  </div>
                  <p>If the button doesn't work, copy and paste this URL into your browser:</p>
                  <p style="word-break: break-all; font-size: 13px; color: #4f46e5;">${downloadUrl}</p>
                  <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} CampusConnect. All rights reserved.</p>
                  </div>
                </div>
              </body>
            </html>
          `,
        };

        if (!resendApiKey) {
          console.log(`[Mock Mode] RSVP export email mock sent successfully to: ${recipientEmail}`);
          console.log(`[Mock Mode] Export URL: ${downloadUrl}`);
          return;
        }

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify(emailBody),
        });

        const resData = await emailRes.json();
        if (!emailRes.ok) {
          throw new Error(`Resend email delivery failed: ${JSON.stringify(resData)}`);
        }

        console.log(`[Export Service] RSVP export email delivered to ${recipientEmail}`);
      } catch (bgError) {
        console.error("[Export Service] Critical background processing error:", bgError);
      }
    })();

    return response;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Export Service] Request handling failed:", errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
