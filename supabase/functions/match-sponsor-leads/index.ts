// Edge Function: Match Sponsor Leads
// Description: Skill matching algorithm between parsed student resumes and sponsor Job Descriptions.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { skills } = await req.json();
    if (!skills || !Array.isArray(skills)) {
      throw new Error("Skills array is required.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all JDs
    const { data: jds, error: jdError } = await supabaseAdmin
      .from("sponsor_job_descriptions")
      .select("*");

    if (jdError) throw jdError;

    const matches = [];

    for (const jd of jds) {
      // Calculate Jaccard Similarity index
      const candidateSkillsLower = skills.map((s: string) => s.toLowerCase());
      const jdSkillsLower = jd.required_skills.map((s: string) => s.toLowerCase());

      const intersection = candidateSkillsLower.filter((s: string) => jdSkillsLower.includes(s));
      const union = Array.from(new Set([...candidateSkillsLower, ...jdSkillsLower]));

      const jaccard = union.length > 0 ? intersection.length / union.length : 0;
      const matchPercentage = Math.round(jaccard * 100);

      // We only care about high matches (>= 60%)
      if (matchPercentage >= 60) {
        const missing = jd.required_skills.filter(
          (s: string) => !candidateSkillsLower.includes(s.toLowerCase()),
        );

        const highlightMsg = missing.length > 0 ? missing[0] : "skills";

        // Notify student
        await supabaseAdmin.from("notifications").insert({
          user_id: user.id,
          title: `🎯 High Skill Match with ${jd.company_name}`,
          message: `You are an ${matchPercentage}% match for ${jd.company_name}'s open roles! Highlight your ${highlightMsg} experience when you talk to them.`,
          link: `/explore`,
          type: "skill_match",
        });

        // Notify Recruiter
        await supabaseAdmin.from("notifications").insert({
          user_id: jd.sponsor_id,
          title: "🔥 High Match Candidate Approaching",
          message: `High Match Alert: A student with ${matchPercentage}% skill compatibility is approaching your booth.`,
          link: `/dashboard`,
          type: "recruiter_alert",
        });

        // Dispatch push notification to Recruiter
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              user_id: jd.sponsor_id,
              title: "🔥 High Match Candidate Approaching",
              message: `A student with ${matchPercentage}% skill compatibility is approaching your booth.`,
              priority: "high",
            }),
          });
        } catch (err: any) {
          console.error("Failed to send recruiter alert:", err.message);
        }

        matches.push({
          company: jd.company_name,
          title: jd.title,
          match: matchPercentage,
          missing: missing,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, matches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Match Sponsor Leads Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
