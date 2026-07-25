export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
}

const SUPABASE_PUBLIC_OBJECT_SEGMENT = "/storage/v1/object/public/";
const SUPABASE_RENDER_SEGMENT = "/storage/v1/render/image/public/";

export function isSupabasePublicImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.includes(SUPABASE_PUBLIC_OBJECT_SEGMENT);
  } catch {
    return false;
  }
}

// Allowed schemes for anything rendered as an <img src>. This exists so that
// DOM- or user-influenced strings (e.g. a blob: preview URL derived from a
// picked File, before it's ever uploaded anywhere) can never resolve to a
// scheme like `javascript:`/`vbscript:`/`data:text/html` — the categories
// CodeQL's DOM-XSS query (js/xss-through-dom) flags this kind of flow for.
const SAFE_IMAGE_SRC_SCHEMES = new Set(["http:", "https:", "blob:", "data:"]);

export function isSafeImageSrc(source: string): boolean {
  if (!source) return false;

  // No scheme at all (e.g. "/logo.png") means a same-origin relative path — safe.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(source)) return true;

  try {
    const parsed = new URL(
      source,
      typeof window !== "undefined" ? window.location.origin : undefined,
    );
    if (!SAFE_IMAGE_SRC_SCHEMES.has(parsed.protocol)) return false;
    // data: URLs specifically must be images — data:text/html etc. is never allowed.
    if (parsed.protocol === "data:" && !/^data:image\//i.test(source)) return false;
    return true;
  } catch {
    return false;
  }
}

export function getOptimizedImageUrl(source: string, options: ImageTransformOptions = {}): string {
  if (!isSupabasePublicImage(source)) return source;

  const parsed = new URL(source);
  parsed.pathname = parsed.pathname.replace(
    SUPABASE_PUBLIC_OBJECT_SEGMENT,
    SUPABASE_RENDER_SEGMENT,
  );

  if (options.width) parsed.searchParams.set("width", String(options.width));
  if (options.height) parsed.searchParams.set("height", String(options.height));
  if (options.quality) parsed.searchParams.set("quality", String(options.quality));
  if (options.resize) parsed.searchParams.set("resize", options.resize);

  return parsed.toString();
}

export function buildResponsiveImageSrcSet(
  source: string,
  widths: number[],
  options: Omit<ImageTransformOptions, "width"> = {},
): string | undefined {
  if (!isSupabasePublicImage(source)) return undefined;

  const normalizedWidths = [...new Set(widths)]
    .filter((width) => Number.isFinite(width) && width > 0)
    .sort((left, right) => left - right);

  if (normalizedWidths.length === 0) return undefined;

  return normalizedWidths
    .map((width) => `${getOptimizedImageUrl(source, { ...options, width })} ${width}w`)
    .join(", ");
}
