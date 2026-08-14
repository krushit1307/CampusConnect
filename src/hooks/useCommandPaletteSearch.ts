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
}  const [results, setResults] = useState<CommandSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const { scope, term } = parseQuery(query);

    if (!term) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let ignore = false;
    setIsLoading(true);

    const timeout = setTimeout(async () => {
      const supabase = createClient();
      const searches: Promise<CommandSearchResult[]>[] = [];

      if (!scope || scope === "club") {
        searches.push(
          supabase
            .from("clubs")
            .select("id, name, slug")
            .ilike("name", `%${term}%`)
            .limit(5)
            .then(({ data }) =>
              (data ?? []).map((club) => ({
                id: club.id as string,
                type: "club" as const,
                label: club.name as string,
                sublabel: "Club",
                path: `/clubs/${club.slug}`,
              })),
            ),
        );
      }

      if (!scope || scope === "event") {
        searches.push(
          supabase
            .rpc("search_events_advanced", { query_string: term })
            .limit(5)
            .then(({ data }) =>
              (data ?? []).map((event: { id: string; title: string }) => ({
                id: event.id,
                type: "event" as const,
                label: event.title,
                sublabel: "Event",
                path: `/events/${event.id}`,
              })),
            ),
        );
      }

      if (!scope || scope === "person") {
        searches.push(
          supabase
            .from("profiles")
            .select("id, handle, first_name, last_name")
            .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
            .limit(5)
            .then(({ data }) =>
              (data ?? []).map((person) => ({
                id: person.id as string,
                type: "person" as const,
                label: `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim(),
                sublabel: "Person",
                path: `/profile/${person.handle}`,
              })),
            ),
        );
      }

      const settled = await Promise.all(searches);

      if (!ignore) {
        setResults(settled.flat());
        setIsLoading(false);
      }
    }, 200); // debounce so we don't fire a request on every keystroke

    return () => {
      ignore = true;
      clearTimeout(timeout);
    };
  }, [query]);

  return { results, isLoading };
}
