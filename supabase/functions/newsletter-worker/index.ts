import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper for delays/rate limiting
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

serve(async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    if (token !== supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Forbidden: Invalid authorization token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Dequeue next pending job using SKIP LOCKED database RPC
    const { data: job, error: dequeueError } = await supabase
      .rpc("dequeue_bulk_email_job")
      .single();

    if (dequeueError) {
      throw new Error(`Failed to dequeue job: ${dequeueError.message}`);
    }

    if (!job) {
      return new Response(
        JSON.stringify({ message: "No pending email newsletter jobs in queue" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const jobId = job.id;
    const clubId = job.club_id;

    try {
      // 1. Fetch club info
      const { data: club, error: clubError } = await supabase
        .from("clubs")
        .select("name")
        .eq("id", clubId)
        .single();

      if (clubError || !club) {
        throw new Error(`Club not found or inaccessible: ${clubError?.message}`);
      }

      // 2. Retrieve all approved member emails for this club
      const { data: members, error: membersError } = await supabase.rpc("get_club_member_emails", {
        p_club_id: clubId,
      });

      if (membersError) {
        throw new Error(`Failed to retrieve club members: ${membersError.message}`);
      }

      const emails: string[] = (members || []).map((m: { email: string }) => m.email);

      // If no members are in the club, complete the job immediately
      if (emails.length === 0) {
        await supabase
          .from("bulk_email_jobs")
          .update({
            status: "completed",
            total_count: 0,
            processed_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        return new Response(
          JSON.stringify({ message: "Job completed: No members found for club", jobId }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Update total_count on the job
      await supabase
        .from("bulk_email_jobs")
        .update({
          total_count: emails.length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      // 3. Batch emails in chunks of 100 to respect mail provider payload limits and spam prevention
      const batchSize = 100;
      const resendApiKey = Deno.env.get("RESEND_API_KEY");

      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);

        const emailBody = {
          from: "CampusConnect <notifications@campusconnect.app>",
          to: ["notifications@campusconnect.app"], // Dummy to address
          bcc: batch,
          subject: `Newsletter from ${club.name}`,
          html: `
            <h2>Club Announcement</h2>
            <p>Hello member, here is the latest newsletter update from <strong>${club.name}</strong>!</p>
            <p>Make sure to check out our club page on CampusConnect for upcoming events and announcements.</p>
          `,
        };

        if (resendApiKey) {
          // Send via Resend API
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify(emailBody),
          });

          if (!res.ok) {
            const resData = await res.json().catch(() => ({}));
            throw new Error(`Resend API Error during sending batch: ${JSON.stringify(resData)}`);
          }
        } else {
          // Mock sending logs for development/testing
          console.log(`[newsletter-worker] Mock email batch sent to:`, batch);
        }

        // Update processed_count on the job
        await supabase
          .from("bulk_email_jobs")
          .update({
            processed_count: i + batch.length,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        // Throttling: Add a 1-second delay between batches to respect rate limits
        if (i + batchSize < emails.length) {
          await delay(1000);
        }
      }

      // 4. Update status to completed
      await supabase
        .from("bulk_email_jobs")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return new Response(
        JSON.stringify({ message: "Newsletter sent successfully to all members", jobId }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (jobError: unknown) {
      console.error(`Error processing job ${jobId}:`, jobError);
      const errorMessage =
        jobError instanceof Error ? jobError.message : "Unknown processing error";

      // Mark the job as failed with the captured error message
      await supabase
        .from("bulk_email_jobs")
        .update({
          status: "failed",
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return new Response(JSON.stringify({ error: `Job failed: ${errorMessage}`, jobId }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error: unknown) {
    console.error("newsletter-worker function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
