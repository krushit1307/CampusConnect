// src/components/search/Omnibar.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Search from "lucide-react/dist/esm/icons/search";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Users from "lucide-react/dist/esm/icons/users";
import User from "lucide-react/dist/esm/icons/user";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import X from "lucide-react/dist/esm/icons/x";
import { unifiedSearch, type UnifiedSearchResults, type MeiliSearchHit } from "@/lib/meilisearch";

const DEBOUNCE_MS = 200;

/**
 * The unified Omnibar search component (Issue #2686).
 *
 * Displays categorized results (Top Events, Top Clubs, Top People)
 * instantly as the user types, with a 200ms debounce. Results are
 * fetched from the meilisearch-search Edge Function, which proxies
 * to Meilisearch's /multi-search endpoint.
 *
 * Keyboard navigation:
 *   - ↑/↓ to move between results
 *   - Enter to navigate to the selected result
 *   - Escape to close the dropdown
 */
export function Omnibar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnifiedSearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();

  // ── Debounced search ──────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (!q.trim()) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    try {
      const data = await unifiedSearch(q, 5, controller.signal);
      if (!controller.signal.aborted) {
        setResults(data);
        setIsOpen(true);
        setSelectedIndex(0);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[Omnibar] Search error:", err);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // Debounce the search.
  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  // ── Outside-click to close ────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // ── Build a flat list of results for keyboard navigation ───────
  const flatResults: { type: "event" | "club" | "profile"; hit: MeiliSearchHit }[] = [
    ...(results?.events ?? []).map((h) => ({ type: "event" as const, hit: h })),
    ...(results?.clubs ?? []).map((h) => ({ type: "club" as const, hit: h })),
    ...(results?.profiles ?? []).map((h) => ({ type: "profile" as const, hit: h })),
  ];

  // ── Keyboard navigation ───────────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatResults[selectedIndex]) {
      e.preventDefault();
      navigateToResult(flatResults[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const navigateToResult = (item: { type: "event" | "club" | "profile"; hit: MeiliSearchHit }) => {
    const { type, hit } = item;
    let path = "/";
    if (type === "event") path = `/events/${hit.short_id ?? hit.id}`;
    else if (type === "club") path = `/clubs/${hit.slug ?? hit.id}`;
    else if (type === "profile") path = `/profile/${hit.handle ?? hit.id}`;
    navigate(path);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="relative w-full max-w-xl" ref={containerRef}>
      {/* Search input */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results && results.totalHits > 0 && setIsOpen(true)}
          placeholder="Search events, clubs, people…"
          aria-label="Global search"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="omnibar-results"
          aria-activedescendant={
            flatResults[selectedIndex] ? `omnibar-result-${selectedIndex}` : undefined
          }
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        {isLoading && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400"
            aria-hidden="true"
          />
        )}
        {!isLoading && query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults(null);
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && results && (
        <div
          id="omnibar-results"
          role="listbox"
          className="absolute mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {flatResults.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No results found for "{query}"
            </div>
          ) : (
            <>
              {/* Events section */}
              {results.events.length > 0 && (
                <ResultSection
                  title="Top Events"
                  icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
                  items={results.events}
                  renderItem={(hit) => (
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {String(hit.title ?? "Untitled")}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {String(hit.location ?? "")}
                        {hit.event_date &&
                          ` · ${new Date(String(hit.event_date)).toLocaleDateString()}`}
                      </p>
                    </div>
                  )}
                  onSelect={(hit) => navigateToResult({ type: "event", hit })}
                  selectedIndex={selectedIndex}
                  sectionOffset={0}
                />
              )}

              {/* Clubs section */}
              {results.clubs.length > 0 && (
                <ResultSection
                  title="Top Clubs"
                  icon={<Users className="h-4 w-4" aria-hidden="true" />}
                  items={results.clubs}
                  renderItem={(hit) => (
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {String(hit.name ?? "Unnamed")}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {String(hit.category ?? "")}
                        {hit.member_count && ` · ${hit.member_count} members`}
                      </p>
                    </div>
                  )}
                  onSelect={(hit) => navigateToResult({ type: "club", hit })}
                  selectedIndex={selectedIndex}
                  sectionOffset={results.events.length}
                />
              )}

              {/* Profiles section */}
              {results.profiles.length > 0 && (
                <ResultSection
                  title="Top People"
                  icon={<User className="h-4 w-4" aria-hidden="true" />}
                  items={results.profiles}
                  renderItem={(hit) => (
                    <div className="flex items-center gap-2">
                      {hit.avatar_url && (
                        <img
                          src={String(hit.avatar_url)}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {String(hit.full_name ?? hit.first_name ?? "Unknown")}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          @{String(hit.handle ?? "")}
                        </p>
                      </div>
                    </div>
                  )}
                  onSelect={(hit) => navigateToResult({ type: "profile", hit })}
                  selectedIndex={selectedIndex}
                  sectionOffset={results.events.length + results.clubs.length}
                />
              )}

              {/* Processing time footer */}
              {results.processingTimeMs > 0 && (
                <div className="border-t border-slate-100 px-4 py-2 text-right text-[10px] text-slate-400 dark:border-slate-800">
                  {results.processingTimeMs}ms
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface ResultSectionProps {
  title: string;
  icon: React.ReactNode;
  items: MeiliSearchHit[];
  renderItem: (hit: MeiliSearchHit) => React.ReactNode;
  onSelect: (hit: MeiliSearchHit) => void;
  selectedIndex: number;
  sectionOffset: number;
}

function ResultSection({
  title,
  icon,
  items,
  renderItem,
  onSelect,
  selectedIndex,
  sectionOffset,
}: ResultSectionProps) {
  return (
    <div className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
      <div className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {icon}
        {title}
      </div>
      <ul>
        {items.map((hit, i) => {
          const globalIndex = sectionOffset + i;
          const isSelected = globalIndex === selectedIndex;
          return (
            <li key={String(hit.id)}>
              <button
                type="button"
                id={`omnibar-result-${globalIndex}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(hit)}
                onMouseEnter={() => {
                  /* Let keyboard nav override */
                }}
                className={`flex w-full items-center px-4 py-2 text-left transition-colors ${
                  isSelected
                    ? "bg-indigo-50 dark:bg-indigo-950/50"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {renderItem(hit)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
