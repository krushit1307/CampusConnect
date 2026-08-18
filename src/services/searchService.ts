import { createClient } from "@/lib/supabase/client";

export interface SearchOptions {
  query: string;
  categoryFilter?: string | null;
  dateFilter?: "this_week" | null;
}

export interface GlobalSearchResult {
  entity_type: "event" | "club" | "profile";
  id: string;
  label: string;
  description: string;
  sublabel: string;
  short_id: string | null;
  slug: string | null;
  handle: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  club_name: string | null;
  rank: number;
}

export const searchService = {
  async searchEvents({ query, categoryFilter = null, dateFilter = null }: SearchOptions) {
    const supabase = createClient();

    const { data, error } = await supabase.rpc("search_events", {
      query_text: query.trim(),
      category_filter: categoryFilter,
      date_filter: dateFilter,
    });

    if (error) {
      console.error("Error searching events:", error);
      throw error;
    }

    return data ?? [];
  },

  async globalSearch(query: string): Promise<GlobalSearchResult[]> {
    const supabase = createClient();

    const { data, error } = await supabase.rpc("global_search", {
      p_query: query.trim(),
    });

    if (error) {
      console.error("Error running global search:", error);
      throw error;
    }

    return (data as GlobalSearchResult[] | null) ?? [];
  },
};
