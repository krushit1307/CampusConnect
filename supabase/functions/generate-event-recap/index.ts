import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface EventDataPayload {
  eventId: string;
  tone: "professional" | "hype" | "casual";
}

const MINIMUM_ATTENDANCE_THRESHOLD = 3;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const openAiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { eventId, tone = "hype" }: EventDataPayload = await req.json();

    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Fetch Event Info & Attendance Count
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("*, clubs(name, slug)")
      .eq("id", eventId)
      .single();

    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { count: attendanceCount } = await supabase
      .from("event_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("checked_in", true);

    // 2. Data Scarcity Check (Prevent Hallucinations)
    const effectiveAttendance = attendanceCount || 0;
    if (effectiveAttendance < MINIMUM_ATTENDANCE_THRESHOLD) {
      return new Response(
        JSON.stringify({
          error: "DATA_SCARCITY",
          message: `Insufficient event data to generate recap. Requires at least ${MINIMUM_ATTENDANCE_THRESHOLD} verified attendees (current: ${effectiveAttendance}).`,
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 3. Aggregate Top Q&A Questions
    const { data: qaData } = await supabase
      .from("event_questions")
      .select("question, upvotes")
      .eq("event_id", eventId)
      .order("upvotes", { ascending: false })
      .limit(3);

    // 4. Aggregate Live Poll Results
    const { data: pollData } = await supabase
      .from("live_polls")
      .select("question, options, total_votes")
      .eq("event_id", eventId)
      .limit(2);

    // 5. Aggregate Photo Gallery Tags & Photos
    const { data: photos } = await supabase
      .from("event_photos")
      .select("photo_url, tags, rating")
      .eq("event_id", eventId)
      .order("rating", { ascending: false })
      .limit(3);

    const topPhotos = photos?.map((p) => p.photo_url) || [];
    const photoTags = photos?.flatMap((p) => p.tags || []) || [];

    // Tone Prompt Configuration
    let toneInstruction =
      "Write in an exciting, high-energy, and celebratory tone celebrating campus spirit.";
    if (tone === "professional") {
      toneInstruction =
        "Write in an academic, professional, and structured tone highlighting key takeaways, statistics, and impact.";
    } else if (tone === "casual") {
      toneInstruction = "Write in a friendly, conversational, and warm community-driven tone.";
    }

    const systemPrompt = `You are the chief event journalist for CampusConnect. ${toneInstruction}
Write a 300 to 400-word post-event recap article in GitHub-flavored Markdown summarizing the event based ONLY on the verified data below.
Do NOT invent fake numbers. Embed key poll findings and notable Q&A highlights. Include section headings.`;

    const userPrompt = JSON.stringify({
      eventTitle: event.title,
      clubName: event.clubs?.name || "Campus Club",
      eventDate: event.event_date,
      attendanceCount: effectiveAttendance,
      topQuestionsAsked: qaData?.map((q) => q.question) || [],
      pollHighlights: pollData || [],
      photoTags: photoTags,
    });

    let generatedMarkdown = "";

    if (openAiApiKey) {
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Event Data:\n${userPrompt}` },
          ],
          temperature: 0.7,
        }),
      });

      const aiJson = await aiResponse.json();
      generatedMarkdown = aiJson.choices?.[0]?.message?.content || "";
    }

    // Fallback template if OpenAI key is not configured or in offline dev mode
    if (!generatedMarkdown) {
      generatedMarkdown = `# Event Recap: ${event.title}\n\nWhat an unforgettable gathering hosted by **${event.clubs?.name || "Campus Club"}**! We had an incredible turnout of **${effectiveAttendance} attendees** coming together for an inspiring session.\n\n### 💡 Key Highlights & Discussions\n${
        qaData && qaData.length > 0
          ? qaData.map((q) => `- *${q.question}*`).join("\n")
          : "- Lively discussions and student interactions throughout the venue."
      }\n\n### 📊 Live Community Insights\n${
        pollData && pollData.length > 0
          ? pollData.map((p) => `- **${p.question}**: ${p.total_votes} votes recorded`).join("\n")
          : "- Outstanding active participation across our interactive campus activities."
      }\n\nThank you to everyone who joined us! Stay tuned for our upcoming club events.`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        recapMarkdown: generatedMarkdown,
        heroPhotos: topPhotos,
        attendanceCount: effectiveAttendance,
        clubId: event.club_id,
        eventTitle: event.title,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
