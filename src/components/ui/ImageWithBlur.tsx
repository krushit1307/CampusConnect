import React, { useState } from "react";
import { Blurhash } from "react-blurhash";
import { isValidBlurhash, DEFAULT_FALLBACK_BLURHASH } from "@/lib/blurhashUtils";

export interface ImageWithBlurProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  blurhash?: string | null;
  aspectRatio?: "video" | "square" | "auto" | string;
  className?: string;
  imgClassName?: string;
  width?: number;
  height?: number;
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
  onLoad,
  onError,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const hashToUse = isValidBlurhash(blurhash) ? (blurhash as string) : DEFAULT_FALLBACK_BLURHASH;

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
        src={src}
        alt={alt}
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
