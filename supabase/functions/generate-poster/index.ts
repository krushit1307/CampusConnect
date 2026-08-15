import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import satori from "https://esm.sh/satori@0.10.14";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import { rateLimiter } from "../shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let wasmInitialised = false;

async function ensureWasm() {
  if (wasmInitialised) return;
  const wasmUrl = "https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
  const wasmBuffer = await fetch(wasmUrl).then((r) => r.arrayBuffer());
  await initWasm(wasmBuffer);
  wasmInitialised = true;
}

let interFontData: ArrayBuffer | null = null;
let jaFontData: ArrayBuffer | null = null;
let arFontData: ArrayBuffer | null = null;
let zhFontData: ArrayBuffer | null = null;
let koFontData: ArrayBuffer | null = null;

async function loadFontForLanguage(lang: string): Promise<{ data: ArrayBuffer; name: string }> {
  const l = lang.toLowerCase();
  try {
    if (l.startsWith("ja")) {
      if (!jaFontData) {
        const resp = await fetch("https://fastly.jsdelivr.net/npm/@canvas-fonts/noto-sans-jp@1.0.4/NotoSansJP-Bold.ttf");
        jaFontData = await resp.arrayBuffer();
      }
      return { data: jaFontData, name: "Noto Sans JP" };
    } else if (l.startsWith("ar")) {
      if (!arFontData) {
        const resp = await fetch("https://fastly.jsdelivr.net/npm/@canvas-fonts/noto-kufi-arabic@1.0.1/NotoKufiArabic-Bold.ttf");
        arFontData = await resp.arrayBuffer();
      }
      return { data: arFontData, name: "Noto Kufi Arabic" };
    } else if (l.startsWith("zh")) {
      if (!zhFontData) {
        const resp = await fetch("https://fastly.jsdelivr.net/npm/@canvas-fonts/noto-sans-sc@1.0.3/NotoSansSC-Bold.ttf");
        zhFontData = await resp.arrayBuffer();
      }
      return { data: zhFontData, name: "Noto Sans SC" };
    } else if (l.startsWith("ko")) {
      if (!koFontData) {
        const resp = await fetch("https://fastly.jsdelivr.net/npm/@canvas-fonts/noto-sans-kr@1.0.4/NotoSansKR-Bold.ttf");
        koFontData = await resp.arrayBuffer();
      }
      return { data: koFontData, name: "Noto Sans KR" };
    }
  } catch (err) {
    console.error(`[generate-poster] Failed to load localized font for lang ${lang}, falling back to Inter:`, err);
  }

  // Default fallback
  if (!interFontData) {
    const resp = await fetch("https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYAZ9hiA.woff2");
    interFontData = await resp.arrayBuffer();
  }
  return { data: interFontData, name: "Inter" };
}

interface EventRow {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
  banner_url: string | null;
  clubs?: {
    name: string;
    logo_url: string | null;
  } | null;
}

async function fetchEvent(eventId: string): Promise<EventRow | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await client
    .from("events")
    .select("id, title, event_date, location, banner_url, clubs(name, logo_url)")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !data) return null;
  return data as EventRow;
}

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

