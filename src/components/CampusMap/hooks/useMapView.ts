import { useState, useCallback } from "react";

export type MapViewType = "pins" | "heatmap";

export function useMapView(initialView: MapViewType = "pins") {
  const [view, setView] = useState<MapViewType>(initialView);

  const toggleView = useCallback(() => {
    setView((prev) => (prev === "pins" ? "heatmap" : "pins"));
  }, []);

  return {
    view,
    setView,
    toggleView,
  };
}
