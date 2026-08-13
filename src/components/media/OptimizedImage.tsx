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
  const [loaded, setLoaded] = useState(false);

  const isPublic = useMemo(() => isSupabasePublicImage(src), [src]);

  const lqipSrc = useMemo(
    () =>
      isPublic
        ? getOptimizedImageUrl(src, { width: 20, height: Math.round(20 * (height / width)), quality: 20, resize: "cover", format: "webp" })
        : undefined,
    [isPublic, src, width, height],
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

  const isSrcSafe = useMemo(() => isSafeImageSrc(fallbackSrc), [fallbackSrc]);

  if (failed || !isSrcSafe) return <>{fallback}</>;

  const wrapperClass = `${imageProps.className || ""} relative overflow-hidden inline-block`.trim();

  const cleanImageProps = { ...imageProps };
  delete cleanImageProps.className;
  delete cleanImageProps.style;

  const contentStyle = {
    transition: "opacity 0.5s ease-in-out",
    opacity: loaded ? 1 : 0,
    width: "100%",
    height: "100%",
    display: "block",
  };

  const lqipStyle = {
    position: "absolute" as const,
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    filter: "blur(10px)",
    transform: "scale(1.1)",
    transition: "opacity 0.5s ease-in-out",
    opacity: loaded ? 0 : 1,
    pointerEvents: "none" as const,
  };

  const handleLoad = () => {
    setLoaded(true);
  };

  if (isPublic) {
    return (
      <div className={wrapperClass} style={{ ...imageProps.style, width, height }}>
        {lqipSrc && (
          <img
            src={lqipSrc}
            alt=""
            aria-hidden="true"
            style={lqipStyle}
          />
        )}
        <picture style={contentStyle}>
          <img
            {...cleanImageProps}
            src={fallbackSrc}
            srcSet={fallbackSrcSet}
            sizes={fallbackSrcSet ? sizes : undefined}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            onLoad={handleLoad}
            onError={(event) => {
              setFailed(true);
              onError?.(event);
            }}
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </picture>
      </div>
    );
  }
  return (
    <div className={wrapperClass} style={{ ...imageProps.style, width, height }}>
      {lqipSrc && (
        <img
          src={lqipSrc}
          alt=""
          aria-hidden="true"
          style={lqipStyle}
        />
      )}
      <img
        {...cleanImageProps}
        src={fallbackSrc}
        srcSet={fallbackSrcSet}
        sizes={fallbackSrcSet ? sizes : undefined}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={handleLoad}
        onError={(event) => {
          setFailed(true);
          onError?.(event);
        }}
        style={contentStyle}
      />
    </div>
  );
}
