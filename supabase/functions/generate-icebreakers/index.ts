// =============================================================================
// Edge Function: Generate Icebreakers
// Issue: #3269 - Develop an 'Algorithmic Icebreaker' Engine for Networking Events
// Description: Triggered when a user checks into a networking event. Analyzes 
// the profiles of all other checked-in users, calculates a Jaccard similarity 
// score based on shared tags/majors, and inserts the top 3 matches into the 
// database with a generated conversational prompt.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserProfile {
    id: string;
    full_name: string;
    major: string | null;
    graduation_year: number | null;
    interest_tags: string[];
}

/**
 * Calculates the Jaccard similarity coefficient between two arrays of strings.
 * Returns a value between 0 (no overlap) and 1 (identical sets).
 */
function calculateJaccardSimilarity(setA: string[], setB: string[]): number {
    if (setA.length === 0 && setB.length === 0) return 0;

    const a = new Set(setA.map(s => s.toLowerCase().trim()));
    const b = new Set(setB.map(s => s.toLowerCase().trim()));

    const intersection = new Set([...a].filter(x => b.has(x)));
    const union = new Set([...a, ...b]);

    return intersection.size / union.size;
}

/**
 * Generates a natural language conversational prompt based on shared attributes.
 */
function generatePrompt(userA: UserProfile, userB: UserProfile, sharedTags: string[]): string {
    const prompts: string[] = [];

    if (sharedTags.length > 0) {
        const tagList = sharedTags.slice(0, 3).join(", ");
        prompts.push(`You both share an interest in ${tagList}.`);
    }

    if (userA.major && userB.major && userA.major === userB.major) {
        prompts.push(`You are both studying ${userA.major}.`);
    }

    if (userA.graduation_year && userB.graduation_year && userA.graduation_year === userB.graduation_year) {
        prompts.push(`You are both graduating in ${userA.graduation_year}.`);
    }

    if (prompts.length === 0) {
        return `Say hi to ${userB.full_name}! They might have a completely different perspective to share.`;
    }

    return `Talk to ${userB.full_name}! ${prompts.join(" ")}`;
}

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

        const { event_id } = await req.json();
        if (!event_id) throw new Error("Missing event_id");

        // 1. Fetch the current user's profile
        const { data: currentUser, error: userError } = await supabase
            .from("profiles")
            .select("id, full_name, major, graduation_year, interest_tags")
            .eq("id", user.id)
            .single();

        if (userError || !currentUser) throw new Error("User profile not found");

        // 2. Fetch all other checked-in attendees for this event
        const { data: attendees, error: attendeesError } = await supabase
            .from("event_rsvps")
            .select(`
        user_id,
        profiles:user_id (id, full_name, major, graduation_year, interest_tags)
      `)
            .eq("event_id", event_id)
            .eq("checked_in", true)
            .neq("user_id", user.id);

        if (attendeesError) throw attendeesError;

        const otherProfiles: UserProfile[] = (attendees || [])
            .map((a: any) => a.profiles)
            .filter((p: any) => p && p.id);

        if (otherProfiles.length === 0) {
            return new Response(
                JSON.stringify({ message: "No other attendees checked in yet." }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        // 3. Calculate similarity scores for all attendees
        const userTags = currentUser.interest_tags || [];
        const scoredMatches = otherProfiles.map(profile => {
            const profileTags = profile.interest_tags || [];

            // Combine tags, major, and graduation year for a holistic similarity score
            const allUserTraits = [...userTags, currentUser.major, currentUser.graduation_year?.toString()].filter(Boolean) as string[];
            const allProfileTraits = [...profileTags, profile.major, profile.graduation_year?.toString()].filter(Boolean) as string[];

            const score = calculateJaccardSimilarity(allUserTraits, allProfileTraits);

            // Find exact shared tags for the prompt
            const sharedTags = userTags.filter((tag: string) =>
                profileTags.map((t: string) => t.toLowerCase()).includes(tag.toLowerCase())
            );

            return {
                profile,
                score,
                sharedTags,
                prompt: generatePrompt(currentUser as UserProfile, profile, sharedTags)
            };
        });

        // 4. Sort by score descending and take the top 3
        const topMatches = scoredMatches
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .filter(m => m.score > 0.1); // Only suggest if there's at least 10% similarity

        if (topMatches.length === 0) {
            return new Response(
                JSON.stringify({ message: "No strong matches found, but go mingle!" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        // 5. Insert suggestions into the database (Ignore duplicates)
        const connectionsToInsert = topMatches.map(match => ({
            event_id,
            user_a_id: user.id,
            user_b_id: match.profile.id,
            similarity_score: match.score,
            shared_interests: match.sharedTags,
            conversation_prompt: match.prompt
        }));

        const { error: insertError } = await supabase
            .from("icebreaker_connections")
            .upsert(connectionsToInsert, { onConflict: "event_id,user_a_id,user_b_id" });

        if (insertError) throw insertError;

        return new Response(
            JSON.stringify({ success: true, matchesGenerated: topMatches.length }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[GenerateIcebreakers] Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});
