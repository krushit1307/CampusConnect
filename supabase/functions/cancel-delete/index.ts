// Cancels a pending "delayed delete" started by delete-post (#2270).
//
// If the caller's token still matches the pending Redis key, we remove
// the key (so the background job in delete-post backs off) and restore
// the post by clearing deleted_at.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { parseJsonBody, corsHeaders } from "../_shared/validation.ts";
import { redis } from "../_shared/redis.ts";

const cancelDeleteSchema = z
  .object({
    postId: z.string().uuid("postId must be a valid UUID"),
    deletionToken: z.string().min(1),
  })
  .strict();

function pendingDeleteKey(postId: string): string {
  return `pending_delete_post_${postId}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

  const parsed = await parseJsonBody(cancelDeleteSchema, req);
  if (!parsed.ok) return parsed.response;
  const { postId, deletionToken } = parsed.data;

  const key = pendingDeleteKey(postId);
  const pendingToken = await redis.get<string>(key);

  // Token missing or mismatched: the 10-second window already closed
  // (or this token was already used), so there's nothing left to undo.
  if (!pendingToken || pendingToken !== deletionToken) {
    return new Response(JSON.stringify({ error: "Undo window has expired" }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await redis.del(key);

  const { error } = await supabase
    .from("posts")
    .update({ deleted_at: null })
    .eq("id", postId)
    .eq("author_id", user.id);

  if (error) {
    return new Response(JSON.stringify({ error: "Failed to restore post" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ postId, restored: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
