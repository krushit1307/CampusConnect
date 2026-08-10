/**
 * Edge Function: og-image (#1515)
 *
 * Generates a dynamic 1200×630 Open Graph PNG for a campus event using Satori
 * (HTML/CSS → SVG) + resvg-wasm (SVG → PNG). No headless browser required.
 *
 * Usage:
 *   GET /functions/v1/og-image?event_id=<uuid>
 *
 * Returns:
 *   Content-Type: image/png  (1200×630 branded event card)
 *
 * Caching:
 *   Cache-Control: public, max-age=3600, stale-while-revalidate=86400
 *
 * Error responses (JSON):
 *   400 – missing / invalid event_id
 *   404 – event not found in database
 *   500 – render failure
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import satori from "https://esm.sh/satori@0.10.14";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import { corsHeaders } from "../_shared/validation.ts";

// ---------------------------------------------------------------------------
// WASM initialisation — load resvg once per isolate lifecycle
// ---------------------------------------------------------------------------

let wasmInitialised = false;

async function ensureWasm() {
  if (wasmInitialised) return;
  // Fetch precompiled WASM binary from the same esm.sh CDN that hosts the JS
  const wasmUrl =
    "https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
  const wasmBuffer = await fetch(wasmUrl).then((r) => r.arrayBuffer());
  await initWasm(wasmBuffer);
  wasmInitialised = true;
}

// ---------------------------------------------------------------------------
// Font loading — Inter Bold for the title text
// ---------------------------------------------------------------------------

let interFontData: ArrayBuffer | null = null;

async function loadInterFont(): Promise<ArrayBuffer> {
  if (interFontData) return interFontData;
  const resp = await fetch(
    "https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYAZ9hiA.woff2",
  );
  interFontData = await resp.arrayBuffer();
  return interFontData;
}

// ---------------------------------------------------------------------------
// Event data types & DB fetch
// ---------------------------------------------------------------------------

interface EventRow {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
  banner_url: string | null;
  clubs?: { name: string } | null;
}

async function fetchEvent(eventId: string): Promise<EventRow | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await client
    .from("events")
    .select("id, title, event_date, location, banner_url, clubs(name)")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !data) return null;
  return data as EventRow;
}

// ---------------------------------------------------------------------------
// Date formatting helper
// ---------------------------------------------------------------------------

function formatEventDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Truncate helper
// ---------------------------------------------------------------------------

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

// ---------------------------------------------------------------------------
// OG Image template — rendered by Satori as a JSX-like object tree
// ---------------------------------------------------------------------------

function buildTemplate(event: EventRow): React.ReactElement {
  const title = truncate(event.title ?? "Campus Event", 65);
  const dateStr = formatEventDate(event.event_date);
  const location = event.location ? truncate(event.location, 55) : null;
  const clubName = event.clubs?.name ? truncate(event.clubs.name, 40) : null;
  const hasBanner = !!event.banner_url;

  return {
    type: "div",
    props: {
      style: {
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        fontFamily: "Inter",
        overflow: "hidden",
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
      },
      children: [
        // ---- Background banner (blurred / dimmed overlay) ----
        hasBanner && {
          type: "img",
          props: {
            src: event.banner_url!,
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: 1200,
              height: 630,
              objectFit: "cover",
              opacity: 0.15,
            },
          },
        },

        // ---- Dark vignette overlay for readability ----
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(15,23,42,0.3) 0%, rgba(15,23,42,0.7) 60%, rgba(15,23,42,0.95) 100%)",
            },
          },
        },

        // ---- Content layer ----
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "52px 64px",
            },
            children: [
              // Top row: Club tag
              {
                type: "div",
                props: {
                  style: { display: "flex", alignItems: "center", gap: 12 },
                  children: [
                    // CampusConnect brand mark
                    {
                      type: "div",
                      props: {
                        style: {
                          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                          borderRadius: 10,
                          padding: "6px 18px",
                          fontSize: 18,
                          fontWeight: 700,
                          color: "#fff",
                          letterSpacing: "-0.02em",
                        },
                        children: "CampusConnect",
                      },
                    },
                    // Club name pill
                    clubName && {
                      type: "div",
                      props: {
                        style: {
                          background: "rgba(255,255,255,0.12)",
                          borderRadius: 8,
                          padding: "6px 16px",
                          fontSize: 16,
                          fontWeight: 500,
                          color: "rgba(255,255,255,0.75)",
                          border: "1px solid rgba(255,255,255,0.15)",
                        },
                        children: clubName,
                      },
                    },
                  ].filter(Boolean),
                },
              },

              // Middle: Event title
              {
                type: "div",
                props: {
                  style: {
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    paddingTop: 28,
                    paddingBottom: 12,
                  },
                  children: {
                    type: "div",
                    props: {
                      style: {
                        fontSize: title.length > 40 ? 54 : 66,
                        fontWeight: 700,
                        color: "#ffffff",
                        lineHeight: 1.15,
                        letterSpacing: "-0.03em",
                        maxWidth: 980,
                        textShadow: "0 2px 20px rgba(0,0,0,0.5)",
                      },
                      children: title,
                    },
                  },
                },
              },

              // Bottom row: Date + Location
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  },
                  children: [
                    // Divider line
                    {
                      type: "div",
                      props: {
                        style: {
                          width: 60,
                          height: 3,
                          background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                          borderRadius: 2,
                          marginBottom: 8,
                        },
                      },
                    },

                    // Date row
                    dateStr && {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          fontSize: 22,
                          fontWeight: 500,
                          color: "rgba(199, 210, 254, 0.9)",
                        },
                        children: [
                          // Calendar icon (unicode)
                          {
                            type: "span",
                            props: { style: { fontSize: 20 }, children: "🗓" },
                          },
                          dateStr,
                        ],
                      },
                    },

                    // Location row
                    location && {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          fontSize: 20,
                          fontWeight: 400,
                          color: "rgba(199, 210, 254, 0.7)",
                        },
                        children: [
                          {
                            type: "span",
                            props: { style: { fontSize: 18 }, children: "📍" },
                          },
                          location,
                        ],
                      },
                    },
                  ].filter(Boolean),
                },
              },
            ],
          },
        },
      ].filter(Boolean),
    },
  } as unknown as React.ReactElement;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only GET allowed
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use GET." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Parse & validate event_id ---
  const url = new URL(req.url);
  const eventId = url.searchParams.get("event_id");

  if (!eventId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid event_id. Must be a valid UUID." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // --- Fetch event data ---
  let event: EventRow | null;
  try {
    event = await fetchEvent(eventId);
  } catch (err) {
    console.error("[og-image] DB fetch error:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch event data." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!event) {
    return new Response(JSON.stringify({ error: "Event not found." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Render PNG ---
  try {
    await Promise.all([ensureWasm(), loadInterFont()]);

    const svg = await satori(buildTemplate(event), {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Inter",
          data: interFontData!,
          weight: 400,
          style: "normal",
        },
        {
          name: "Inter",
          data: interFontData!,
          weight: 700,
          style: "normal",
        },
      ],
    });

    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
    });
    const pngBuffer = resvg.render().asPng();

    return new Response(pngBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Event-Id": eventId,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[og-image] Render error:", err);
    return new Response(JSON.stringify({ error: "Failed to render OG image." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
