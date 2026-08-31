import React, { useEffect, useRef } from "react";
import { GeoPoint } from "@/types/accessibility";
import { DispatcherInfo } from "@/types/accessibilityFulfillment";
import { MapPin, Navigation, Compass, ShieldCheck } from "lucide-react";

interface DispatcherLiveMapProps {
  destination: GeoPoint;
  destinationName: string;
  dispatcher?: DispatcherInfo;
  etaMinutes: number;
}

export const DispatcherLiveMap: React.FC<DispatcherLiveMapProps> = ({
  destination,
  destinationName,
  dispatcher,
  etaMinutes,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);

  useEffect(() => {
    let map: any = null;

    async function initMap() {
      if (!mapContainerRef.current) return;

      try {
        const L = await import("leaflet");
        // Ensure standard Leaflet CSS is present
        if (!document.getElementById("leaflet-css")) {
          const link = document.createElement("link");
          link.id = "leaflet-css";
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(link);
        }

        const centerLat = dispatcher
          ? (dispatcher.currentLocation.lat + destination.lat) / 2
          : destination.lat;
        const centerLng = dispatcher
          ? (dispatcher.currentLocation.lng + destination.lng) / 2
          : destination.lng;

        if (leafletMapRef.current) {
          leafletMapRef.current.remove();
        }

        map = L.map(mapContainerRef.current, {
          center: [centerLat, centerLng],
          zoom: 16,
          zoomControl: false,
          attributionControl: false,
        });

        leafletMapRef.current = map;

        // Dark theme map tile layer
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            maxZoom: 19,
            subdomains: "abcd",
          },
        ).addTo(map);

        // Custom Destination Icon
        const destIcon = L.divIcon({
          className: "custom-dest-pin",
          html: `<div style="background-color:#EF4444; width:28px; height:28px; border-radius:50%; border:3px solid white; display:flex; align-items:center; justify-content:center; box-shadow:0 0 15px rgba(239,68,68,0.7);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        L.marker([destination.lat, destination.lng], { icon: destIcon })
          .addTo(map)
          .bindPopup(`<b>${destinationName}</b><br/>Target Fulfillment Entrance`);

        // Dispatcher Live Pin & Polyline
        if (dispatcher) {
          const dispIcon = L.divIcon({
            className: "custom-disp-pin",
            html: `<div style="background-color:#3B82F6; width:34px; height:34px; border-radius:50%; border:3px solid white; display:flex; align-items:center; justify-content:center; box-shadow:0 0 20px rgba(59,130,246,0.9); animation: pulse 2s infinite;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="13" x="1" y="6" rx="2"/><polygon points="17 8 23 12 23 19 17 19 17 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          });

          L.marker(
            [dispatcher.currentLocation.lat, dispatcher.currentLocation.lng],
            { icon: dispIcon },
          )
            .addTo(map)
            .bindPopup(`<b>${dispatcher.name}</b><br/>En Route - ${etaMinutes} mins away`);

          // Draw Route Line
          const latlngs = [
            [dispatcher.currentLocation.lat, dispatcher.currentLocation.lng],
            [
              (dispatcher.currentLocation.lat + destination.lat) / 2 + 0.0002,
              (dispatcher.currentLocation.lng + destination.lng) / 2 - 0.0003,
            ],
            [destination.lat, destination.lng],
          ];

          L.polyline(latlngs as any, {
            color: "#3B82F6",
            weight: 5,
            opacity: 0.8,
            dashArray: "10, 8",
          }).addTo(map);

          map.fitBounds(L.latLngBounds(latlngs as any).pad(0.2));
        }
      } catch (e) {
        console.warn("Leaflet map initialization skipped or failed:", e);
      }
    }

    initMap();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [destination, dispatcher, etaMinutes]);

  return (
    <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-inner">
      {/* Map Element Container */}
      <div ref={mapContainerRef} className="h-full w-full z-0" />

      {/* Map Overlay Badge Info */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-xl bg-slate-900/90 px-3 py-1.5 border border-slate-800 backdrop-blur-md shadow-lg text-xs font-semibold text-white">
        <Navigation className="h-4 w-4 text-blue-400 animate-pulse" />
        <span>Live Dispatch Route Tracker</span>
      </div>

      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between rounded-xl bg-slate-900/90 px-4 py-2 border border-slate-800 backdrop-blur-md shadow-lg text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-red-400" />
          <span className="font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
            {destinationName}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-blue-400 font-bold">
          <Compass className="h-3.5 w-3.5" />
          <span>{dispatcher ? `ETA ${etaMinutes} mins` : "On Site"}</span>
        </div>
      </div>
    </div>
  );
};
