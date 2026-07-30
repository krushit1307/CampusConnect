import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { downloadZip, InputFile } from "https://esm.sh/client-zip@2.4.4";

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
    const { eventId } = await req.json();
    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the event info to get the event name for the zip filename
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List all files in the event's gallery folder
    const bucketName = "event-gallery";
    const { data: files, error: listError } = await supabase.storage.from(bucketName).list(eventId);

    if (listError) {
      throw listError;
    }

    // Filter out directories, placeholders, or empty files if any
    const filteredFiles = (files ?? []).filter(
      (file) => file.name !== ".emptyFolderPlaceholder" && file.metadata !== null,
    );

    if (filteredFiles.length === 0) {
      return new Response(JSON.stringify({ error: "No gallery photos found for this event." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generator function to fetch file streams sequentially on-demand
    async function* getFilesStream() {
      for (const file of filteredFiles) {
        // Authenticated download endpoint
        const fileUrl = `${supabaseUrl}/storage/v1/object/authenticated/${bucketName}/${eventId}/${file.name}`;

        const res = await fetch(fileUrl, {
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to stream storage file: ${file.name}`);
        }

        const input: InputFile = {
          name: file.name,
          lastModified: new Date(file.created_at || Date.now()),
          input: res.body!,
        };

        yield input;
      }
    }

    // Stream-compress all files to zip on-the-fly
    const zipResponse = downloadZip(getFilesStream());

    // Sanitize event title to build a valid filename
    const safeTitle = event.title.replace(/[^a-z0-9]+/gi, "_");
    const zipFilename = `${safeTitle}_Gallery.zip`;

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
