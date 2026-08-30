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

    const { appeal_id } = await req.json();
    if (!appeal_id) {
      throw new Error("appeal_id is required");
    }

    // 1. Fetch Appeal, Cancellation, Event, and Contract
    const { data: appeal, error: appealErr } = await supabaseClient
      .from("force_majeure_appeals")
      .select(
        `
        *,
        cancellation:event_cancellations(
          *,
          event:events(
            id, date, latitude, longitude
          ),
          contract:vendor_contracts(
            id, vendor_name
          )
        )
      `,
      )
      .eq("id", appeal_id)
      .single();

    if (appealErr || !appeal) throw appealErr || new Error("Appeal not found");

    const eventDate = new Date(appeal.cancellation.event.date);
    const lat = appeal.cancellation.event.latitude || 37.7749;
    const lon = appeal.cancellation.event.longitude || -122.4194;

    // 2. Third-Party Oracle: Query NOAA Severe Weather API for GPS coordinates
    // We fetch points to get the grid, then fetch the forecast/observations
    let weatherOracleData: any = {};
    try {
      const pointsRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
        headers: { "User-Agent": "CampusConnect/1.0" },
      });
      if (pointsRes.ok) {
        const pointsData = await pointsRes.json();
        const obsRes = await fetch(`${pointsData.properties.observationStations}`, {
          headers: { "User-Agent": "CampusConnect/1.0" },
        });
        if (obsRes.ok) {
          const obsData = await obsRes.json();
          const stationUrl = obsData.features[0]?.id;
          if (stationUrl) {
            // Fetch actual historical/current observations for the event time
            // For hackathon sake, we'll mock the extraction of precipitation
            const latestObs = await fetch(`${stationUrl}/observations/latest`, {
              headers: { "User-Agent": "CampusConnect/1.0" },
            }).then((r) => r.json());

            weatherOracleData = {
              source: "NOAA API",
              precipitationLastHour_mm: latestObs?.properties?.precipitationLastHour?.value || 0.1, // mock 0.1mm (puddle)
              textDescription: latestObs?.properties?.textDescription || "Light Drizzle",
              windSpeed_kmh: latestObs?.properties?.windSpeed?.value || 5,
              timestamp: latestObs?.properties?.timestamp,
            };
          }
        }
      }
    } catch (e) {
      console.error("NOAA API failed, falling back to mock oracle", e);
      weatherOracleData = {
        source: "NOAA API (Fallback)",
        precipitationLastHour_mm: 0.1, // 0.1 inches of rain = puddle
        textDescription: "Light Rain",
        severeWeatherAlerts: [],
      };
    }

    // 3. LLM Legal Evaluation via OpenAI
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) throw new Error("OPENAI_API_KEY missing");

    const contractText = `Standard Vendor Contract: Section 4 - Force Majeure. 
      Either party shall be excused from performance if prevented by an Act of God (severe hurricanes, flooding, earthquakes) 
      that objectively renders performance commercially impossible. Light weather or ordinary inconveniences do not apply.`;

    const prompt = `You are a strict, neutral legal contract oracle. Evaluate if the weather data legally constitutes a Force Majeure event that makes an indoor DJ performance impossible.
      
Weather Data Oracle (NOAA): ${JSON.stringify(weatherOracleData)}
Organizer's Claim: "${appeal.appeal_text}"
Vendor Contract Clause: "${contractText}"

Return exactly JSON: { "is_valid": true/false, "rationale": "short explanation" }`;

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!openAiRes.ok) throw new Error("OpenAI API failed");
    const openAiJson = await openAiRes.json();
    const llmResult = JSON.parse(openAiJson.choices[0].message.content);

    // 4. Update the appeal status and apply penalty if false
    const finalStatus = llmResult.is_valid ? "APPROVED" : "REJECTED";

    // Update Appeal
    await supabaseClient
      .from("force_majeure_appeals")
      .update({
        noaa_weather_data: weatherOracleData,
        llm_verdict: llmResult.is_valid,
        llm_rationale: llmResult.rationale,
        status: finalStatus,
      })
      .eq("id", appeal_id);

    // If False, automatically reject and process 20% penalty
    if (!llmResult.is_valid) {
      await supabaseClient
        .from("event_cancellations")
        .update({
          status: "PENALIZED_APPEAL_REJECTED",
        })
        .eq("id", appeal.cancellation_id);

      // We would trigger Stripe API here to process the penalty
      // await stripe.paymentIntents.create({ ... })
    } else {
      await supabaseClient
        .from("event_cancellations")
        .update({
          status: "PENALTY_WAIVED",
          penalty_applied_cents: 0,
        })
        .eq("id", appeal.cancellation_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: finalStatus,
        llmResult,
        weatherOracleData,
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
