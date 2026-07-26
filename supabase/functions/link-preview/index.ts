import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .trim();
}

function extractMetadata(html: string): { title?: string; description?: string; image?: string } {
  const metadata: { title?: string; description?: string; image?: string } = {};

  // Extract og:title, og:description, og:image
  const metaRegex = /<meta\s+[^>]*\b(?:property|name)\s*=\s*["']og:(title|description|image)["'][^>]*>/gi;

  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const metaTag = match[0];
    const property = match[1].toLowerCase();

    const contentMatch = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(metaTag);
    if (contentMatch) {
      const val = contentMatch[1];
      if (property === "title") metadata.title = decodeHtmlEntities(val);
      else if (property === "description") metadata.description = decodeHtmlEntities(val);
      else if (property === "image") metadata.image = val.trim();
    }
  }

  // Fallbacks if standard og tags are not present
  if (!metadata.title) {
    const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
    if (titleMatch) {
      metadata.title = decodeHtmlEntities(titleMatch[1]);
    }
  }

  if (!metadata.description) {
    const descRegex = /<meta\s+[^>]*\b(?:name|property)\s*=\s*["']description["'][^>]*>/gi;
    const matchDesc = descRegex.exec(html);
    if (matchDesc) {
      const contentMatch = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(matchDesc[0]);
      if (contentMatch) {
        metadata.description = decodeHtmlEntities(contentMatch[1]);
      }
    }
  }

  return metadata;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let url;
    try {
      const body = await req.json();
      url = body.url;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!url) {
      return new Response(JSON.stringify({ error: "Missing 'url' parameter in request body." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new Error("Invalid protocol");
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL format or unsupported protocol." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Protection using AbortController with an 8-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let html = "";
    try {
      const response = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
        },
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch webpage. HTTP status: ${response.status}` }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      html = await response.text();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return new Response(JSON.stringify({ error: "Request timed out fetching the URL." }), {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Network error: ${error.message}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Extract metadata
    const metadata = extractMetadata(html);

    if (!metadata.title && !metadata.description && !metadata.image) {
      return new Response(JSON.stringify({ error: "No OpenGraph or title metadata found on the target page." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: parsedUrl.toString(), ...metadata }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: `Internal server error: ${error.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
