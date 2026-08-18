import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_CATEGORIES = [
  "Tech",
  "Cultural",
  "Sports",
  "Workshop",
  "Seminar",
  "Career",
  "Community",
];

interface EventRecord {
  id?: string;
  title?: string | null;
  description?: string | null;
  club_id?: string | null;
  category_id?: string | null;
  tags?: string[] | null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getFallbackCategory(clubCategory: string | null | undefined): string {
  const value = (clubCategory || "").toLowerCase();

  if (value.includes("sport") || value.includes("fitness")) return "Sports";
  if (
    value.includes("tech") ||
    value.includes("computer") ||
    value.includes("engineering") ||
    value.includes("science")
  ) {
    return "Tech";
  }
  if (value.includes("career") || value.includes("placement")) return "Career";
  if (
    value.includes("culture") ||
    value.includes("music") ||
    value.includes("dance") ||
    value.includes("arts")
  ) {
    return "Cultural";
  }
  if (value.includes("workshop") || value.includes("training")) return "Workshop";
  if (value.includes("academic") || value.includes("education")) return "Seminar";
  if (value.includes("social") || value.includes("community")) return "Community";

  return "Community";
}

async function getClubFallbackCategory(
  supabase: ReturnType<typeof createClient>,
  clubId: string | null | undefined,
): Promise<string> {
  if (!clubId) return "Community";

  const { data } = await supabase
    .from("clubs")
    .select("category")
    .eq("id", clubId)
    .maybeSingle();

  return getFallbackCategory(data?.category);
}

async function classifyEvent(
  title: string,
  description: string,
  fallbackCategory: string,
) {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!openaiApiKey) {
    return {
      categories: [fallbackCategory],
      usedFallback: true,
    };
  }

  const prompt = `
You classify campus events.

You MUST choose between 1 and 3 categories from this exact list:

${VALID_CATEGORIES.join(", ")}

Event title:
${title || "(missing)"}

Event description:
${description || "(missing)"}

Rules:
- Return only valid categories from the list.
- Choose the categories that best describe the event.
- Do not invent categories.
- Do not return more than 3 categories.
- If the event text is too short or ambiguous, return exactly this fallback category: ${fallbackCategory}.

Return JSON only:
{"categories":["Tech","Workshop"]}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a strict event classification system. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0,
      max_tokens: 100,
      response_format: {
        type: "json_object",
      },
    }),
  });

  if (!response.ok) {
    console.error(
      "[smart-auto-categorize] OpenAI error:",
      response.status,
      await response.text(),
    );

    return {
      categories: [fallbackCategory],
      usedFallback: true,
    };
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;

  try {
    const parsed = JSON.parse(content || "{}");

    const categories = Array.isArray(parsed.categories)
      ? parsed.categories.filter(
          (category: unknown): category is string =>
            typeof category === "string" &&
            VALID_CATEGORIES.includes(category),
        )
      : [];

    if (categories.length === 0) {
      return {
        categories: [fallbackCategory],
        usedFallback: true,
      };
    }

    return {
      categories: [...new Set(categories)].slice(0, 3),
      usedFallback: false,
    };
  } catch {
    return {
      categories: [fallbackCategory],
      usedFallback: true,
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();

    const record: EventRecord = body?.record || body;
    const suggestOnly = body?.suggest_only === true;

    const webhookSecret = Deno.env.get("EVENT_CATEGORIZER_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret");

    if (!suggestOnly && webhookSecret && providedSecret !== webhookSecret) {
      return jsonResponse({ error: "Unauthorized webhook request" }, 401);
    }

    const title = String(record?.title || "").trim();
    const description = String(record?.description || "").trim();
    const clubId = record?.club_id || null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const fallbackCategory = await getClubFallbackCategory(supabase, clubId);

    const isSparseText =
      title.length < 5 && description.length < 20;

    const classification = isSparseText
      ? {
          categories: [fallbackCategory],
          usedFallback: true,
        }
      : await classifyEvent(title, description, fallbackCategory);

    const { data: categoryRows, error: categoryError } = await supabase
      .from("event_categories")
      .select("id, name")
      .in("name", classification.categories);

    if (categoryError) {
      throw categoryError;
    }

    const categories = classification.categories
      .map((name) => categoryRows?.find((row) => row.name === name))
      .filter(Boolean)
      .slice(0, 3);

    if (suggestOnly) {
      return jsonResponse({
        categories,
        usedFallback: classification.usedFallback,
      });
    }

    if (!record?.id) {
      return jsonResponse({ error: "Missing event id" }, 400);
    }

    const existingTags = Array.isArray(record.tags) ? record.tags : [];

    const generatedTags = categories.map((category) => category!.name);

    const mergedTags = [
      ...new Set([...existingTags, ...generatedTags]),
    ].slice(0, 10);

    const updatePayload: Record<string, unknown> = {
      tags: mergedTags,
    };

    // Never overwrite an organizer's manually selected category.
    if (!record.category_id && categories[0]?.id) {
      updatePayload.category_id = categories[0].id;
    }

    const { error: updateError } = await supabase
      .from("events")
      .update(updatePayload)
      .eq("id", record.id);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({
      success: true,
      eventId: record.id,
      categories,
      usedFallback: classification.usedFallback,
    });
  } catch (error) {
    console.error("[smart-auto-categorize]", error);

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});