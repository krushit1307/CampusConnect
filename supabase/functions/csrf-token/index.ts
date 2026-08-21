import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { generateCsrfToken, buildCsrfCookie } from "../_shared/csrf.ts";

import { corsHeaders } from "../_shared/validation.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  const token = generateCsrfToken();

  return new Response(
    JSON.stringify({
      token,
    }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Set-Cookie": buildCsrfCookie(token),
      },
    },
  );
});
