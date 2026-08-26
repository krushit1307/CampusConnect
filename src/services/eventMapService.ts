import { createClient } from "@/lib/supabase/client";
import { ActiveEventMapData } from "@/types/heatmap";

export const eventMapService = {
  async getActiveEventsForMap(): Promise<ActiveEventMapData[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("events")
      .select("id, location, metadata, status, rsvp_count")
      .in("status", ["published", "active"]); // Filter out draft, cancelled, expired

    if (error) {
      console.error("Error fetching events for map:", error);
      throw error;
    }

    // Map the response to our expected format
    return (data || [])
      .map((event) => {
        // Assuming location or metadata contains lat/lng
        // Adjust this according to the actual schema if needed
        let lat = 0;
        let lng = 0;

        if (event.location && typeof event.location === "object") {
          lat = (event.location as { lat?: number }).lat || 0;
          lng = (event.location as { lng?: number }).lng || 0;
        }

        return {
          id: event.id,
          lat,
          lng,
          rsvpCount: event.rsvp_count || 0,
          status: (event.status || "active") as "draft" | "active" | "cancelled" | "expired",
        };
      })
      .filter((e) => e.lat !== 0 && e.lng !== 0); // Keep only items with coords
  },
};
