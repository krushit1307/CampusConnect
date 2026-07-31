import { corsHeaders } from "./headers.ts";

export const STATIC_CACHE_HEADERS = {
  ...corsHeaders,
  "Content-Type": "application/json",
  Vary: "Accept-Encoding",
  "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
};

export function createCachedResponse(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...STATIC_CACHE_HEADERS,
      ...(init?.headers || {}),
    },
  });
}
