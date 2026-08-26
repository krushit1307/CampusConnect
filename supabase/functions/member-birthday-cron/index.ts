import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[Birthday Cron] Running daily birthday query...");

    // 1. Fetch all members with birthdays in 3 days
    const { data: upcomingBirthdays, error: errBirthdays } = await supabase.rpc(
      "get_upcoming_member_birthdays",
    );

    if (errBirthdays) {
      console.error("Failed to query upcoming birthdays:", errBirthdays);
      throw errBirthdays;
    }

    console.log(`[Birthday Cron] Found ${upcomingBirthdays?.length ?? 0} upcoming birthdays.`);

    // 2. Compute weekday name for message formatting
    const birthdayIn3Days = new Date();
    birthdayIn3Days.setDate(birthdayIn3Days.getDate() + 3);
    const weekday = birthdayIn3Days.toLocaleDateString("en-US", { weekday: "long" });

    // Loop through each upcoming birthday
    for (const item of upcomingBirthdays || []) {
      const { user_id, first_name, last_name, club_id, auto_post_birthdays } = item;

      // A. Query club executives (President or Secretary role)
      const { data: executives, error: errExecs } = await supabase
        .from("club_members")
        .select("user_id")
        .eq("club_id", club_id)
        .eq("status", "approved")
        .in("role", ["president", "secretary", "PRESIDENT", "SECRETARY", "President", "Secretary"]);

      if (errExecs) {
        console.error(`Failed to fetch executives for club ${club_id}:`, errExecs);
        continue;
      }

      // B. Send push notification to each executive
      for (const exec of executives || []) {
        console.log(`[Birthday Cron] Sending push notification to executive ${exec.user_id} for ${first_name}'s birthday`);
        
        const pushPayload = {
          user_id: exec.user_id,
          title: "Upcoming Member Birthday! 🎂",
          message: `It's ${first_name}'s birthday on ${weekday}! Make sure to wish them well.`,
          url: `/clubs/${club_id}`,
        };

        const pushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
        try {
          const res = await fetch(pushUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify(pushPayload),
          });
          if (!res.ok) {
            const errText = await res.text();
            console.error(`Failed to send push notification to ${exec.user_id}:`, errText);
          }
        } catch (fetchErr) {
          console.error(`Fetch error sending push notification to ${exec.user_id}:`, fetchErr);
        }
      }

      // C. If auto-post is enabled, post a celebratory message to the club's forum
      if (auto_post_birthdays) {
        console.log(`[Birthday Cron] Auto-posting birthday shoutout to club ${club_id} forum`);
        
        const { error: errPost } = await supabase
          .from("posts")
          .insert({
            club_id: club_id,
            author_id: null, // System bot
            content: `🎉 Happy early Birthday to our amazing member, ${first_name} ${last_name}! Wishing you a wonderful year ahead! 🎂✨`,
          });

        if (errPost) {
          console.error(`Failed to auto-post birthday shoutout to club ${club_id}:`, errPost);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, count: upcomingBirthdays?.length ?? 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Birthday Cron Error]:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
