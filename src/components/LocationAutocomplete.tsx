import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MapPin, Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  isSearchableLocationQuery,
  isValidLocationCoordinates,
  normalizeLocationQuery,
} from "@/lib/locationAutocomplete";

export interface LocationSuggestion {
  id: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  provider: "photon";
}

interface LocationAutocompleteProps {
  value: string;
  latitude?: number | null;
  longitude?: number | null;
  onChange: (value: string, coordinates: { latitude: number; longitude: number } | null) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

interface LocationSearchResponse {
  suggestions?: LocationSuggestion[];
}

const DEBOUNCE_MS = 1000;

export function LocationAutocomplete({
  value,
  latitude,
  longitude,
  onChange,
  placeholder = "Search for a venue or address",
  required = false,
  error,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const normalizedQuery = normalizeLocationQuery(query);
    if (!isSearchableLocationQuery(normalizedQuery)) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/location-search?q=${encodeURIComponent(normalizedQuery)}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (!response.ok) return;
        const body = (await response.json()) as LocationSearchResponse;
        if (requestId === requestIdRef.current) {
          setSuggestions(
            (body.suggestions ?? []).filter((suggestion) =>
              isValidLocationCoordinates(suggestion.latitude, suggestion.longitude),
            ),
          );
          setIsOpen(true);
        }
      } catch {
        if (requestId === requestIdRef.current) setSuggestions([]);
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const handleInputChange = (nextValue: string) => {
    setQuery(nextValue);
    setIsOpen(true);
    onChange(nextValue, null);
  };

  const handleSelect = (suggestion: LocationSuggestion) => {
    setQuery(suggestion.formatted_address);
    setSuggestions([]);
    setIsOpen(false);
    onChange(suggestion.formatted_address, {
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
  };

  const hasCoordinates = latitude != null && longitude != null;

  return (
    <div className="relative space-y-1">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50"
          aria-hidden="true"
        />
        <input
          id="location"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="location-suggestions"
          aria-invalid={Boolean(error)}
          required={required}
          value={query}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
          placeholder={placeholder}
          className="w-full border-2 border-black bg-white py-2 pl-10 pr-10 font-mono text-sm outline-none focus:bg-lime/20"
        />
        {isLoading && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-black/60"
            aria-label="Searching locations"
          />
        )}
      </div>

      {isOpen && (isLoading || suggestions.length > 0 || query.trim().length >= 3) && (
        <div
          id="location-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto border-2 border-black bg-white shadow-[4px_4px_0_0_#000]"
        >
          {isLoading ? (
            <div className="flex items-center gap-2 p-3 font-mono text-xs text-black/60">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching verified locations…
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                role="option"
                className="flex w-full items-start gap-3 border-b border-black/10 p-3 text-left last:border-0 hover:bg-cream focus:bg-cream focus:outline-none"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(suggestion)}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span className="font-mono text-xs font-bold text-black">
                  {suggestion.formatted_address}
                </span>
              </button>
            ))
          ) : (
            <p className="p-3 font-mono text-xs text-black/60">No verified locations found.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-black/55">
        <span>Type at least 3 characters, then choose a verified suggestion.</span>
        <a
          href="https://photon.komoot.io/"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-black"
        >
          © OpenStreetMap contributors · Photon
        </a>
      </div>
      {hasCoordinates && (
        <p className="flex items-center gap-1 font-mono text-xs font-bold text-green-700">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Verified coordinates: {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </p>
      )}
      {error && <p className="font-mono text-xs text-red-600">{error}</p>}
    </div>
  );
}
