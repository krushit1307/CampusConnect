// supabase/functions/match-club-mentor/index.ts
// Algorithmic Mentorship Matchmaker pairing incoming club executives with experienced alumni leaders

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { mentee_user_id, club_id, role_title } = await req.json();

    if (!mentee_user_id || !role_title) {
      return new Response(JSON.stringify({ error: "Missing mentee_user_id or role_title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch club info
    let clubCategory = "general";
    let clubName = "Campus Club";
    if (club_id) {
      const { data: club } = await supabase
        .from("clubs")
        .select("name, category")
        .eq("id", club_id)
        .maybeSingle();

      if (club) {
        clubCategory = club.category || "general";
        clubName = club.name;
      }
    }

    // 2. Query available alumni mentors
    const { data: mentors, error: mentorError } = await supabase
      .from("alumni_mentorship_profiles")
      .select("*")
      .eq("is_opted_in", true)
      .neq("user_id", mentee_user_id);

    if (mentorError || !mentors || mentors.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No available alumni mentors currently opted in." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Score mentors based on exact role match and category match
    let bestMentor = null;
    let highestScore = -1;

    for (const mentor of mentors) {
      if (mentor.current_mentees_count >= mentor.max_mentees) continue;

      let score = 0;
      const roles = (mentor.past_club_roles as Array<{ role?: string; club_name?: string }>) || [];
      const hasExactRole = roles.some(
        (r) => r.role?.toLowerCase() === role_title.toLowerCase()
      );
      if (hasExactRole) score += 50;

      const hasCategoryMatch = (mentor.club_categories || []).includes(clubCategory);
      if (hasCategoryMatch) score += 30;

      if (score > highestScore) {
        highestScore = score;
        bestMentor = mentor;
      }
    }

    if (!bestMentor) {
      bestMentor = mentors[0]; // fallback to first available
    }

    // 4. Provision DM channel & Create match
    const channelId = `mentor_${bestMentor.user_id.slice(0, 8)}_${mentee_user_id.slice(0, 8)}`;
    const introMessage = `Hi! You have been paired with an alumni mentor who previously served as ${role_title} for ${clubName}. Feel free to ask questions!`;

    const { data: match, error: matchError } = await supabase
      .from("mentorship_matches")
      .upsert(
        {
          mentor_user_id: bestMentor.user_id,
          mentee_user_id,
          club_id: club_id || null,
          role_title,
          status: "pending",
          channel_id: channelId,
          intro_message: introMessage,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "mentor_user_id,mentee_user_id,club_id" }
      )
      .select()
      .single();

    if (matchError) {
      throw matchError;
    }

    // Increment mentor count
    await supabase
      .from("alumni_mentorship_profiles")
      .update({ current_mentees_count: bestMentor.current_mentees_count + 1 })
      .eq("id", bestMentor.id);

    return new Response(
      JSON.stringify({
        success: true,
        match,
        channel_id: channelId,
        intro_message: introMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
