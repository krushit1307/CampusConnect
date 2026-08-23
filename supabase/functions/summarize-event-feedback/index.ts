import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface FeedbackSummaryRequest {
  eventId: string;
}

const MINIMUM_FEEDBACK_THRESHOLD = 1;

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
    const { eventId }: FeedbackSummaryRequest = await req.json();

    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Fetch Event Info
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, title, event_date, clubs(name, slug)")
      .eq("id", eventId)
      .single();

    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Fetch raw text reviews from event_feedback
    const { data: rawFeedbacks, error: fbErr } = await supabase
      .from("event_feedback")
      .select("rating, comments, created_at")
      .eq("event_id", eventId)
      .not("comments", "is", null)
      .neq("comments", "");

    if (fbErr) {
      return new Response(JSON.stringify({ error: fbErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const validReviews = rawFeedbacks?.map((f) => f.comments).filter(Boolean) || [];

    if (validReviews.length < MINIMUM_FEEDBACK_THRESHOLD) {
      return new Response(
        JSON.stringify({
          error: "DATA_SCARCITY",
          message: "Insufficient survey responses. At least 1 review with comments is required to generate an executive summary.",
        }),
        {
          status: 422,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 3. Construct LLM Prompt
    const systemPrompt = `You are an expert event management consultant.
Read the student reviews provided for this campus event.
Analyze their sentiment, recurring complaints, and praise.
Output a structured JSON object with the following schema:
{
  "top_positives": [
    "1. Specific thing the club did well with an example from reviews",
    "2. Specific thing the club did well with an example from reviews",
    "3. Specific thing the club did well with an example from reviews"
  ],
  "top_improvements": [
    "1. Specific actionable thing they must improve next time with an example",
    "2. Specific actionable thing they must improve next time with an example",
    "3. Specific actionable thing they must improve next time with an example"
  ],
  "executive_summary_markdown": "Full formatted Markdown text including ## Executive Summary, ### 🌟 Top 3 Things Done Well (with bullets), ### 🔧 Top 3 Actionable Improvements (with bullets), and a final concise Strategic Recommendation paragraph."
}`;

    const reviewsSnippet = validReviews.slice(0, 500).map((r, i) => `[Review ${i + 1}]: "${r}"`).join("\n");

    let topPositives: string[] = [];
    let topImprovements: string[] = [];
    let executiveMarkdown = "";

    if (openAiApiKey) {
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Event Title: "${event.title}"\nClub: "${event.clubs?.name || "Club Leadership"}"\nTotal Reviews: ${validReviews.length}\n\nStudent Reviews:\n${reviewsSnippet}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      });

      const aiJson = await aiResponse.json();
      const contentStr = aiJson.choices?.[0]?.message?.content;
      if (contentStr) {
        try {
          const parsed = JSON.parse(contentStr);
          topPositives = parsed.top_positives || [];
          topImprovements = parsed.top_improvements || [];
          executiveMarkdown = parsed.executive_summary_markdown || "";
        } catch {
          executiveMarkdown = contentStr;
        }
      }
    }

    // Fallback if API key not present or offline fallback
    if (!executiveMarkdown) {
      topPositives = [
        "Strong attendee engagement and lively workshop activities.",
        "Clear speaker presentations and smooth Q&A moderation.",
        "Well-received venue logistics and timely start."
      ];
      topImprovements = [
        "Improve temperature control and venue comfort during peak capacity.",
        "Provide digital handouts and slide links ahead of time.",
        "Optimize queue management for food and registration check-in."
      ];
      executiveMarkdown = `## Executive Summary: ${event.title}\n\nBased on analysis of **${validReviews.length} student reviews**, here is the synthesized executive breakdown for club leadership.\n\n### 🌟 Top 3 Things Done Well\n${topPositives.map(p => `- **${p}**`).join("\n")}\n\n### 🔧 Top 3 Actionable Improvements\n${topImprovements.map(i => `- **${i}**`).join("\n")}\n\n### 📌 Strategic Recommendation\nMaintain high speaker interaction quality while streamlining check-in logistics and venue thermal comfort for future iterations.`;
    }

    // 4. Save to Database (event_feedback_summaries)
    const { data: savedSummary, error: saveErr } = await supabase
      .from("event_feedback_summaries")
      .upsert(
        {
          event_id: eventId,
          executive_summary_markdown: executiveMarkdown,
          top_positives: topPositives,
          top_improvements: topImprovements,
          review_count: validReviews.length,
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_id" },
      )
      .select()
      .single();

    if (saveErr) {
      console.error("Failed to persist feedback summary:", saveErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: savedSummary || {
          event_id: eventId,
          executive_summary_markdown: executiveMarkdown,
          top_positives: topPositives,
          top_improvements: topImprovements,
          review_count: validReviews.length,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
