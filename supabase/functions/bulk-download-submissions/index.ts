import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { downloadZip, InputFile } from "https://esm.sh/client-zip@2.4.4";
import { parseJsonBody } from "../_shared/validation.ts";

const bulkDownloadSubmissionsSchema = z
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
    const parsed = await parseJsonBody(bulkDownloadSubmissionsSchema, req);
    if (!parsed.ok) return parsed.response;
    const { eventId } = parsed.data;

    // Fetch the event info
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, club_id, created_by")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check organizer/admin permissions
    let isAuthorized = event.created_by === user.id;

    if (!isAuthorized && event.club_id) {
      const { data: membership } = await supabase
        .from("club_members")
        .select("id, role")
        .eq("club_id", event.club_id)
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();

      if (membership && ["admin", "organizer", "president", "officer"].includes(membership.role.toLowerCase())) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized to download submissions for this event" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch all submissions for this event
    const { data: submissions, error: submissionsError } = await supabase
      .from("event_submissions")
      .select(`
        id,
        team_name,
        storage_path,
        file_name,
        file_type,
        profiles ( first_name, last_name, handle )
      `)
      .eq("event_id", eventId);

    if (submissionsError) {
      throw submissionsError;
    }

    if (!submissions || submissions.length === 0) {
      return new Response(JSON.stringify({ error: "No submissions found for this event." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bucketName = "event-submissions";

    // Generator function to stream submission files into zip sequentially
    async function* getFilesStream() {
      const nameCounts: Record<string, number> = {};

      for (const sub of submissions) {
        if (!sub.storage_path) continue;

        const fileUrl = `${supabaseUrl}/storage/v1/object/authenticated/${bucketName}/${sub.storage_path}`;

        const res = await fetch(fileUrl, {
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
        });

        if (!res.ok) {
          console.warn(`Failed to fetch storage file: ${sub.storage_path}`);
          continue;
        }

        const ext = sub.file_name.split(".").pop() || "file";
        const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
        const firstName = profile?.first_name || "User";
        const lastName = profile?.last_name || "";
        const displayName = sub.team_name || `${lastName}_${firstName}`.replace(/^_+|_+$/g, "");

        let baseFilename = `${displayName}_Submission`.replace(/[^a-z0-9_]/gi, "_");

        if (nameCounts[baseFilename]) {
          nameCounts[baseFilename]++;
          baseFilename = `${baseFilename}_${nameCounts[baseFilename]}`;
        } else {
          nameCounts[baseFilename] = 1;
        }

        const filename = `${baseFilename}.${ext}`;

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

    const safeTitle = event.title.replace(/[^a-z0-9]+/gi, "_");
    const zipFilename = `${safeTitle}_Submissions.zip`;

    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set("Content-Type", "application/zip");
    responseHeaders.set("Content-Disposition", `attachment; filename="${zipFilename}"`);

    return new Response(zipResponse.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Internal Bulk Submissions ZIP Download Error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred generating zip archive." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
