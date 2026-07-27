import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  placeholderSrc?: string;
  rootMargin?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  placeholderSrc,
  rootMargin = "200px",
  ...props
}) => {
  const [isIntersected, setIsIntersected] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isIntersected) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersected(true);
        }
      },
      {
        rootMargin,
      },
    );

    const currentRef = containerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      observer.disconnect();
    };
  }, [isIntersected, rootMargin]);

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden", className)}>
      {!isLoaded && (
        <div className="absolute inset-0 z-10 w-full h-full">
          {placeholderSrc ? (
            <img
              src={placeholderSrc}
              alt={alt}
              className="w-full h-full object-cover blur-md scale-105"
            />
          ) : (
            <Skeleton className="w-full h-full" />
          )}
        </div>
      )}

      {isIntersected && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
          {...props}
        />
      )}
    </div>
  );
};
