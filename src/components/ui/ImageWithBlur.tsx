import React, { useState, useMemo } from "react";
import { Blurhash } from "react-blurhash";
import { isValidBlurhash, DEFAULT_FALLBACK_BLURHASH } from "@/lib/blurhashUtils";
import {
  buildResponsiveImageSrcSet,
  getOptimizedImageUrl,
  isSupabasePublicImage,
  isSafeImageSrc,
  DEFAULT_RESPONSIVE_WIDTHS,
} from "@/lib/imageOptimization";

export interface ImageWithBlurProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  blurhash?: string | null;
  aspectRatio?: "video" | "square" | "auto" | string;
  className?: string;
  imgClassName?: string;
  width?: number;
  height?: number;
  responsiveWidths?: number[];
  sizes?: string;
}

export const ImageWithBlur: React.FC<ImageWithBlurProps> = ({
  src,
  alt,
  blurhash,
  aspectRatio = "video",
  className = "",
  imgClassName = "",
  width,
  height,
  responsiveWidths,
  sizes,
  onLoad,
  onError,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const hashToUse = isValidBlurhash(blurhash) ? (blurhash as string) : DEFAULT_FALLBACK_BLURHASH;

  const isPublic = useMemo(() => isSupabasePublicImage(src), [src]);

  const fallbackSrc = useMemo(
    () =>
      isPublic && width && height
        ? getOptimizedImageUrl(src, { width, height, resize: "cover" })
        : src,
    [isPublic, src, width, height],
  );

  const targetWidths = responsiveWidths || (isPublic ? DEFAULT_RESPONSIVE_WIDTHS : undefined);

  const srcSet = useMemo(
    () =>
      targetWidths && isPublic
        ? buildResponsiveImageSrcSet(src, targetWidths, height ? { height, resize: "cover" } : {})
        : props.srcSet,
    [src, targetWidths, isPublic, height, props.srcSet],
  );

  const appliedSizes = srcSet
    ? sizes || props.sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    : undefined;

  const isSrcSafe = useMemo(() => isSafeImageSrc(fallbackSrc), [fallbackSrc]);

  // Determine aspect ratio class
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case "video":
        return "aspect-video";
      case "square":
        return "aspect-square";
      case "auto":
        return "aspect-auto";
      default:
        return aspectRatio.startsWith("aspect-") ? aspectRatio : `aspect-[${aspectRatio}]`;
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    if (onLoad) {
      onLoad(e);
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    if (onError) {
      onError(e);
    }
  };

  if (!isSrcSafe) {
    return (
      <div
        data-testid="image-error-fallback"
        className={`relative overflow-hidden w-full bg-zinc-300 dark:bg-zinc-700 text-zinc-500 font-mono text-xs p-2 flex items-center justify-center text-center ${getAspectRatioClass()} ${className}`}
      >
        <span>⚠️ Invalid image source</span>
      </div>
    );
  }

  return (
    <div
      data-testid="image-blur-container"
      className={`relative overflow-hidden w-full bg-zinc-200 dark:bg-zinc-800 ${getAspectRatioClass()} ${className}`}
    >
      {/* Instant Blurhash Canvas Placeholder */}
      {!isLoaded && !hasError && (
        <div
          data-testid="blurhash-canvas-wrapper"
          className="absolute inset-0 w-full h-full z-0 flex items-center justify-center"
        >
          <Blurhash
            hash={hashToUse}
            width="100%"
            height="100%"
            resolutionX={32}
            resolutionY={32}
            punch={1}
          />
        </div>
      )}

      {/* Fallback error container if image fails to load */}
      {hasError && (
        <div
          data-testid="image-error-fallback"
          className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-300 dark:bg-zinc-700 text-zinc-500 font-mono text-xs p-2 text-center z-10"
        >
          <span>⚠️ Failed to load image</span>
        </div>
      )}

      {/* Actual High-Res Image Overlay */}
      <img
        src={fallbackSrc}
        srcSet={srcSet}
        sizes={appliedSizes}
        alt={alt}
        width={width}
        height={height}
        loading={props.loading || "lazy"}
        decoding={props.decoding || "async"}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out z-10 ${
          isLoaded ? "opacity-100" : "opacity-0"
        } ${imgClassName}`}
        {...props}
      />
    </div>
  );
};
