import { useMemo, useState, type ImgHTMLAttributes } from "react";
import {
  buildResponsiveImageSrcSet,
  getOptimizedImageUrl,
  isSafeImageSrc,
  isSupabasePublicImage,
} from "@/lib/imageOptimization";

interface OptimizedImageProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "alt" | "width" | "height"
> {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  quality?: number;
  responsiveWidths?: number[];
  fallback?: React.ReactNode;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  quality = 75,
  responsiveWidths,
  sizes,
  fallback = null,
  onError,
  ...imageProps
}: OptimizedImageProps) {
  const [failed, setFailed] = useState(false);

  const isPublic = useMemo(() => isSupabasePublicImage(src), [src]);

  const avifSrc = useMemo(
    () =>
      isPublic
        ? getOptimizedImageUrl(src, { width, height, quality, resize: "cover", format: "avif" })
        : undefined,
    [isPublic, src, width, height, quality],
  );

  const avifSrcSet = useMemo(
    () =>
      isPublic && responsiveWidths
        ? buildResponsiveImageSrcSet(src, responsiveWidths, {
            height,
            quality,
            resize: "cover",
            format: "avif",
          })
        : undefined,
    [isPublic, src, responsiveWidths, height, quality],
  );

  const webpSrc = useMemo(
    () =>
      isPublic
        ? getOptimizedImageUrl(src, { width, height, quality, resize: "cover", format: "webp" })
        : undefined,
    [isPublic, src, width, height, quality],
  );

  const webpSrcSet = useMemo(
    () =>
      isPublic && responsiveWidths
        ? buildResponsiveImageSrcSet(src, responsiveWidths, {
            height,
            quality,
            resize: "cover",
            format: "webp",
          })
        : undefined,
    [isPublic, src, responsiveWidths, height, quality],
  );

  const fallbackSrc = useMemo(
    () => getOptimizedImageUrl(src, { width, height, quality, resize: "cover" }),
    [src, width, height, quality],
  );

  const fallbackSrcSet = useMemo(
    () =>
      responsiveWidths
        ? buildResponsiveImageSrcSet(src, responsiveWidths, { height, quality, resize: "cover" })
        : undefined,
    [src, responsiveWidths, height, quality],
  );

  // Guards the sink below: only ever render src values on an explicit scheme
  // allowlist (http/https/blob/data:image). Anything else — including a
  // hypothetically crafted javascript:/data:text/html string — falls back
  // instead of ever reaching the <img> element.
  const isSrcSafe = useMemo(() => isSafeImageSrc(fallbackSrc), [fallbackSrc]);

  if (failed || !isSrcSafe) return <>{fallback}</>;

  if (isPublic) {
    return (
      <picture>
        <source
          type="image/avif"
          srcSet={avifSrcSet || avifSrc}
          sizes={avifSrcSet ? sizes : undefined}
        />
        <source
          type="image/webp"
          srcSet={webpSrcSet || webpSrc}
          sizes={webpSrcSet ? sizes : undefined}
        />
        <img
          {...imageProps}
          src={fallbackSrc}
          srcSet={fallbackSrcSet}
          sizes={fallbackSrcSet ? sizes : undefined}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onError={(event) => {
            setFailed(true);
            onError?.(event);
          }}
        />
      </picture>
    );
  }

  return (
    <img
      {...imageProps}
      src={fallbackSrc}
      srcSet={fallbackSrcSet}
      sizes={fallbackSrcSet ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
