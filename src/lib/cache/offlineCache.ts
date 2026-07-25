import { cacheInstance } from "./lruCache";

const originalFetch = globalThis.fetch;

/**
 * Checks if a network request is cacheable.
 * We only cache database selects and storage downloads (GET queries).
 */
function isCacheableRequest(url: string, method: string): boolean {
  const isGet = method.toUpperCase() === "GET";

  // Cache Supabase REST API reads and public storage object gets
  const isSupabaseRest = url.includes("/rest/v1/");
  const isSupabaseStorage = url.includes("/storage/v1/");

  return isGet && (isSupabaseRest || isSupabaseStorage);
}

/**
 * Asynchronously writes a network response to the LRU cache.
 */
async function saveToCache(url: string, response: Response): Promise<void> {
  try {
    const cloned = response.clone();
    const bodyText = await cloned.text();

    const headersObj: Record<string, string> = {};
    cloned.headers.forEach((val, key) => {
      headersObj[key] = val;
    });

    await cacheInstance.put(url, bodyText, headersObj, cloned.status);
  } catch (err) {
    console.error("[Offline Cache] Failed to write network response to cache:", err);
  }
}

/**
 * Initializes the offline caching layer by wrapping the global fetch API
 * and opening the IndexedDB store.
 */
export function initOfflineCache(): void {
  // Wrap globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // 1. Resolve request URL
    let url = "";
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input && typeof input === "object" && "url" in input) {
      url = (input as Request).url;
    }

    // 2. Resolve request HTTP method
    let method = "GET";
    if (init && init.method) {
      method = init.method;
    } else if (input && typeof input === "object" && "method" in input) {
      method = (input as Request).method;
    }

    // 3. Fall back to standard fetch if request is not cacheable
    if (!isCacheableRequest(url, method)) {
      return originalFetch(input, init);
    }

    // 4. If navigator is offline, fetch from IndexedDB cache immediately
    const isOnline = navigator.onLine;
    if (!isOnline) {
      const cached = await cacheInstance.get(url);
      if (cached) {
        console.log(`[Offline Cache] Offline mode: serving ${url}`);
        const responseHeaders = new Headers(cached.headers);
        responseHeaders.set("X-From-Cache", "true");

        return new Response(cached.body, {
          status: cached.status,
          statusText: "OK",
          headers: responseHeaders,
        });
      }
      console.warn(`[Offline Cache] Offline mode: cache miss for ${url}`);
      return originalFetch(input, init);
    }

    // 5. If online, fetch from network and cache successful response
    try {
      const response = await originalFetch(input, init);

      if (response.ok) {
        // Asynchronously save to cache so it doesn't block the network flow
        saveToCache(url, response).catch((err) =>
          console.error("[Offline Cache] Failed to write cache in background:", err),
        );
      }

      return response;
    } catch (networkError) {
      console.warn(
        `[Offline Cache] Network fetch failed, trying offline cache fallback for ${url}:`,
        networkError,
      );

      // Network dropped or timed out, attempt cache fallback
      const cached = await cacheInstance.get(url);
      if (cached) {
        console.log(`[Offline Cache] Network failed: serving cached fallback for ${url}`);
        const responseHeaders = new Headers(cached.headers);
        responseHeaders.set("X-From-Cache", "true");

        return new Response(cached.body, {
          status: cached.status,
          statusText: "OK",
          headers: responseHeaders,
        });
      }

      throw networkError;
    }
  };

  // Pre-initialize IndexedDB connection in the background
  cacheInstance
    .init()
    .catch((err) => console.error("[Offline Cache] Pre-initialization failed:", err));
}
