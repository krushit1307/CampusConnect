import { useState, useEffect } from "react";

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface UseBannerColorResult {
  rgb: [number, number, number];
  hex: string;
  gradientStyle: string;
  darkGradientStyle: string;
  isLoading: boolean;
}

export const DEFAULT_FALLBACK_RGB: [number, number, number] = [30, 27, 75]; // Dark indigo

/**
 * Calculates perceived brightness (0 - 255) using WCAG luminance formula.
 */
export function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Darkens/adjusts an RGB color if too bright, ensuring white text remains 100% legible (#1744).
 */
export function ensureLegibleRGB(r: number, g: number, b: number, maxBrightness = 150): [number, number, number] {
  const brightness = getLuminance(r, g, b);
  if (brightness <= maxBrightness) return [r, g, b];

  const factor = maxBrightness / brightness;
  return [
    Math.round(r * factor),
    Math.round(g * factor),
    Math.round(b * factor),
  ];
}

/**
 * Converts RGB tuple to Hex string.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Generates dynamic background gradient CSS string from extracted RGB.
 */
export function createBannerGradient(r: number, g: number, b: number, alpha = 0.55): string {
  const [lr, lg, lb] = ensureLegibleRGB(r, g, b, 140);
  return `linear-gradient(to bottom, rgba(${lr}, ${lg}, ${lb}, ${alpha}) 0%, rgba(${lr}, ${lg}, ${lb}, 0.25) 50%, transparent 100%)`;
}

/**
 * Custom hook for extracting dominant color from an event banner image (#1744).
 * Handles CORS safely (crossOrigin="anonymous"), computes dominant RGB, adjusts for legibility,
 * and generates CSS background gradient strings.
 */
export function useBannerColor(imageUrl?: string | null): UseBannerColorResult {
  const [colorState, setColorState] = useState<UseBannerColorResult>({
    rgb: DEFAULT_FALLBACK_RGB,
    hex: rgbToHex(...DEFAULT_FALLBACK_RGB),
    gradientStyle: createBannerGradient(...DEFAULT_FALLBACK_RGB),
    darkGradientStyle: createBannerGradient(...DEFAULT_FALLBACK_RGB, 0.75),
    isLoading: Boolean(imageUrl),
  });

  useEffect(() => {
    if (!imageUrl) {
      setColorState({
        rgb: DEFAULT_FALLBACK_RGB,
        hex: rgbToHex(...DEFAULT_FALLBACK_RGB),
        gradientStyle: createBannerGradient(...DEFAULT_FALLBACK_RGB),
        darkGradientStyle: createBannerGradient(...DEFAULT_FALLBACK_RGB, 0.75),
        isLoading: false,
      });
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      if (!isMounted) return;
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context unavailable");

        // Scale down to 40x40 for fast pixel extraction
        canvas.width = 40;
        canvas.height = 40;
        ctx.drawImage(img, 0, 0, 40, 40);

        const imageData = ctx.getImageData(0, 0, 40, 40).data;
        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        let count = 0;

        for (let i = 0; i < imageData.length; i += 16) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          const a = imageData[i + 3];

          // Skip transparent or near-black/near-white extreme pixels
          if (a > 128 && !(r < 15 && g < 15 && b < 15) && !(r > 240 && g > 240 && b > 240)) {
            totalR += r;
            totalG += g;
            totalB += b;
            count += 1;
          }
        }

        const avgR = count > 0 ? Math.round(totalR / count) : DEFAULT_FALLBACK_RGB[0];
        const avgG = count > 0 ? Math.round(totalG / count) : DEFAULT_FALLBACK_RGB[1];
        const avgB = count > 0 ? Math.round(totalB / count) : DEFAULT_FALLBACK_RGB[2];

        const legibleRGB = ensureLegibleRGB(avgR, avgG, avgB, 140);

        if (isMounted) {
          setColorState({
            rgb: legibleRGB,
            hex: rgbToHex(...legibleRGB),
            gradientStyle: createBannerGradient(...legibleRGB, 0.6),
            darkGradientStyle: createBannerGradient(...legibleRGB, 0.8),
            isLoading: false,
          });
        }
      } catch (err) {
        // Fallback on CORS error or canvas failure
        if (isMounted) {
          setColorState({
            rgb: DEFAULT_FALLBACK_RGB,
            hex: rgbToHex(...DEFAULT_FALLBACK_RGB),
            gradientStyle: createBannerGradient(...DEFAULT_FALLBACK_RGB),
            darkGradientStyle: createBannerGradient(...DEFAULT_FALLBACK_RGB, 0.75),
            isLoading: false,
          });
        }
      }
    };

    img.onerror = () => {
      if (isMounted) {
        setColorState({
          rgb: DEFAULT_FALLBACK_RGB,
          hex: rgbToHex(...DEFAULT_FALLBACK_RGB),
          gradientStyle: createBannerGradient(...DEFAULT_FALLBACK_RGB),
          darkGradientStyle: createBannerGradient(...DEFAULT_FALLBACK_RGB, 0.75),
          isLoading: false,
        });
      }
    };

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  return colorState;
}
