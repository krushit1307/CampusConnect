import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    // 1. Find clubs where last_activity_at < NOW() - 1 year and hibernation_warning_sent_at IS NULL
    // We send a warning.
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoISO = oneYearAgo.toISOString();

    const { data: warningClubs, error: warningError } = await supabase
      .from("clubs")
      .select("id, name")
      .lt("last_activity_at", oneYearAgoISO)
      .is("hibernation_warning_sent_at", null)
      .eq("status", "active");

    if (warningError) throw warningError;

    for (const club of warningClubs || []) {
      // Mark as warning sent
      await supabase
        .from("clubs")
        .update({ hibernation_warning_sent_at: new Date().toISOString() })
        .eq("id", club.id);

      // We'd send an email here using an email service/RPC, but for now we log it or insert into notifications.
      console.log(`Warning sent for club: ${club.name}`);
    }

    // 2. Find clubs where warning was sent > 30 days ago and still no activity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    const { data: hibernatingClubs, error: hibernateError } = await supabase
      .from("clubs")
      .select("id, name, stripe_account_id")
      .lt("hibernation_warning_sent_at", thirtyDaysAgoISO)
      .lt("last_activity_at", oneYearAgoISO)
      .eq("status", "active");

    if (hibernateError) throw hibernateError;

    for (const club of hibernatingClubs || []) {
      await supabase
        .from("clubs")
        .update({
          status: "hibernating",
          hibernated_at: new Date().toISOString(),
          financial_hold: true,
        })
        .eq("id", club.id);

      console.log(`Hibernated club: ${club.name}`);
    }

    // 3. Dormant Fund Alert: Hibernated > 2 years & financial_hold = true
    // (Assuming we might check stripe_balance if we query Stripe, but we can just alert SU Treasurer for any financially held club > 2 years).
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const twoYearsAgoISO = twoYearsAgo.toISOString();

    const { data: dormantFundClubs, error: dormantError } = await supabase
      .from("clubs")
      .select("id, name")
      .eq("status", "hibernating")
      .eq("financial_hold", true)
      .lt("hibernated_at", twoYearsAgoISO);

    if (dormantError) throw dormantError;

    if (dormantFundClubs && dormantFundClubs.length > 0) {
      // Retrieve SU Treasurer (example, getting an admin with 'treasurer' role or just SU admin)
      const { data: treasurers } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .limit(1);

      if (treasurers && treasurers.length > 0) {
        const treasurerId = treasurers[0].id;
        for (const club of dormantFundClubs) {
          // Insert notification
          await supabase.from("notifications").insert({
            user_id: treasurerId,
            type: "alert",
            title: "Dormant Funds Alert",
            message: `Club ${club.name} has been hibernated for > 2 years and has a financial hold.`,
            link: `/admin/dormant-funds/${club.id}`,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        warned: warningClubs?.length || 0,
        hibernated: hibernatingClubs?.length || 0,
        dormantAlerts: dormantFundClubs?.length || 0,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
