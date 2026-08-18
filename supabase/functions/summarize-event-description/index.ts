import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const MAX_SUMMARY_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 12_000;
const FALLBACK_SUFFIX = "…";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_~`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DESCRIPTION_LENGTH);
}

export function fallbackSummary(description: string): string {
  const plainText = stripMarkdown(description);
  if (plainText.length <= MAX_SUMMARY_LENGTH) return plainText;
  return `${plainText.slice(0, MAX_SUMMARY_LENGTH - FALLBACK_SUFFIX.length).trimEnd()}${FALLBACK_SUFFIX}`;
}

function normalizeSummary(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const singleLine = value.replace(/\s+/g, " ").trim();
  if (!singleLine || singleLine.length > MAX_SUMMARY_LENGTH) return null;
  return singleLine.replace(/^['"“”]+|['"“”]+$/g, "").trim() || null;
}

async function generateSummary(
  description: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 60,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Summarize a college event description into exactly one punchy sentence under 100 characters. Focus only on explicit value propositions such as free food, networking, learning, or prizes. Never invent facts, dates, prices, speakers, or benefits. Return JSON with one key: summary.",
        },
        { role: "user", content: stripMarkdown(description) },
      ],
    }),
  });

  if (!response.ok) throw new Error(`OpenAI request failed with status ${response.status}`);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  let parsed: unknown = content;
  if (typeof content === "string") {
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { summary: content };
    }
  }
  const summary = normalizeSummary((parsed as { summary?: unknown })?.summary);
  if (!summary) throw new Error("The model returned an invalid summary");
  return summary;
}

serve(async (request) => {
  if (request.method !== "POST") return json({ error: "POST is required" }, 405);

  const expectedSecret = Deno.env.get("EVENT_SUMMARIZER_WEBHOOK_SECRET");
  if (expectedSecret && request.headers.get("x-webhook-secret") !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey)
    return json({ error: "Server configuration is incomplete" }, 500);

  const body = await request.json().catch(() => ({}));
  const eventId = typeof body.event_id === "string" ? body.event_id : "";
  if (!eventId) return json({ error: "event_id is required" }, 400);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, description, tldr_summary, tldr_summary_source")
    .eq("id", eventId)
    .single();

  if (eventError || !event) return json({ error: "Event not found" }, 404);
  if (event.tldr_summary_source === "organizer") {
    return json({ event_id: eventId, status: "preserved_organizer_summary" });
  }

  const description = typeof event.description === "string" ? event.description : "";
  if (!description.trim()) return json({ event_id: eventId, status: "skipped_empty_description" });

  const fallback = fallbackSummary(description);
  let summary = fallback;
  let source: "ai" | "fallback" = "fallback";
  let errorMessage: string | null = null;

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (apiKey) {
    try {
      summary = await generateSummary(
        description,
        apiKey,
        Deno.env.get("EVENT_SUMMARIZER_MODEL") || "gpt-4o-mini",
      );
      source = "ai";
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Unknown summarizer error";
      console.error("[summarize-event-description] fallback", errorMessage);
    }
  } else {
    errorMessage = "OPENAI_API_KEY is not configured";
  }

  const { data: updated, error: updateError } = await supabase
    .from("events")
    .update({
      tldr_summary: summary,
      tldr_summary_source: source,
      tldr_summary_generated_at: new Date().toISOString(),
      tldr_summary_error: errorMessage,
    })
    .eq("id", eventId)
    .eq("tldr_summary_source", "none")
    .select("id, tldr_summary, tldr_summary_source")
    .maybeSingle();

  if (updateError) return json({ error: updateError.message }, 500);
  if (!updated) return json({ event_id: eventId, status: "summary_changed_while_generating" });
  return json({ event_id: eventId, status: source, tldr_summary: summary });
});
