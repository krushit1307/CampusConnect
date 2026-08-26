// Optimistic "delayed delete" for posts (#2270).
//
// 1. Soft-delete the post immediately (deleted_at = now) so it vanishes
//    from every SELECT right away — no confirmation modal needed.
// 2. Store a short-lived Redis key holding a one-time deletion token.
// 3. Schedule the *real* hard DELETE 10 seconds from now via
//    EdgeRuntime.waitUntil, so the response below can return instantly
//    while the hard delete keeps running in the background.
// 4. If /cancel-delete removes the Redis key first (the user clicked
//    "Undo"), the background job sees the key is gone and skips the
//    hard delete.

// @ts-ignore -- provided by the Supabase Edge Runtime, not a Deno type
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { parseJsonBody, corsHeaders } from "../_shared/validation.ts";
import { redis } from "../_shared/redis.ts";
import { rateLimiter } from "../shared/rateLimiter.ts";

const UNDO_WINDOW_SECONDS = 10;

const deletePostSchema = z
  .object({
    postId: z.string().uuid("postId must be a valid UUID"),
  })
  .strict();

function pendingDeleteKey(postId: string): string {
  return `pending_delete_post_${postId}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function finalizeDeleteAfterDelay(
  supabase: ReturnType<typeof createClient>,
  postId: string,
  deletionToken: string,
): Promise<void> {
  await sleep(UNDO_WINDOW_SECONDS * 1000);

  // Only proceed if this exact token is still the pending one — if the
  // key is missing or holds a different token, the delete was cancelled
  // (or superseded), so back off instead of hard-deleting.
  const stillPending = await redis.get<string>(pendingDeleteKey(postId));
  if (stillPending !== deletionToken) return;

  await supabase.from("posts").delete().eq("id", postId);
  await redis.del(pendingDeleteKey(postId));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate limit: 20 requests/minute (content operations)
  const limited = await rateLimiter(req, "delete-post", 20, 60);
  if (limited) return limited;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let user;
  try {
    user = await verifyAuth(req, supabase);
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = await parseJsonBody(deletePostSchema, req);
  if (!parsed.ok) return parsed.response;
  const { postId } = parsed.data;

  // Soft-delete now — this is what makes the post disappear instantly.
  const { data: post, error } = await supabase
    .from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("author_id", user.id)
    .select("id")
    .single();

  if (error || !post) {
    return new Response(JSON.stringify({ error: "Post not found or not owned by you" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const deletionToken = crypto.randomUUID();
  await redis.set(pendingDeleteKey(postId), deletionToken, { ex: UNDO_WINDOW_SECONDS });

  // Runs after the response below is sent; keeps going even though this
  // request has already finished.
  EdgeRuntime.waitUntil(finalizeDeleteAfterDelay(supabase, postId, deletionToken));

  return new Response(
    JSON.stringify({ postId, deletionToken, undoWindowSeconds: UNDO_WINDOW_SECONDS }),
    {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
