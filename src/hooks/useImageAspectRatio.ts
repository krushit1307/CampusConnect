// src/hooks/useImageAspectRatio.ts
import { useState, useEffect, useCallback } from "react";

interface AspectRatioState {
  [key: string]: {
    width: number;
    height: number;
    ratio: number;
    paddingBottom: string;
  };
}

/**
 * Hook to pre-calculate aspect ratios for images to prevent Cumulative Layout Shift (CLS).
 * When using CSS columns for masonry layouts, images without explicit heights
 * will cause the layout to shift violently as they load.
 *
 * @param urls - Array of image URLs to measure
 * @returns Object mapping URL to its calculated dimensions and padding-bottom percentage
 */
export const useImageAspectRatio = (urls: string[]) => {
  const [ratios, setRatios] = useState<AspectRatioState>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const measureImage = useCallback(
    (url: string): Promise<void> => {
      return new Promise((resolve) => {
        if (ratios[url]) {
          resolve();
          return;
        }

        const img = new Image();
        img.onload = () => {
          const ratio = img.naturalHeight / img.naturalWidth;
          setRatios((prev) => ({
            ...prev,
            [url]: {
              width: img.naturalWidth,
              height: img.naturalHeight,
              ratio,
              paddingBottom: `${ratio * 100}%`,
            },
          }));
          resolve();
        };
        img.onerror = () => {
          // Fallback to a standard 4:3 ratio if image fails to load
          setRatios((prev) => ({
            ...prev,
            [url]: {
              width: 400,
              height: 300,
              ratio: 0.75,
              paddingBottom: "75%",
            },
          }));
          resolve();
        };
        img.src = url;
      });
    },
    [ratios],
  );

  useEffect(() => {
    if (urls.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const promises = urls.map((url) => measureImage(url));

    Promise.all(promises).finally(() => {
      setIsLoading(false);
    });
  }, [urls, measureImage]);

  return { ratios, isLoading };
};
