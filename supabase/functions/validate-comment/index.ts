/**
 * Edge Function: validate-comment
 * Purpose: Intercept and validate comment content for profanity before database insertion.
 * Uses word-boundary regex to prevent the "Scunthorpe Problem" (false positives).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { rateLimiter } from "../shared/rateLimiter.ts";

// Comprehensive list of severe profanity (abbreviated for safety, expand as needed)
// Using word boundaries \b to prevent matching substrings like "assassin" or "classic"
const PROFANITY_PATTERNS = [
  /\b(fuck|fucking|fucked)\b/gi,
  /\b(shit|shitty)\b/gi,
  /\b(bitch|bitches)\b/gi,
  /\b(asshole|assholes)\b/gi,
  /\b(cunt|cunts)\b/gi,
  /\b(dick|dicks)\b/gi,
  /\b(pussy|pussies)\b/gi,
  /\b(nigger|niggers)\b/gi,
  /\b(faggot|faggots)\b/gi,
];

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ValidateRequest {
  content: string;
  userId: string;
  postId?: string;
}

serve(async (req) => {
  // Rate limit: 20 requests/minute (content moderation)
  const limited = await rateLimiter(req, "validate-comment", 20, 60);
  if (limited) return limited;

  try {
    // 1. Parse and validate request body
    const { content, userId, postId }: ValidateRequest = await req.json();

    if (!content || typeof content !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid request: 'content' is required and must be a string." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid request: 'userId' is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Check for profanity using word-boundary regex
    const containsProfanity = PROFANITY_PATTERNS.some((pattern) => pattern.test(content));

    if (containsProfanity) {
      // 3. Log the violation to the moderation_flags table
      const { error: logError } = await supabase.from("moderation_flags").insert({
        user_id: userId,
        violation_type: "profanity",
        flagged_content: content.substring(0, 500), // Truncate for safety
      });

      if (logError) {
        console.error("Failed to log moderation flag:", logError);
      }

      // 4. Reject the comment with a 400 Bad Request
      return new Response(
        JSON.stringify({
          error: "Your comment violates our community guidelines.",
          blocked: true,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 5. Comment is clean, return success
    return new Response(JSON.stringify({ valid: true, message: "Comment passed validation." }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Validation function error:", error);
    return new Response(JSON.stringify({ error: "Internal server error during validation." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
