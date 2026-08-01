import { createClient } from "@/lib/supabase/client";

export interface SearchOptions {
  query: string;
  limit?: number;
}

export const searchService = {
  async searchEvents({ query, limit = 50 }: SearchOptions) {
    const supabase = createClient();

    if (!query.trim()) {
      return [];
    }

    const { data, error } = await supabase
      .rpc("search_events_advanced", { query_string: query })
      .select(
        `
        id, title, description, event_date, start_date, end_date, location, banner_url, max_attendees, created_at,
        clubs (name),
        event_rsvps (id, user_id),
        saved_events (id, user_id)
      `,
      )
      .limit(limit);

    if (error) {
      console.error("Error searching events:", error);
      throw error;
    }

    return data;
  },
};
