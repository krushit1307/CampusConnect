// =============================================================================
// Edge Function: Analyze Tone
// Issue: #3557 - Implement 'Automated Event Description "Tone" Analyzer'
// Description: Analyzes event descriptions for informal slang, excessive
// exclamation points, and high emoji density. Returns a formality score
// and specific warnings for high-tier university department accounts.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Common informal slang dictionary (subset for demonstration)
const SLANG_DICTIONARY = [
    'fam', 'bruh', 'lit', 'bet', 'cap', 'bussin', 'sus', 'vibes', 'pull up',
    'lowkey', 'highkey', 'sheesh', 'finna', 'yeet', 'slaps', 'drip', 'goat'
];

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { text, club_id } = await req.json();
        if (!text || !club_id) throw new Error("Missing text or club_id");

        // 1. Verify if the club is an official university department
        const { data: club, error: clubError } = await supabase
            .from("clubs")
            .select("is_official_university_dept")
            .eq("id", club_id)
            .single();

        if (clubError || !club) throw new Error("Club not found");

        // If not an official department, bypass strict tone analysis
        if (!club.is_official_university_dept) {
            return new Response(
                JSON.stringify({ is_official: false, score: 100, warnings: [] }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
        }

        // 2. Analyze the text for tone violations
        const lowerText = text.toLowerCase();
        const warnings: string[] = [];
        let penaltyScore = 0;

        // Check for slang
        const foundSlang = SLANG_DICTIONARY.filter(slang => {
            const regex = new RegExp(`\\b${slang}\\b`, 'i');
            return regex.test(lowerText);
        });

        if (foundSlang.length > 0) {
            warnings.push(`Informal slang detected: "${foundSlang.join('", "')}"`);
            penaltyScore += foundSlang.length * 15;
        }

        // Check for excessive exclamation points
        const exclamationCount = (text.match(/!/g) || []).length;
        if (exclamationCount > 2) {
            warnings.push(`Excessive exclamation points (${exclamationCount}). Use sparingly for professional tone.`);
            penaltyScore += (exclamationCount - 2) * 5;
        }

        // Check for high emoji density (match common emoji unicode ranges)
        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
        const emojiMatches = text.match(emojiRegex) || [];
        const emojiDensity = emojiMatches.length / (text.length || 1);

        if (emojiMatches.length > 3 || emojiDensity > 0.05) {
            warnings.push(`High emoji density (${emojiMatches.length} emojis). Official communications should minimize emojis.`);
            penaltyScore += emojiMatches.length * 10;
        }

        // Check for all-caps words (shouting)
        const words = text.split(/\s+/);
        const allCapsWords = words.filter(w => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
        if (allCapsWords.length > 2) {
            warnings.push(`Avoid using ALL CAPS (${allCapsWords.length} words) in official descriptions.`);
            penaltyScore += allCapsWords.length * 10;
        }

        // Calculate final formality score (100 = perfect, 0 = highly informal)
        const formalityScore = Math.max(0, 100 - penaltyScore);

        return new Response(
            JSON.stringify({
                is_official: true,
                score: formalityScore,
                warnings: warnings,
                requires_review: formalityScore < 70
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[AnalyzeTone] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
