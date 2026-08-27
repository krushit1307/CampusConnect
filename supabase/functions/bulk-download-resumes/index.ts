import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { downloadZip, InputFile } from "https://esm.sh/client-zip@2.4.4";
import { parseJsonBody } from "../_shared/validation.ts";

const bulkDownloadResumesSchema = z
  .object({
    eventId: z.string().uuid("eventId must be a valid UUID"),
  })
  .strict();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get JWT from authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is authenticated
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

    // Parse request body for eventId
    const parsed = await parseJsonBody(bulkDownloadResumesSchema, req);
    if (!parsed.ok) return parsed.response;
    const { eventId } = parsed.data;

    // Verify user is an authorized sponsor or creator
    const { data: sponsor, error: sponsorError } = await supabase
      .from("event_sponsors")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

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

    if (!sponsor && event.created_by !== user.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized to download resumes for this event" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch RSVPs that have a resume_path for this event
    const { data: rsvps, error: rsvpsError } = await supabase
      .from("event_rsvps")
      .select("resume_path, profiles ( first_name, last_name )")
      .eq("event_id", eventId)
      .not("resume_path", "is", null);

    if (rsvpsError) {
      throw rsvpsError;
    }

    if (!rsvps || rsvps.length === 0) {
      return new Response(JSON.stringify({ error: "No resumes found for this event." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bucketName = "resumes";

    // Generator function to fetch file streams sequentially on-demand
    async function* getFilesStream() {
      // Keep track of counts for duplicate names
      const nameCounts: Record<string, number> = {};

      for (const rsvp of rsvps) {
        if (!rsvp.resume_path) continue;

        // Authenticated download endpoint
        const fileUrl = `${supabaseUrl}/storage/v1/object/authenticated/${bucketName}/${rsvp.resume_path}`;

        const res = await fetch(fileUrl, {
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
        });

        if (!res.ok) {
          console.warn(`Failed to stream storage file: ${rsvp.resume_path}`);
          continue;
        }

        let firstName = rsvp.profiles?.first_name || "Unknown";
        let lastName = rsvp.profiles?.last_name || "User";
        let baseFilename = `${lastName}_${firstName}_Resume`.replace(/[^a-z0-9_]/gi, "");

        if (nameCounts[baseFilename]) {
          nameCounts[baseFilename]++;
          baseFilename = `${baseFilename}_${nameCounts[baseFilename]}`;
        } else {
          nameCounts[baseFilename] = 1;
        }

        const filename = `${baseFilename}.pdf`;

        const input: InputFile = {
          name: filename,
          lastModified: new Date(),
          input: res.body!,
        };

        yield input;
      }
    }

    // Stream-compress all files to zip on-the-fly
    const zipResponse = downloadZip(getFilesStream());

    // Sanitize event title to build a valid filename
    const safeTitle = event.title.replace(/[^a-z0-9]+/gi, "_");
    const zipFilename = `${safeTitle}_Resumes.zip`;

    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set("Content-Type", "application/zip");
    responseHeaders.set("Content-Disposition", `attachment; filename="${zipFilename}"`);

    return new Response(zipResponse.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Internal Bulk ZIP Download Error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred generating zip archive." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
