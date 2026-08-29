import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from "npm:openai";

// Standard CORS headers for Supabase Edge Functions
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests from the browser
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { toxicMessages } = await req.json();

    if (!toxicMessages || !Array.isArray(toxicMessages) || toxicMessages.length === 0) {
      return new Response(JSON.stringify({ error: "No toxic messages provided." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"), // Deno uses Deno.env.get instead of process.env
    });

    const prompt = `
      You are helping a user write an apology for their behavior on a community platform.
      Here are the user's recent toxic messages:
      
      ${toxicMessages.map((msg: string) => `- "${msg}"`).join("\n")}
      
      Task: Draft a sincere, 1-paragraph apology letter from this user acknowledging why these specific messages were harmful to the community. 
      Write it in the first person ("I"). Do not include any introductory or concluding text, just the paragraph itself.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const apology = completion.choices[0].message.content?.trim();

    return new Response(JSON.stringify({ apology }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating apology:", error);
    return new Response(JSON.stringify({ error: "Failed to generate apology." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
