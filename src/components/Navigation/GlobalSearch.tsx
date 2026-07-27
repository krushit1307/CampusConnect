import { useEffect, useState } from "react";
import { useDebounce } from "../../hooks/useDebounce";
import { createClient } from "@/lib/supabase/client";
import { Link } from "react-router-dom";
import { formatEventDateRange } from "@/lib/utils";

interface EventSearchResult {
  id: string;
  title: string;
  description: string | null;
  banner_url?: string | null;
  event_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
  [key: string]: unknown;
}
export default function GlobalSearch() {
  const [supabase] = useState(() => createClient());
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<EventSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);

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

  // Whenever the result list changes, highlight the first item by default.
  useEffect(() => {
    setActiveResultId(results.length > 0 ? results[0].id : null);
  }, [results]);

  const activeResult = results.find((event) => event.id === activeResultId) ?? null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;

    const currentIndex = results.findIndex((event) => event.id === activeResultId);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = currentIndex < results.length - 1 ? currentIndex + 1 : 0;
      setActiveResultId(results[nextIndex].id);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : results.length - 1;
      setActiveResultId(results[prevIndex].id);
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {isLoading && <p>Searching...</p>}
      {error && <p role="alert">Something went wrong: {error}</p>}
      {!isLoading && !error && searchTerm.trim() && results.length === 0 && (
        <p>No events found for &ldquo;{searchTerm}&rdquo;.</p>
      )}
      {results.length > 0 && (
        <div className="mt-2 flex neu-border overflow-hidden bg-white">
          <ul className="w-1/3 border-r-2 border-black">
            {results.map((event) => (
              <li
                key={event.id}
                onMouseEnter={() => setActiveResultId(event.id)}
                className={`cursor-pointer px-3 py-2 text-sm font-semibold ${
                  event.id === activeResultId ? "bg-lime" : "hover:bg-cream"
                }`}
              >
                {event.title}
              </li>
            ))}
          </ul>

          <div className="w-2/3 p-4">
            {activeResult && (
              <div>
                {activeResult.banner_url && (
                  <img
                    src={activeResult.banner_url}
                    alt={activeResult.title}
                    className="mb-3 h-32 w-full rounded object-cover"
                  />
                )}
                <h3 className="text-lg font-black">{activeResult.title}</h3>
                <p className="mt-1 font-mono text-xs text-red-900">
                  {formatEventDateRange({
                    event_date: activeResult.event_date ?? null,
                    start_date: activeResult.start_date,
                    end_date: activeResult.end_date,
                  })}
                </p>
                {activeResult.description && (
                  <p className="mt-2 text-sm text-gray-700 line-clamp-3">
                    {activeResult.description}
                  </p>
                )}
                <Link
                  to={`/events/${activeResult.id}`}
                  className="mt-3 inline-block text-sm font-bold text-violet-900 underline"
                >
                  View event →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}{" "}
    </div>
  );
}
