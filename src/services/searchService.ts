import { createClient } from "@/lib/supabase/client";

export interface SearchOptions {
  query: string;
  categoryFilter?: string | null;
  dateFilter?: "this_week" | null;
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
},};
