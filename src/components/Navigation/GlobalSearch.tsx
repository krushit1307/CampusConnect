import { useEffect, useState } from "react";
import { useDebounce } from "../../hooks/useDebounce";
import { createClient } from "@/lib/supabase/client";

interface EventSearchResult {
  id: string;
  title: string;
  description: string | null;
  [key: string]: unknown;
}

export default function GlobalSearch() {
  const [supabase] = useState(() => createClient());
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<EventSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    let ignore = false;

    const fetchSearchResults = async (query: string) => {
      setIsLoading(true);
      setError(null);

      // Weighted full-text search: title matches (weight 'A') rank above
      // description matches (weight 'B'), with typo correction and synonym
      // rewriting handled inside the Postgres function (see
      // supabase/migrations/20260725000004_nlp_search_engine.sql). Fixes #1231.
      const { data, error: rpcError } = await supabase.rpc("search_events_advanced", {
        query_string: query,
      });

      if (ignore) return;

      if (rpcError) {
        setError(rpcError.message);
        setResults([]);
      } else {
        setResults((data as EventSearchResult[]) ?? []);
      }

      setIsLoading(false);
    };

    if (!debouncedSearch.trim()) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    fetchSearchResults(debouncedSearch);

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, supabase]);

  return (
    <div>
      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {isLoading && <p>Searching...</p>}
      {error && <p role="alert">Something went wrong: {error}</p>}

      {!isLoading && !error && searchTerm.trim() && results.length === 0 && (
        <p>No events found for &ldquo;{searchTerm}&rdquo;.</p>
      )}

      {results.length > 0 && (
        <ul>
          {results.map((event) => (
            <li key={event.id}>
              <strong>{event.title}</strong>
              {event.description && <p>{event.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
