// src/hooks/useMapCoordinates.ts
import { useCallback } from "react";

export interface PinCoordinate {
  id: string;
  x: number; // Percentage (0-100) relative to SVG viewBox
  y: number; // Percentage (0-100) relative to SVG viewBox
  buildingName: string;
}

/**
 * Translates raw percentage coordinates (saved by admins clicking on the map)
 * into absolute pixel positions based on the current rendered size of the SVG container.
 *
 * This avoids the mathematical complexity of translating real-world GPS lat/lng
 * into flat SVG coordinates. Instead, admins simply click the SVG to "Save Pin Location"
 * as raw percentages (e.g., `left: 45%, top: 60%`).
 */
export const useMapCoordinates = () => {
  const getAbsolutePosition = useCallback(
    (pin: PinCoordinate, containerWidth: number, containerHeight: number) => {
      return {
        left: (pin.x / 100) * containerWidth,
        top: (pin.y / 100) * containerHeight,
      };
    },
    [],
  );

  const getPercentageFromEvent = useCallback(
    (e: React.MouseEvent<SVGSVGElement>, containerRect: DOMRect) => {
      const x = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      const y = ((e.clientY - containerRect.top) / containerRect.height) * 100;

      // Clamp between 0 and 100 to prevent pins from being placed outside the map bounds
      return {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      };
    },
    [],
  );

  return {
    getAbsolutePosition,
    getPercentageFromEvent,
  };
};
