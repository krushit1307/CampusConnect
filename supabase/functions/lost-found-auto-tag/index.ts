// supabase/functions/lost-found-auto-tag/index.ts
//
// Edge Function: Lost & Found Image Auto-Tagger (Issue #2912)
//
// Receives a base64-encoded image, sends it to the OpenAI GPT-4o
// Vision API, and returns a JSON array of descriptive tags
// (e.g., ["water bottle", "blue", "stickers", "HydroFlask"]).
//
// PII detection: the prompt instructs the model to return
// `has_pii: true` and `pii_reason` if the image contains
// Personally Identifiable Information (visible ID cards, credit
// card numbers, passports, etc.). When PII is detected, the
// frontend MUST reject the upload and warn the user to blur
// sensitive data.
//
// Cost optimisation: the frontend compresses the image to a
// WebP thumbnail (max 512x512, quality 0.7) before sending it
// to this function, keeping the OpenAI token cost low.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TagRequest {
  imageBase64: string;
  mimeType: string; // e.g. "image/webp" | "image/jpeg"
}

interface VisionApiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface TagResult {
  tags: string[];
  hasPii: boolean;
  piiReason?: string;
}

const PII_PROMPT = `You are an image-tagging assistant for a university Lost & Found system.
Analyse the attached image of a found item (e.g., a water bottle, keychain, wallet, notebook, jacket, electronics).

Your response MUST be a single JSON object (no markdown, no prose) with the following shape:
{
    "tags": ["<object_type>", "<colour>", "<brand_if_visible>", "<distinguishing_feature>"],
    "has_pii": boolean,
    "pii_reason": "<short reason if has_pii is true, else null>"
}

Rules for tags:
- Generate between 3 and 8 descriptive tags.
- Use lowercase for all tags.
- Include the object type (e.g., "water bottle", "backpack", "laptop").
- Include the dominant colour(s) (e.g., "blue", "black").
- Include the brand ONLY if it is clearly visible and legible (e.g., "hydroflask", "apple", "nike"). Do NOT guess brands.
- Include 1-2 distinguishing features (e.g., "stickers", "keychain", "cracked screen", "embroidered logo").
- Do NOT include personal names, addresses, or phone numbers even if visible.

Rules for PII detection:
- Set "has_pii" to true if the image contains ANY of the following:
  * A government-issued ID card (driver's license, passport, student ID with photo+name).
  * A credit card, debit card, or bank card with visible card number.
  * A handwritten or printed note containing a personal name + phone number/email/address.
  * A phone screen showing messages, emails, or notifications with personal content.
- Set "pii_reason" to a short string explaining what PII was detected.
- If no PII, set "has_pii" to false and "pii_reason" to null.

Return ONLY the JSON object. Do not wrap it in markdown fences.`;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    console.error("[lost-found-auto-tag] OPENAI_API_KEY not set");
    return new Response(JSON.stringify({ error: "Server misconfiguration: missing API key" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let body: TagRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!body.imageBase64 || !body.mimeType) {
    return new Response(JSON.stringify({ error: "Missing imageBase64 or mimeType" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Enforce a size cap to protect the API budget ─────────────
  // The frontend pre-compresses to ~512x512 WebP, but a malicious
  // caller could send a huge base64 string. Reject anything over
  // 2 MB (base64 inflates by ~33%, so this is ~1.5 MB of binary).
  if (body.imageBase64.length > 2_000_000) {
    return new Response(
      JSON.stringify({ error: "Image too large. Maximum 2MB after compression." }),
      { status: 413, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // ── Call OpenAI GPT-4o Vision ────────────────────────────────
  const dataUrl = `data:${body.mimeType};base64,${body.imageBase64}`;

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PII_PROMPT },
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "low" },
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.2,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("[lost-found-auto-tag] OpenAI error:", openaiResponse.status, errText);
      return new Response(
        JSON.stringify({
          error: "Image recognition failed",
          detail: `OpenAI returned ${openaiResponse.status}`,
        }),
        {
          status: 502,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      );
    }

    const visionData: VisionApiResponse = await openaiResponse.json();
    const content = visionData.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ error: "Vision API returned empty response" }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ── Parse the JSON content (strip markdown fences if present) ──
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: TagResult;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[lost-found-auto-tag] Failed to parse vision response:", cleaned);
      return new Response(
        JSON.stringify({
          error: "Vision API returned malformed JSON",
          raw: cleaned.slice(0, 500),
        }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // ── Validate + sanitise tags ──────────────────────────────
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .filter((t) => typeof t === "string" && t.trim().length > 0)
          .map((t) => t.trim().toLowerCase().slice(0, 50))
          .slice(0, 10)
      : [];

    const hasPii = Boolean(parsed.has_pii);
    const piiReason = hasPii
      ? String(parsed.pii_reason ?? "Sensitive information detected in image.")
      : undefined;

    const result: TagResult = {
      tags,
      hasPii,
      piiReason,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[lost-found-auto-tag] Network error:", err);
    return new Response(JSON.stringify({ error: "Network error", detail: String(err) }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
