import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { generateCsv } from "./csv.ts";
import { generatePdf } from "./pdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Create a Supabase client with the Auth context of the logged in user.
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json();
    const { pollId, format } = body;

    if (!pollId || !format) {
      return new Response(JSON.stringify({ error: "Missing pollId or format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (format !== "pdf" && format !== "csv") {
      return new Response(JSON.stringify({ error: "Invalid format. Must be 'pdf' or 'csv'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch Poll
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .select("*")
      .eq("id", pollId)
      .single();

    if (pollError || !poll) {
      return new Response(JSON.stringify({ error: "Poll not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch Options
    const { data: options, error: optionsError } = await supabase
      .from("poll_options")
      .select("*")
      .eq("poll_id", pollId)
      .order("position", { ascending: true });

    if (optionsError) {
      throw optionsError;
    }

    // 3. Fetch Votes with User Details
    const { data: votes, error: votesError } = await supabase
      .from("poll_votes")
      .select(
        `
        *,
        profiles (
          id,
          full_name,
          email
        )
      `,
      )
      .eq("poll_id", pollId);

    if (votesError) {
      throw votesError;
    }

    const payload = {
      poll,
      options: options || [],
      votes: votes || [],
    };

    let resultBuffer: Uint8Array | string;
    let contentType = "";
    let fileExtension = "";

    if (format === "csv") {
      resultBuffer = generateCsv(payload);
      contentType = "text/csv";
      fileExtension = "csv";
    } else {
      resultBuffer = await generatePdf(payload);
      contentType = "application/pdf";
      fileExtension = "pdf";
    }

    return new Response(resultBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="poll-${pollId}.${fileExtension}"`,
      },
    });
  } catch (error: any) {
    console.error("Export Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
