import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "../shared/auth-middleware";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClusterRequest {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
  zoom_level?: number;
  cluster_radius?: number;
  use_kmeans?: boolean;
  num_clusters?: number;
}

interface ClusterResult {
  cluster_id: number;
  event_count: number;
  center_lat: number;
  center_lng: number;
  event_ids: string[];
  titles: string[];
}

interface EventResult {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  latitude: number;
  longitude: number;
  start_date: string | null;
  end_date: string | null;
  club_name: string | null;
  banner_url: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authentication (optional - allow public access for now)
    // const user = await verifyAuth(req, supabase);

    // Parse request body
    const body: ClusterRequest = await req.json();
    const {
      min_lat,
      max_lat,
      min_lng,
      max_lng,
      zoom_level = 12,
      cluster_radius = 0.01,
      use_kmeans = false,
      num_clusters = 20,
    } = body;

    // Validate required parameters
    if (
      min_lat === undefined ||
      max_lat === undefined ||
      min_lng === undefined ||
      max_lng === undefined
    ) {
      return new Response(JSON.stringify({ error: "Missing required bounds parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which clustering function to use
    let clusters: ClusterResult[];

    if (use_kmeans) {
      // Use K-Means clustering
      const { data: kmeansData, error: kmeansError } = await supabase.rpc(
        "get_event_clusters_kmeans",
        {
          p_min_lat: min_lat,
          p_max_lat: max_lat,
          p_min_lng: min_lng,
          p_max_lng: max_lng,
          p_num_clusters: num_clusters,
        },
      );

      if (kmeansError) {
        console.error("K-Means clustering error:", kmeansError);
        return new Response(JSON.stringify({ error: kmeansError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      clusters = kmeansData || [];
    } else {
      // Use DBSCAN clustering (default)
      const { data: dbscanData, error: dbscanError } = await supabase.rpc("get_event_clusters", {
        p_min_lat: min_lat,
        p_max_lat: max_lat,
        p_min_lng: min_lng,
        p_max_lng: max_lng,
        p_zoom_level: zoom_level,
        p_cluster_radius: cluster_radius,
      });

      if (dbscanError) {
        console.error("DBSCAN clustering error:", dbscanError);
        return new Response(JSON.stringify({ error: dbscanError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      clusters = dbscanData || [];
    }

    // If no clusters found, return empty result
    if (clusters.length === 0) {
      return new Response(
        JSON.stringify({
          clusters: [],
          events: [],
          stats: {
            total_clusters: 0,
            total_events: 0,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Collect all event IDs from clusters
    const allEventIds = new Set<string>();
    clusters.forEach((cluster) => {
      cluster.event_ids.forEach((id) => allEventIds.add(id));
    });

    // Fetch event details for all clustered events
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select(
        `id, title, description, location, latitude, longitude, start_date, end_date, banner_url, clubs(name)`,
      )
      .in("id", Array.from(allEventIds))
      .eq("status", "published");

    if (eventsError) {
      console.error("Events fetch error:", eventsError);
      return new Response(JSON.stringify({ error: eventsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format events for frontend
    const formattedEvents: EventResult[] = (events || []).map((event: any) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      latitude: event.latitude,
      longitude: event.longitude,
      start_date: event.start_date,
      end_date: event.end_date,
      club_name: Array.isArray(event.clubs) ? event.clubs[0]?.name : event.clubs?.name,
      banner_url: event.banner_url,
    }));

    // Calculate statistics
    const totalEvents = clusters.reduce((sum, c) => sum + c.event_count, 0);

    // Return response
    return new Response(
      JSON.stringify({
        clusters: clusters.map((c) => ({
          ...c,
          event_ids: c.event_ids.map(String),
        })),
        events: formattedEvents,
        stats: {
          total_clusters: clusters.length,
          total_events: totalEvents,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
