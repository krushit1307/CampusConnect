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
