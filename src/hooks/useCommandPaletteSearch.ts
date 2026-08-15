import { useMemo } from "react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { useDebounce } from "@/hooks/use-debounce";
import { searchService } from "@/services/searchService";
export type CommandSearchResultType = "club" | "event" | "person";

export interface CommandSearchResult {
  id: string;
  type: CommandSearchResultType;
  label: string;
  sublabel: string;
  path: string;
}

const PREFIXES: Record<string, CommandSearchResultType> = {
  "clubs:": "club",
  "club:": "club",
  "events:": "event",
  "event:": "event",
  "users:": "person",
  "people:": "person",
};

function parseQuery(raw: string): { scope: CommandSearchResultType | null; term: string } {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  for (const prefix of Object.keys(PREFIXES)) {
    if (lower.startsWith(prefix)) {
      return { scope: PREFIXES[prefix], term: trimmed.slice(prefix.length).trim() };
    }
  }

  return { scope: null, term: trimmed };
}

/**
 * Debounced search across clubs, events, and people for the Cmd+K palette.
 * Supports `events:`, `clubs:`, and `users:` prefixes to scope the search
 * to a single table.
 */
export function useCommandPaletteSearch(
  query: string,
  categoryFilter: string | null = null,
  dateFilter: "this_week" | null = null,
) {
  const debouncedQuery = useDebounce(query, 200);

  const { data = [], isLoading } = useQuery({
    queryKey: ["command-palette-search", debouncedQuery, categoryFilter, dateFilter],
    enabled: Boolean(debouncedQuery.trim()),
    queryFn: async () => {
      const results = await searchService.searchEvents({
        query: debouncedQuery,
        categoryFilter,
        dateFilter,
      });

      return results.map((event: { id: string; title: string }) => ({
        id: event.id,
        type: "event" as const,
        label: event.title,
        sublabel: "Event",
        path: `/events/${event.id}`,
      }));
    },
  });

  const results = useMemo(() => data, [data]);

  return {
    results,
    isLoading,
  };
}
