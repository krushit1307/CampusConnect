interface FetchOptions extends RequestInit {
  isStaticMetadata?: boolean;
}

export async function customFetch(url: string, options: FetchOptions = {}) {
  const { isStaticMetadata, ...init } = options;

  const requestUrl = url;

  if (!isStaticMetadata) {
    // For non-static (dynamic) endpoints, we might want to ensure they aren't aggressively cached.
    // However, the spec says "Ensure frontend fetch requests do not append aggressive ?timestamp= cache-busting strings to these specific queries."
    // So if isStaticMetadata is true, we leave the URL alone.
  }

  // Ensure we don't accidentally override cache control if it's static metadata
  if (isStaticMetadata) {
    // We want the browser default caching which will respect the Cache-Control headers
    init.cache = "default";
  }

  const response = await fetch(requestUrl, init);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}
