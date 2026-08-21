import React, { useState, useRef, useEffect, ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ProgressiveImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  placeholder?: string;
  alt: string;
}

export function ProgressiveImage({
  src,
  placeholder,
  alt,
  className,
  ...props
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset state if src changes
  useEffect(() => {
    setLoaded(false);
    setError(false);

    // Check if image is already cached
    if (imgRef.current?.complete) {
      // Natural width is 0 if the image failed to load or hasn't loaded properly
      if (imgRef.current.naturalWidth > 0) {
        setLoaded(true);
      }
    }
  }, [src]);

  const handleLoad = () => {
    setLoaded(true);
  };

  const handleError = () => {
    setError(true);
    setLoaded(true); // Don't hang on the blurred placeholder if high-res fails
  };

  return (
    <div className={cn("relative overflow-hidden w-full h-full", className)}>
      {/* Blurred Placeholder */}
      {placeholder && !error && (
        <img
          src={placeholder}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute inset-0 h-full w-full object-cover blur-[10px] scale-110 transition-opacity duration-500",
            loaded ? "opacity-0" : "opacity-100",
          )}
        />
      )}

      {/* High-res Image */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
          error ? "opacity-100" : "", // Show error fallback if native img supports it
        )}
        {...props}
      />
    </div>
  );
}
