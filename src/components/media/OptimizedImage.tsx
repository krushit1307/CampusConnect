import { buildResponsiveImageSrcSet, getOptimizedImageUrl } from "@/lib/imageOptimization";
import { useMemo, useState, type ImgHTMLAttributes } from "react";

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

  if (failed) return <>{fallback}</>;

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
