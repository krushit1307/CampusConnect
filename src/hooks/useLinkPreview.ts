import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OgData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

interface UseLinkPreviewResult {
  data: OgData | null;
  loading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Module-level in-memory LRU cache (persists across re-renders within session)
// Maximum 200 entries — oldest evicted when capacity is exceeded.
// ---------------------------------------------------------------------------

const MAX_CACHE_SIZE = 200;
const sessionCache = new Map<string, OgData | "error">();

function cacheSet(url: string, value: OgData | "error"): void {
  if (sessionCache.size >= MAX_CACHE_SIZE) {
    // Evict the oldest key
    const firstKey = sessionCache.keys().next().value;
    if (firstKey) sessionCache.delete(firstKey);
  }
  sessionCache.set(url, value);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const supabase = createClient();

/**
 * Fetches OpenGraph preview data for a URL via the `link-preview` Edge Function.
 *
 * - Results are cached in-memory for the duration of the browser session.
 * - Gracefully returns `error` if the edge function fails (UI should hide the preview).
 * - Cleans up its own AbortController on unmount / URL change.
 */
export function useLinkPreview(url: string | null | undefined): UseLinkPreviewResult {
  const [data, setData] = useState<OgData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    // --- Session cache hit ---
    const cached = sessionCache.get(url);
    if (cached) {
      if (cached === "error") {
        setData(null);
        setError("cached-error");
        setLoading(false);
      } else {
        setData(cached);
        setError(null);
        setLoading(false);
      }
      return;
    }

    // --- Fetch from Edge Function ---
    let cancelled = false;
    setLoading(true);
    setData(null);
    setError(null);

    (async () => {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke<OgData>(
          "link-preview",
          { body: { url } },
        );

        if (cancelled) return;

        if (fnError || !result) {
          const msg = fnError?.message ?? "No data returned";
          cacheSet(url, "error");
          setError(msg);
          setData(null);
        } else {
          cacheSet(url, result);
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        cacheSet(url, "error");
        setError(msg);
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading, error };
}
