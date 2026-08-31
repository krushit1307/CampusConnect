import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HIGH_VALUE_THRESHOLD_CENTS = 50000; // $500 total donations to be considered high-value

// A helper to calculate the score based on velocity drop
function calculateRiskScore(
  velocityChangePct: number,
  baselineVelocity: number,
  isHighValue: boolean,
) {
  if (baselineVelocity < 5) return 0; // Not enough data to confidently predict churn
  if (velocityChangePct >= 0) return 0; // Velocity increased or stable

  let score = Math.abs(velocityChangePct); // base score 0-100 based on % drop

  if (isHighValue) score += 20; // High value donors get a risk bump if they drop
  if (baselineVelocity > 20) score += 10; // Highly active users dropping is a stronger signal

  return Math.min(100, Math.max(0, score));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // We use service role to read all interactions and write predictions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Ensure authentication (e.g., triggered by cron or club admin)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const { club_id } = await req.json();
    if (!club_id) throw new Error("club_id is required");

    // 1. Fetch all successful donations for this club to identify donors and their total volume
    const { data: campaigns } = await supabaseAdmin
      .from("crowdfunding_campaigns")
      .select("id")
      .eq("club_id", club_id);

    const campaignIds = campaigns?.map((c) => c.id) || [];

    let donations: any[] = [];
    if (campaignIds.length > 0) {
      const { data: d } = await supabaseAdmin
        .from("campaign_donations")
        .select("donor_id, amount_cents, created_at, status")
        .in("campaign_id", campaignIds)
        .eq("status", "succeeded")
        .not("donor_id", "is", null);
      donations = d || [];
    }

    // Aggregate total donation volume per donor
    const donorVolumes = new Map<string, number>();
    for (const d of donations) {
      const current = donorVolumes.get(d.donor_id) || 0;
      donorVolumes.set(d.donor_id, current + d.amount_cents);
    }

    const donors = Array.from(donorVolumes.keys());
    if (donors.length === 0) {
      return new Response(JSON.stringify({ message: "No donors found for this club" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. We could sync RSVPs and Donations to `donor_interaction_events` here for completeness,
    // but for a robust model we will fetch existing events.
    // For demonstration, let's assume `donor_interaction_events` is partially populated,
    // but we'll also dynamically pull RSVPs to merge them.

    const { data: rsvps } = await supabaseAdmin
      .from("event_rsvps")
      .select("user_id, created_at")
      .eq("club_id", club_id)
      .in("user_id", donors)
      .eq("status", "going");

    // Fetch explicit events
    const { data: explicitEvents } = await supabaseAdmin
      .from("donor_interaction_events")
      .select("user_id, interaction_type, weight, occurred_at")
      .eq("club_id", club_id)
      .in("user_id", donors);

    // 3. Aggregate all interactions per donor
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const donorStats = new Map<
      string,
      {
        baselineWeight: number;
        currentWeight: number;
        lastInteraction: Date | null;
        factors: Set<string>;
      }
    >();

    for (const donorId of donors) {
      donorStats.set(donorId, {
        baselineWeight: 0,
        currentWeight: 0,
        lastInteraction: null,
        factors: new Set(),
      });
    }

    const processInteraction = (userId: string, dateStr: string, weight: number, type: string) => {
      const stats = donorStats.get(userId);
      if (!stats) return;

      const date = new Date(dateStr);
      if (date > now) return;

      if (!stats.lastInteraction || date > stats.lastInteraction) {
        stats.lastInteraction = date;
      }

      if (date >= ninetyDaysAgo) {
        stats.currentWeight += weight;
        stats.factors.add(type);
      } else if (date >= oneEightyDaysAgo && date < ninetyDaysAgo) {
        stats.baselineWeight += weight;
      }
    };

    // Add Donations (Weight = 5)
    donations.forEach((d) => processInteraction(d.donor_id, d.created_at, 5, "donation"));
    // Add RSVPs (Weight = 2)
    rsvps?.forEach((r) => processInteraction(r.user_id, r.created_at, 2, "rsvp"));
    // Add Explicit events (Weight = event.weight)
    explicitEvents?.forEach((e) =>
      processInteraction(e.user_id, e.occurred_at, e.weight, e.interaction_type),
    );

    // 4. Calculate Churn Risk and Save
    const results = [];

    for (const [donorId, stats] of donorStats.entries()) {
      const volume = donorVolumes.get(donorId) || 0;
      const isHighValue = volume >= HIGH_VALUE_THRESHOLD_CENTS;

      let velocityChangePct = 0;
      if (stats.baselineWeight > 0) {
        velocityChangePct =
          ((stats.currentWeight - stats.baselineWeight) / stats.baselineWeight) * 100;
      } else if (stats.currentWeight > 0) {
        velocityChangePct = 100; // Went from 0 to something
      }

      const riskScore = calculateRiskScore(velocityChangePct, stats.baselineWeight, isHighValue);

      let riskLevel = "low";
      if (riskScore > 80) riskLevel = "critical";
      else if (riskScore > 60) riskLevel = "high";
      else if (riskScore > 30) riskLevel = "medium";

      const prediction = {
        user_id: donorId,
        club_id: club_id,
        baseline_velocity: stats.baselineWeight,
        current_velocity: stats.currentWeight,
        velocity_change_pct: velocityChangePct,
        risk_score: riskScore,
        risk_level: riskLevel,
        is_high_value_donor: isHighValue,
        total_donation_volume_cents: volume,
        last_meaningful_interaction_at: stats.lastInteraction?.toISOString() || null,
        contributing_factors: Array.from(stats.factors),
        calculated_at: now.toISOString(),
      };
      results.push(prediction);
    }

    // Upsert predictions
    for (const pred of results) {
      const { data: existing } = await supabaseAdmin
        .from("donor_churn_predictions")
        .select("id, alert_task_id, risk_level")
        .eq("user_id", pred.user_id)
        .eq("club_id", pred.club_id)
        .single();

      let alertTaskId = existing?.alert_task_id;

      // 5. Trigger Workflow for High/Critical Churn Risk on High-Value Donors
      // Requirements: "Detect high-value donors whose interaction velocity drops by more than 75%"
      // "Prevent duplicate alerts/tasks for the same donor and risk period."
      if (
        pred.is_high_value_donor &&
        pred.velocity_change_pct <= -75 &&
        ["high", "critical"].includes(pred.risk_level)
      ) {
        // If we haven't alerted, or if the alert task is completed (meaning they handled it but they dropped again... actually usually we only alert once per risk phase)
        if (!alertTaskId) {
          // Fetch donor profile name
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("id", pred.user_id)
            .single();

          const donorName = profile?.full_name || "Unknown Donor";

          const { data: task } = await supabaseAdmin
            .from("tasks")
            .insert({
              club_id: club_id,
              title: `Donor Churn Risk Alert: ${donorName}`,
              description: `High-value donor ${donorName} (Total: $${(pred.total_donation_volume_cents / 100).toFixed(2)}) has shown a ${Math.abs(Math.round(pred.velocity_change_pct))}% drop in engagement over the last 90 days. Current Velocity: ${pred.current_velocity}, Baseline: ${pred.baseline_velocity}. Action required: Reach out to re-engage.`,
              status: "todo",
              order_index: 0,
            })
            .select("id")
            .single();

          if (task) {
            alertTaskId = task.id;
          }
        }
      } else if (pred.risk_level === "low" && alertTaskId) {
        // If they recovered, maybe we can clear the alert task id so they can be alerted again in the future if they drop again.
        // Or leave it. Let's clear it so they can be re-alerted if they drop again next year.
        alertTaskId = null;
      }

      if (existing) {
        await supabaseAdmin
          .from("donor_churn_predictions")
          .update({ ...pred, alert_task_id: alertTaskId })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("donor_churn_predictions")
          .insert({ ...pred, alert_task_id: alertTaskId });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[DonorChurnModeler] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
