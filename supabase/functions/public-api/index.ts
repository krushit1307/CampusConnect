import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { rateLimiter } from "../shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html" },
  });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Strict rate-limiting: 60 requests/minute per IP
  const limited = await rateLimiter(req, "public-api", 60, 60);
  if (limited) return limited;

  const url = new URL(req.url);
  const path = url.pathname;

  // Serve OpenAPI JSON schema
  if (path.endsWith("/openapi.json")) {
    const origin = url.origin;
    const spec = {
      openapi: "3.0.3",
      info: {
        title: "Campus Connect Public REST API",
        description: "Public developer API playground for Campus Connect. Build widgets, schedules, and custom apps legally and safely.",
        version: "1.0.0"
      },
      servers: [
        {
          url: `${origin}/functions/v1/public-api`,
          description: "Gateway URL"
        }
      ],
      paths: {
        "/v1/public/events/upcoming": {
          "get": {
            "summary": "Retrieve upcoming public events",
            "description": "Get all scheduled events hosted by public clubs starting from the current time. Excludes PII and private club data.",
            "responses": {
              "200": {
                "description": "Success",
                "content": {
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/Event"
                      }
                    }
                  }
                }
              },
              "429": {
                "description": "Too Many Requests (Rate limit exceeded: 60 requests/min per IP)"
              }
            }
          }
        }
      },
      components: {
        schemas: {
          Event: {
            "type": "object",
            "properties": {
              "id": { "type": "string", "format": "uuid" },
              "title": { "type": "string" },
              "description": { "type": "string" },
              "start_date": { "type": "string", "format": "date-time" },
              "end_date": { "type": "string", "format": "date-time" },
              "location": { "type": "string" },
              "banner_url": { "type": "string", "nullable": true },
              "clubs": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "slug": { "type": "string" }
                }
              }
            }
          }
        }
      }
    };
    return json(spec);
  }

  // Serve Swagger UI HTML
  if (path === "/functions/v1/public-api" || path === "/functions/v1/public-api/" || path.endsWith("/docs")) {
    const origin = url.origin;
    const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Campus Connect API Playground</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5/favicon-32x32.png" sizes="32x32" />
  <style>
    html { box-sizing: border-box; overflow: -y-scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '${origin}/functions/v1/public-api/openapi.json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.standalonePreset
        ],
        layout: "BaseLayout",
        deepLinking: true,
      });
    };
  </script>
</body>
</html>`;
    return html(swaggerHtml);
  }

  // Serve /v1/public/events/upcoming API endpoint
  if (path.endsWith("/v1/public/events/upcoming")) {
    try {
      // @ts-ignore – Deno global
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      // @ts-ignore – Deno global
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("events")
        .select(`
          id,
          title,
          description,
          start_date,
          end_date,
          location,
          banner_url,
          clubs!inner(
            name,
            slug,
            visibility
          )
        `)
        .eq("status", "scheduled")
        .eq("clubs.visibility", "public")
        .gte("start_date", now)
        .order("start_date", { ascending: true });

      if (error) throw error;

      // Clean up public data: remove visibility from output to hide internal configuration
      const cleanedEvents = (data || []).map((e: any) => {
        const { visibility, ...clubRest } = e.clubs;
        return {
          id: e.id,
          title: e.title,
          description: e.description,
          start_date: e.start_date,
          end_date: e.end_date,
          location: e.location,
          banner_url: e.banner_url,
          clubs: clubRest,
        };
      });

      return json(cleanedEvents);
    } catch (err: any) {
      console.error(err);
      return json({ error: err.message || "Failed to retrieve upcoming events" }, 500);
    }
  }

  return json({ error: "Not Found" }, 404);
}

// @ts-ignore – Deno global
if (import.meta.main) {
  serve(handler);
}
