import { useCallback, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import Crosshair from "lucide-react/dist/esm/icons/crosshair";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon issue with bundlers (same fix used across the app's other maps)
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// @ts-expect-error - fixing leaflet prototype issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006]; // generic campus fallback

export const MIN_GEOFENCE_RADIUS_METERS = 10;
export const MAX_GEOFENCE_RADIUS_METERS = 5000;
export const DEFAULT_GEOFENCE_RADIUS_METERS = 100;

interface GeofenceMapPickerProps {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  radiusMeters: number;
  onChange: (next: { latitude: number; longitude: number }) => void;
  className?: string;
}

function ClickToDropPin({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Interactive map used in the event creation form so organizers can drop a
 * pin at the exact spot the geofence should be centered on, and preview the
 * check-in radius as a circle overlay. Click/tap anywhere on the map to move
 * the pin; the radius itself is controlled by the parent (a slider next to
 * this component), so the circle here is just a live preview.
 */
export function GeofenceMapPicker({
  latitude,
  longitude,
  radiusMeters,
  onChange,
  className,
}: GeofenceMapPickerProps) {
  const [locating, setLocating] = useState(false);
  const hasPin = typeof latitude === "number" && typeof longitude === "number";
  const center = useMemo<[number, number]>(
    () => (hasPin ? [latitude as number, longitude as number] : DEFAULT_CENTER),
    [hasPin, latitude, longitude],
  );

  const handlePick = useCallback(
    (lat: number, lng: number) => {
      onChange({ latitude: lat, longitude: lng });
    },
    [onChange],
  );

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePick(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [handlePick]);

  return (
    <div className={className}>
      <div className="relative h-64 w-full overflow-hidden border-2 border-black">
        <MapContainer
          center={center}
          zoom={hasPin ? 17 : 15}
          className="h-full w-full"
          key={hasPin ? "pinned" : "unpinned"}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToDropPin onPick={handlePick} />
          {hasPin && (
            <>
              <Marker
                position={center}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target as L.Marker;
                    const pos = marker.getLatLng();
                    handlePick(pos.lat, pos.lng);
                  },
                }}
              />
              <Circle
                center={center}
                radius={radiusMeters}
                pathOptions={{ color: "#0d9488", fillColor: "#2dd4bf", fillOpacity: 0.2 }}
              />
            </>
          )}
        </MapContainer>

        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="neu-border neu-press absolute bottom-2 right-2 z-[1000] flex items-center gap-1.5 bg-white px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        >
          <Crosshair className="h-3 w-3" />
          {locating ? "Locating..." : "Use my location"}
        </button>
      </div>

      <p className="mt-1.5 flex items-center gap-1 font-mono text-xs text-black/50">
        <MapPin className="h-3 w-3 shrink-0" />
        {hasPin
          ? `Pin set at ${(latitude as number).toFixed(5)}, ${(longitude as number).toFixed(5)} — click the map or drag the pin to adjust.`
          : "Click anywhere on the map to drop a pin at the check-in location."}
      </p>
    </div>
  );
}
