import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rateLimiter } from "../shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HeatmapPoint {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  intensity: number; // 0-1 scale based on attendance
  attendee_count: number;
  start_time: string;
  end_time: string;
  location?: string;
  club_name?: string;
  visibility: "public" | "private" | "invite_only";
}

interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    id: string;
    title: string;
    intensity: number;
    attendee_count: number;
    start_date: string;
    end_date: string;
    location?: string;
    club_name?: string;
  };
}

interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate limit: 60 requests/minute (read-only, heatmap)
  const limited = await rateLimiter(req, "get-active-heatmap", 60, 60);
  if (limited) return limited;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Query events that are currently happening (NOW() between start_date and end_date)
    // Only include public events to respect privacy settings
    const { data: activeEvents, error: fetchError } = await supabase
      .from("events")
      .select(
        `
        id,
        title,
        latitude,
        longitude,
        location,
        start_date,
        end_date,
        visibility,
        clubs ( name ),
        event_rsvps!inner ( 
          id,
          status
        )
      `,
      )
      .eq("visibility", "public")
      .lte("start_date", now)
      .gte("end_date", now)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (fetchError) {
      console.error("Failed to fetch active events:", fetchError);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch active events",
          details: fetchError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Transform events to heatmap points with intensity based on checked-in attendees
    const heatmapPoints: HeatmapPoint[] = (activeEvents || [])
      .map((event: any) => {
        // Count attendees with status "attended" (checked-in)
        const attendeeCount = Array.isArray(event.event_rsvps)
          ? event.event_rsvps.filter((rsvp: any) => rsvp.status === "attended").length
          : 0;

        // Calculate intensity: 0-1 scale
        // 0-5 people = low (0.2), 5-50 = medium (0.5), 50-200 = high (0.8), 200+ = max (1.0)
        let intensity = 0.1;
        if (attendeeCount > 5) intensity = 0.3;
        if (attendeeCount > 50) intensity = 0.6;
        if (attendeeCount > 200) intensity = 0.9;
        if (attendeeCount > 500) intensity = 1.0;

        // Normalize to 0-1 by capping at 500 attendees
        const normalizedIntensity = Math.min(attendeeCount / 500, 1.0);

        const clubName = Array.isArray(event.clubs) ? event.clubs[0]?.name : event.clubs?.name;

        return {
          id: event.id,
          title: event.title,
          latitude: parseFloat(event.latitude),
          longitude: parseFloat(event.longitude),
          intensity: normalizedIntensity,
          attendee_count: attendeeCount,
          start_time: event.start_date,
          end_time: event.end_date,
          location: event.location,
          club_name: clubName,
          visibility: event.visibility,
        };
      })
      .filter((point): point is HeatmapPoint => !isNaN(point.latitude) && !isNaN(point.longitude));

    // Transform to GeoJSON format for Leaflet
    const geoJsonFeatures: GeoJSONFeature[] = heatmapPoints.map((point) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [point.longitude, point.latitude],
      },
      properties: {
        id: point.id,
        title: point.title,
        intensity: point.intensity,
        attendee_count: point.attendee_count,
        start_date: point.start_time,
        end_date: point.end_time,
        location: point.location,
        club_name: point.club_name,
      },
    }));

    const geoJsonCollection: GeoJSONFeatureCollection = {
      type: "FeatureCollection",
      features: geoJsonFeatures,
    };

    // Return as GeoJSON
    return new Response(JSON.stringify(geoJsonCollection), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60", // Cache for 1 minute
      },
    });
  } catch (error: unknown) {
    console.error("Heatmap error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
