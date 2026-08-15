import { useMemo } from "react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { useDebounce } from "@/hooks/use-debounce";
import { searchService, type GlobalSearchResult } from "@/services/searchService";

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

/** Builds the result record used by the palette from a global_search row. */
function toResult(row: GlobalSearchResult): CommandSearchResult | null {
  switch (row.entity_type) {
    case "event":
      return {
        id: row.id,
        type: "event",
        label: row.label,
        sublabel: "Event",
        path: `/events/${row.short_id ?? row.id}`,
      };
    case "club":
      if (!row.slug) return null;
      return {
        id: row.id,
        type: "club",
        label: row.label,
        sublabel: "Club",
        path: `/clubs/${row.slug}`,
      };
    case "profile":
      if (!row.handle) return null;
      return {
        id: row.id,
        type: "person",
        label: row.label,
        sublabel: "User",
        path: `/profile/${row.handle}`,
      };
    default:
      return null;
  }
}

/**
 * Debounced global search across clubs, events, and profiles for the Cmd+K
 * palette. Supports `events:`, `clubs:`, and `users:` prefixes to scope the
 * search to a single table. Debounce is 300ms to avoid spamming the database
 * while typing rapidly.
 */
export function useCommandPaletteSearch(query: string) {
  const { scope, term } = parseQuery(query);
  const debouncedTerm = useDebounce(term, 300);

  const { data = [], isLoading } = useQuery({
    queryKey: ["global-search", scope, debouncedTerm],
    enabled: Boolean(debouncedTerm.trim()),
    queryFn: async () => {
      const rows = await searchService.globalSearch(debouncedTerm);

      return rows
        .map(toResult)
        .filter((r): r is CommandSearchResult => r !== null)
        .filter((r) => (scope ? r.type === scope : true));
    },
  });

  const results = useMemo(() => data, [data]);

  return {
    results,
    isLoading,
  };
}
