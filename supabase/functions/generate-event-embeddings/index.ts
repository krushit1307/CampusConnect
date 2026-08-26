import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Fetches/computes text embeddings from HuggingFace pipeline forsentence-transformers/all-MiniLM-L6-v2
 */
async function getEmbedding(text: string, token?: string): Promise<number[]> {
  if (!token) {
    console.log(
      "[Embedding Service] HUGGINGFACE_ACCESS_TOKEN not set. Generating fallback normalized 384-dimensional vector.",
    );
    // Generate random mock vector (384 dimensions)
    const mockVector = new Array(384).fill(0).map(() => Math.random() - 0.5);
    // Normalize mock vector
    const magnitude = Math.sqrt(mockVector.reduce((sum, val) => sum + val * val, 0));
    return mockVector.map((val) => val / magnitude);
  }

  const response = await fetch(
    "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({ inputs: text }),
    },
  );

  if (!response.ok) {
    throw new Error(`HuggingFace API returned error status: ${response.statusText}`);
  }

  const result = await response.json();

  if (!Array.isArray(result)) {
    throw new Error("Unexpected embedding response payload format from HuggingFace.");
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Webhook record format or direct payload
    const record = body?.record || body;
    const eventId = record?.id;
    const title = record?.title || "";
    const description = record?.description || "";

    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const textToEmbed = `${title} ${description}`.trim();
    if (!textToEmbed) {
      return new Response(
        JSON.stringify({ error: "No text content available to generate embedding" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1. Generate text embedding vector
    const hfToken =
      Deno.env.get("HUGGINGFACE_ACCESS_TOKEN") || Deno.env.get("HF_ACCESS_TOKEN") || "";
    const embedding = await getEmbedding(textToEmbed, hfToken);

    // 2. Initialize Supabase Client with service key to bypass table security limits
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Update the event row with the generated vector
    const { error: dbError } = await supabase
      .from("events")
      .update({ embedding: embedding })
      .eq("id", eventId);

    if (dbError) {
      throw new Error(`Failed to update event embedding in database: ${dbError.message}`);
    }

    console.log(`[Embedding Service] Successfully updated embedding vector for event ${eventId}.`);

    return new Response(JSON.stringify({ success: true, eventId, dimensions: embedding.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Embedding Service Error]:", errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
