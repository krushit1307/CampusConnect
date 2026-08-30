import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { series_id } = await req.json();
    if (!series_id) throw new Error("series_id required");

    // Fetch Seminar Series details
    const { data: series, error: seriesErr } = await supabaseClient
      .from("alumni_seminar_series")
      .select(
        `
        *,
        alumni_seminar_events(event_id)
      `,
      )
      .eq("id", series_id)
      .single();

    if (seriesErr || !series) throw seriesErr || new Error("Series not found");
    if (!series.polygon_token_id && series.polygon_token_id !== 0) {
      throw new Error("Seminar series is not registered on Polygon");
    }

    const requiredEventsCount = series.required_events_count;
    const eventIds = series.alumni_seminar_events.map((e: any) => e.event_id);

    // Query Check-ins to find students with 100% attendance
    // A student has 100% attendance if they have a check-in for every event in eventIds
    const { data: checkins, error: checkinsErr } = await supabaseClient
      .from("event_checkins")
      .select("user_id, event_id")
      .in("event_id", eventIds);

    if (checkinsErr) throw checkinsErr;

    // Aggregate attendance per user
    const attendanceMap: Record<string, Set<string>> = {};
    for (const c of checkins || []) {
      if (!attendanceMap[c.user_id]) attendanceMap[c.user_id] = new Set();
      attendanceMap[c.user_id].add(c.event_id);
    }

    // Find users with 100% attendance
    const eligibleUserIds = Object.keys(attendanceMap).filter(
      (userId) => attendanceMap[userId].size === requiredEventsCount,
    );

    if (eligibleUserIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No eligible students found." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // Fetch Web3 Wallets for eligible students
    const { data: profiles, error: profilesErr } = await supabaseClient
      .from("profiles")
      .select("id, web3_wallet_address")
      .in("id", eligibleUserIds)
      .not("web3_wallet_address", "is", null);

    if (profilesErr) throw profilesErr;

    const mintedPayloads = [];
    for (const profile of profiles || []) {
      // Check if they already got the SBT
      const { data: existingSbt } = await supabaseClient
        .from("sbt_credentials")
        .select("id")
        .eq("student_id", profile.id)
        .eq("series_id", series_id)
        .maybeSingle();

      if (existingSbt) continue; // Already minted

      // Generate a mock hash of the user identity for the smart contract parameter
      const hashedIdentity =
        "0x" +
        Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      // In production, we'd use ethers.js/web3.js to sign & broadcast a real transaction
      // to Polygon invoking `mintCredential(studentWallet, seminarId, hashedIdentity)`
      // using the platform's Hot Wallet private key.

      // Mocking the successful Blockchain transaction hash:
      const mockTxHash =
        "0x" +
        Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      // Log the credential in the DB
      mintedPayloads.push({
        student_id: profile.id,
        series_id: series_id,
        polygon_tx_hash: mockTxHash,
      });
    }

    if (mintedPayloads.length > 0) {
      const { error: insertErr } = await supabaseClient
        .from("sbt_credentials")
        .insert(mintedPayloads);

      if (insertErr) throw insertErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        eligible_students: eligibleUserIds.length,
        minted_tokens: mintedPayloads.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err: any) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
