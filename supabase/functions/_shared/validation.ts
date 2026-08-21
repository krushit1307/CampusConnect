// Shared Zod validation helpers for Supabase Edge Functions (issue #2089).
//
// Every edge function that accepts a JSON request body should route it
// through `parseJsonBody(schema, req)` instead of manually reading and
// trusting `await req.json()`. This gives us strict runtime validation
// (including rejecting extra/unknown keys) and a consistent 400 error
// shape that reports exactly which field failed.

import { z } from "https://esm.sh/zod@3.24.2";

/** CORS headers shared by every function that uses these helpers. */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

/** JSON response envelope used for validation failures. */
function validationErrorResponse(fieldErrors: Record<string, string[]>): Response {
  return new Response(
    JSON.stringify({
      error: "Invalid request body",
      fields: fieldErrors,
    }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

/**
 * Read and strictly validate the JSON request body against a Zod schema.
 *
 * Returns `{ ok: true, data }` on success, or a ready-to-send `Response`
 * on failure. Always `z.object(...).strict()` — extra keys are rejected so
 * callers can't silently pass unexpected payloads (mass-assignment guard).
 *
 * Malformed JSON (empty body, unparseable text) is caught and mapped to a
 * clean 400 instead of crashing the function.
 */
export async function parseJsonBody<T extends z.ZodType>(
  schema: T,
  req: Request,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Invalid JSON body", fields: {} }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const flattened = result.error.flatten();
    const fieldErrors: Record<string, string[]> = {};
    if (flattened.formErrors.length > 0) {
      fieldErrors._ = flattened.formErrors;
    }
    for (const [field, issues] of Object.entries(flattened.fieldErrors)) {
      const typed = issues as string[] | undefined;
      if (typed && typed.length > 0) fieldErrors[field] = typed;
    }
    return { ok: false, response: validationErrorResponse(fieldErrors) };
  }

  return { ok: true, data: result.data };
}
