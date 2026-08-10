import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import { HeatmapPoint, HeatmapOptions } from "@/types/heatmap";

interface HeatmapLayerProps {
  points: HeatmapPoint[];
  options?: HeatmapOptions;
}

export function HeatmapLayer({ points, options = {} }: HeatmapLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!map) return;

    const defaultOptions = {
      radius: 25,
      blur: 15,
      maxZoom: 18,
      gradient: {
        0.0: "blue",
        0.2: "cyan",
        0.4: "green",
        0.6: "yellow",
        0.8: "orange",
        1.0: "red",
      },
    };

    const finalOptions = { ...defaultOptions, ...options };

    // Create the heat layer
    const heatLayer = (
      L as unknown as { heatLayer: (points: HeatmapPoint[], options: HeatmapOptions) => L.Layer }
    ).heatLayer(points, finalOptions);
    layerRef.current = heatLayer;

    // Add to map
    heatLayer.addTo(map);

    return () => {
      // Cleanup on unmount
      if (layerRef.current && map) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [map, points, options]);

  return null;
}
