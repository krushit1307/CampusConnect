// =============================================================================
// Edge Function: Fetch Speaker Bio
//  Issue: #3339 - Implement 'Automated Speaker Bio Fetching'
//  Description: Takes a LinkedIn URL, fetches the public profile data via 
//  the Proxycurl API (or mock), and passes the work history to an LLM 
//  (OpenAI) to generate a concise 3-sentence professional biography.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.20.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { linkedin_url } = await req.json();
        if (!linkedin_url || !linkedin_url.includes("linkedin.com/in/")) {
            throw new Error("Invalid LinkedIn URL provided.");
        }

        // 1. Fetch Profile Data
        // In production, use Proxycurl API: https://nubela.co/proxycurl/
        // For this implementation, we'll simulate the API response structure
        let profileData: any;

        try {
            const proxyCurlApiKey = Deno.env.get("PROXYCURL_API_KEY");
            if (proxyCurlApiKey) {
                const response = await fetch(`https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(linkedin_url)}`, {
                    headers: { "Authorization": `Bearer ${proxyCurlApiKey}` }
                });
                profileData = await response.json();
            } else {
                // Mock data for development/testing
                profileData = {
                    full_name: "Dr. Jane Smith",
                    headline: "Chief AI Officer at TechCorp | Keynote Speaker",
                    summary: "Passionate about the intersection of AI and ethics.",
                    experiences: [
                        { company: "TechCorp", title: "Chief AI Officer", starts_at: { year: 2020 }, description: "Leading AI strategy." },
                        { company: "MIT", title: "Professor of Computer Science", starts_at: { year: 2015 }, ends_at: { year: 2020 } },
                        { company: "Google DeepMind", title: "Senior Researcher", starts_at: { year: 2010 }, ends_at: { year: 2015 } }
                    ],
                    profile_pic_url: "https://example.com/photo.jpg"
                };
            }
        } catch (fetchError) {
            throw new Error("Failed to fetch LinkedIn profile data. The profile may be private.");
        }

        // 2. Format work history for the LLM
        const workHistory = (profileData.experiences || [])
            .slice(0, 5) // Limit to last 5 roles to save tokens
            .map((exp: any) => `${exp.title} at ${exp.company} (${exp.starts_at?.year || 'N/A'} - ${exp.ends_at?.year || 'Present'})`)
            .join("\n");

        const prompt = `
      You are a professional copywriter. Write a concise, 3-sentence professional biography for a guest speaker based on the following profile data.
      Do not use first-person ("I"). Use third-person ("Dr. Smith is...").
      Focus on their current role, past notable achievements, and overall expertise.
      
      Name: ${profileData.full_name}
      Headline: ${profileData.headline}
      Work History:
      ${workHistory}
    `;

        // 3. Generate Bio via LLM
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5,
            max_tokens: 150,
        });

        const generatedBio = completion.choices[0].message.content?.trim() || "Unable to generate biography.";

        // 4. Return the generated data to the frontend
        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    name: profileData.full_name,
                    bio: generatedBio,
                    photo_url: profileData.profile_pic_url,
                    headline: profileData.headline
                }
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[FetchSpeakerBio] Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
});
