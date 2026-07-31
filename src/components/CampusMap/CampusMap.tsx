import { useEffect, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { useHeatmapData } from "./hooks/useHeatmapData";
import { useMapView } from "./hooks/useMapView";
import { HeatmapLayer } from "./HeatmapLayer";
import { EventPins } from "./EventPins";
import { MapToggle } from "./MapToggle";
import { HeatmapLegend } from "./HeatmapLegend";
import { LoadingOverlay } from "./LoadingOverlay";

// Leaflet requires these to fix default icon issues
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const THRESHOLD = 1000;

interface CampusMapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
}

export function CampusMap({
  initialCenter = [40.7128, -74.006], // Default center
  initialZoom = 14,
  className = "w-full h-full",
}: CampusMapProps) {
  const { events, heatmapData, isLoading, error } = useHeatmapData();
  const { view, setView, toggleView } = useMapView("pins");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // If we have a massive amount of events, default to heatmap to avoid performance issues
    if (!initialized && events.length >= THRESHOLD) {
      setView("heatmap");
      setInitialized(true);
    } else if (!initialized && events.length > 0) {
      setInitialized(true);
    }
  }, [events, initialized, setView]);

  return (
    <div className={`relative ${className}`}>
      {isLoading && <LoadingOverlay />}
      {!isLoading && events.length === 0 && <LoadingOverlay isEmpty />}

      {!isLoading && events.length > 0 && (
        <>
          <MapToggle view={view} onToggle={toggleView} />
          {view === "heatmap" && <HeatmapLegend />}
        </>
      )}

      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {!isLoading &&
          events.length > 0 &&
          (view === "heatmap" ? (
            <HeatmapLayer points={heatmapData} />
          ) : (
            <EventPins events={events} />
          ))}
      </MapContainer>
    </div>
  );
}
