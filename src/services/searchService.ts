import { createClient } from "@/lib/supabase/client";

export interface SearchOptions {
  query: string;
}

export const searchService = {
  async searchEvents({ query }: SearchOptions) {
    const supabase = createClient();

    if (!query.trim()) {
      return [];
    }

    const { data, error } = await supabase.functions.invoke("global-search", {
      body: {
        query,
      },
    });

    if (error) {
      console.error("Error searching events:", error);
      throw error;
    }

    return data;
  },
};
