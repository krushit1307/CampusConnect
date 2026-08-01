import { useMemo, useState, type ImgHTMLAttributes } from "react";
import {
  buildResponsiveImageSrcSet,
  getOptimizedImageUrl,
  isSafeImageSrc,
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

  const optimizedSrc = useMemo(
    () =>
      getOptimizedImageUrl(src, {
        width,
        height,
        quality,
        resize: "cover",
      }),
    [height, quality, src, width],
  );

  const srcSet = useMemo(
    () =>
      responsiveWidths
        ? buildResponsiveImageSrcSet(src, responsiveWidths, {
            height,
            quality,
            resize: "cover",
          })
        : undefined,
    [height, quality, responsiveWidths, src],
  );

  // Guards the sink below: only ever render src values on an explicit scheme
  // allowlist (http/https/blob/data:image). Anything else — including a
  // hypothetically crafted javascript:/data:text/html string — falls back
  // instead of ever reaching the <img> element.
  const isSrcSafe = useMemo(() => isSafeImageSrc(optimizedSrc), [optimizedSrc]);

  if (failed || !isSrcSafe) return <>{fallback}</>;

  return (
    <img
      {...imageProps}
      src={optimizedSrc}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
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