function buildTemplate(
  title: string,
  dateStr: string,
  venueStr: string,
  bannerUrl: string | null,
  clubName: string | null,
  clubLogo: string | null,
  fontFamily: string
) {
  const hasBanner = !!bannerUrl;
  return {
    type: "div",
    props: {
      style: {
        width: 1080,
        height: 1080,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        fontFamily: fontFamily,
        overflow: "hidden",
        backgroundColor: "#fde047",
        border: "12px solid #000000",
        padding: "60px",
        boxSizing: "border-box",
        justifyContent: "space-between",
      },
      children: [
        hasBanner && {
          type: "img",
          props: {
            src: bannerUrl!,
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              width: 1080,
              height: 1080,
              objectFit: "cover",
              opacity: 0.15,
            },
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "space-between",
              zIndex: 10,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          backgroundColor: "#000000",
                          color: "#ffffff",
                          fontSize: 24,
                          fontWeight: 900,
                          padding: "8px 16px",
                          border: "4px solid #000000",
                          textTransform: "uppercase",
                        },
                        children: "CAMPUS CONNECT",
                      },
                    },
                    clubName && {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          backgroundColor: "#ffffff",
                          padding: "8px 16px",
                          border: "4px solid #000000",
                        },
                        children: [
                          clubLogo && {
                            type: "img",
                            props: {
                              src: clubLogo,
                              style: {
                                width: 32,
                                height: 32,
                                border: "2px solid #000000",
                              },
                            },
                          },
                          {
                            type: "span",
                            props: {
                              style: {
                                fontSize: 18,
                                fontWeight: 700,
                                color: "#000000",
                              },
                              children: clubName,
                            },
                          },
                        ].filter(Boolean),
                      },
                    },
                  ].filter(Boolean),
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    backgroundColor: "#ffffff",
                    border: "8px solid #000000",
                    padding: "40px",
                    boxShadow: "12px 12px 0px 0px #000000",
                    margin: "40px 0",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: title.length > 50 ? 44 : title.length > 25 ? 54 : 64,
                          fontWeight: 900,
                          color: "#000000",
                          lineHeight: 1.2,
                          wordBreak: "break-word",
                          flexWrap: "wrap",
                        },
                        children: title,
                      },
                    },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  },
                  children: [
                    dateStr && {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          backgroundColor: "#a3e635",
                          padding: "16px 24px",
                          border: "4px solid #000000",
                          fontSize: 24,
                          fontWeight: 700,
                          color: "#000000",
                        },
                        children: [
                          { type: "span", props: { children: "🗓" } },
                          { type: "span", props: { children: dateStr } },
                        ],
                      },
                    },
                    venueStr && {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          backgroundColor: "#38bdf8",
                          padding: "16px 24px",
                          border: "4px solid #000000",
                          fontSize: 24,
                          fontWeight: 700,
                          color: "#000000",
                        },
                        children: [
                          { type: "span", props: { children: "📍" } },
                          { type: "span", props: { children: venueStr } },
                        ],
                      },
                    },
                  ].filter(Boolean),
                },
              },
            ],
          },
        },
      ],
    },
  } as unknown as React.ReactElement;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use GET." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limited = await rateLimiter(req, "generate-poster", 30, 60);
  if (limited) return limited;

  const url = new URL(req.url);
  const eventId = url.searchParams.get("event_id");
  const lang = url.searchParams.get("lang") || "en";

  if (
    !eventId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)
  ) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid event_id. Must be a valid UUID." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let event: EventRow | null;
  try {
    event = await fetchEvent(eventId);
  } catch (err) {
    console.error("[generate-poster] DB fetch error:", err);
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

  let title = event.title;
  let dateStr = formatEventDate(event.event_date);
  let venueStr = event.location || "";

  // Dynamic Translation
  if (lang && lang.toLowerCase() !== "en") {
    const deepLKey = Deno.env.get("DEEPL_API_KEY");
    if (deepLKey) {
      try {
        const deepLEndpoint = Deno.env.get("DEEPL_API_URL") ?? "https://api-free.deepl.com/v2/translate";
        const response = await fetch(deepLEndpoint, {
          method: "POST",
          headers: {
            "Authorization": `DeepL-Auth-Key ${deepLKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: [title, dateStr, venueStr],
            target_lang: lang.toUpperCase(),
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          const translations = resJson?.translations;
          if (translations && translations.length === 3) {
            title = translations[0].text;
            dateStr = translations[1].text;
            venueStr = translations[2].text;
          }
        }
      } catch (err) {
        console.error("[generate-poster] DeepL translation failed:", err);
      }
    }
  }

  try {
    const [_, font] = await Promise.all([ensureWasm(), loadFontForLanguage(lang)]);

    const svg = await satori(
      buildTemplate(
        title,
        dateStr,
        venueStr,
        event.banner_url,
        event.clubs?.name ?? null,
        event.clubs?.logo_url ?? null,
        font.name
      ),
      {
        width: 1080,
        height: 1080,
        fonts: [
          {
            name: font.name,
            data: font.data,
            weight: 700,
            style: "normal",
          },
        ],
      }
    );

    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1080 },
    });
    const pngBuffer = resvg.render().asPng();

    return new Response(pngBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Event-Id": eventId,
        "X-Lang": lang,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[generate-poster] Render error:", err);
    return new Response(JSON.stringify({ error: "Failed to render localized event poster." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
