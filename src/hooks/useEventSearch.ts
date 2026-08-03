import { useQuery } from "@/hooks/useReactQueryReplacement";
import { searchService } from "@/services/searchService";

export function useEventSearch(query: string) {
  return useQuery({
    queryKey: ["eventSearch", query],
    queryFn: async () => {
      if (!query.trim()) {
        return [];
      }
      const data = await searchService.searchEvents({ query });
      return (data || []) as Record<string, unknown>[];
    },
    // Don't execute query if there is no search string
    enabled: query.trim().length > 0,
  });
}
