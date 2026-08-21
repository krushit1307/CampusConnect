import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import satori from "https://esm.sh/satori@0.10.14";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

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

async function loadInterFont(): Promise<ArrayBuffer> {
  if (interFontData) return interFontData;
  const resp = await fetch(
    "https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYAZ9hiA.woff2",
  );
  interFontData = await resp.arrayBuffer();
  return interFontData;
}

async function fetchUserRecap(userId: string, year: number): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await client.rpc("generate_yearly_recap", {
    user_id: userId,
    target_year: year,
  });

  if (error || !data) {
    console.error("[generate-recap-share-image] RPC error:", error);
    return null;
  }
  return data;
}

async function fetchUserProfile(userId: string): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await client
    .from("profiles")
    .select("first_name, last_name, handle")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data;
}

function buildTemplate(recap: any, profile: any, year: number) {
  const name = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
    : "Student";
  const handle = profile?.handle ? `@${profile.handle}` : "";

  return {
    type: "div",
    props: {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#facc15",
        padding: "40px",
        boxSizing: "border-box",
        border: "8px solid #000000",
        position: "relative",
        justifyContent: "space-between",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "30px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "48px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    backgroundColor: "#000000",
                    color: "#ffffff",
                    padding: "10px 20px",
                    border: "4px solid #000000",
                  },
                  children: "CampusConnect",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "36px",
                    fontWeight: "bold",
                    color: "#000000",
                    border: "4px solid #000000",
                    backgroundColor: "#ffffff",
                    padding: "10px 20px",
                  },
                  children: `RECAP '${String(year).slice(-2)}`,
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
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              flex: 1,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                    width: "60%",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: "56px",
                          fontWeight: "bold",
                          color: "#000000",
                          lineHeight: "1.2",
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                        },
                        children: [
                          "You attended ",
                          {
                            type: "span",
                            props: {
                              style: {
                                backgroundColor: "#e11d48",
                                color: "#ffffff",
                                padding: "0 15px",
                                border: "4px solid #000000",
                                marginLeft: "10px",
                                marginRight: "10px",
                              },
                              children: String(recap.total_events_attended),
                            },
                          },
                          " events!",
                        ],
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: "32px",
                          fontWeight: "bold",
                          color: "#000000",
                        },
                        children: `Top category: ${recap.top_category || "Tech"}`,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: "32px",
                          fontWeight: "bold",
                          color: "#000000",
                        },
                        children: `Most visited club: ${recap.most_visited_club || "None"}`,
                      },
                    },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    width: "35%",
                    height: "300px",
                    backgroundColor: "#22d3ee",
                    border: "8px solid #000000",
                    boxShadow: "12px 12px 0px #000000",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "20px",
                    textAlign: "center",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: "70px",
                          fontWeight: "bold",
                          color: "#000000",
                        },
                        children:
                          recap.user_percentile <= 10 ? `Top ${recap.user_percentile}%` : "Active",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: "24px",
                          fontWeight: "bold",
                          color: "#000000",
                          marginTop: "10px",
                        },
                        children: "Campus Leader",
                      },
                    },
                  ],
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
              justifyContent: "flex-start",
              alignItems: "center",
              gap: "20px",
              marginTop: "20px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "28px",
                    fontWeight: "bold",
                    color: "#000000",
                  },
                  children: name,
                },
              },
              handle && {
                type: "div",
                props: {
                  style: {
                    fontSize: "28px",
                    color: "rgba(0,0,0,0.6)",
                  },
                  children: handle,
                },
              },
            ],
          },
        },
      ],
    },
  } as unknown as React.ReactElement;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use GET." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  const yearStr = url.searchParams.get("year");

  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid user_id. Must be a valid UUID." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();

  try {
    const [recap, profile] = await Promise.all([
      fetchUserRecap(userId, year),
      fetchUserProfile(userId),
    ]);

    if (!recap) {
      return new Response(JSON.stringify({ error: "Recap data not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await Promise.all([ensureWasm(), loadInterFont()]);

    const svg = await satori(buildTemplate(recap, profile, year), {
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
      },
    });
  } catch (err: any) {
    console.error("[generate-recap-share-image] Render error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to render share image.", details: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
