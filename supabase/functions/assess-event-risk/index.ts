// =============================================================================
// Edge Function: Assess Event Risk
// Issue: #3336 - Implement 'Automated Event Risk Assessment' Scoring
// Description: Triggered via Database Webhook on event INSERT/UPDATE. 
// Calculates a heuristic risk score based on capacity, tags, and end time. 
// Quarantines high-risk events and alerts the Safety Admin team.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventRecord {
    id: string;
    capacity: number | null;
    tags: string[] | null;
    end_date: string | null;
    title: string;
}

serve(async (req) => {
    // Verify Webhook secret
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_WEBHOOK_SECRET")}`) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { record } = await req.json();
    if (!record || !record.id) {
        return new Response("Invalid payload", { status: 400 });
    }

    const event = record as EventRecord;
    const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    try {
        let score = 0;
        const riskFactors: string[] = [];

        // 1. Capacity Check
        if (event.capacity && event.capacity > 300) {
            score += 5;
            riskFactors.push(`Large capacity (${event.capacity})`);
        }

        // 2. Tag Check (Alcohol, Party, Nightlife)
        const highRiskTags = ['party', 'alcohol', 'nightlife', 'rave', 'formal'];
        const eventTags = (event.tags || []).map(t => t.toLowerCase());
        const matchedTags = eventTags.filter(t => highRiskTags.includes(t));

        if (matchedTags.length > 0) {
            score += 10;
            riskFactors.push(`High-risk tags: ${matchedTags.join(', ')}`);
        }

        // 3. End Time Check (Past Midnight)
        if (event.end_date) {
            const endDate = new Date(event.end_date);
            const hours = endDate.getHours();
            // Past midnight means hours < 4 (e.g., 1 AM, 2 AM)
            if (hours >= 0 && hours < 4) {
                score += 3;
                riskFactors.push(`Ends past midnight (${endDate.toLocaleTimeString()})`);
            }
        }

        // 4. Determine Status
        let newStatus = 'draft'; // Or keep existing if it's already published
        if (score >= 10) {
            newStatus = 'pending_risk_review';
        }

        // 5. Update the event record
        await supabaseAdmin
            .from("events")
            .update({
                risk_score: score,
                risk_factors: riskFactors,
                status: newStatus
            })
            .eq("id", event.id);

        // 6. Alert Safety Admins if quarantined
        if (newStatus === 'pending_risk_review') {
            const { data: safetyAdmins } = await supabaseAdmin
                .from("profiles")
                .select("id")
                .eq("role", "safety_admin");

            if (safetyAdmins && safetyAdmins.length > 0) {
                const notifications = safetyAdmins.map(admin => ({
                    user_id: admin.id,
                    title: "🚨 High-Risk Event Requires Review",
                    body: `"${event.title}" scored ${score}/10 and has been quarantined.`,
                    link: `/admin/risk-review?event=${event.id}`,
                    is_read: false
                }));
                await supabaseAdmin.from("notifications").insert(notifications);
            }
        }

        return new Response(
            JSON.stringify({ success: true, score, status: newStatus }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[AssessEventRisk] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
