import { useCallback, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import Crosshair from "lucide-react/dist/esm/icons/crosshair";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon issue with bundlers
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// @ts-expect-error - fixing leaflet prototype issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006]; // generic campus fallback

interface LostFoundMapPickerProps {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  onChange: (lat: number | null, lng: number | null) => void;
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

export function LostFoundMapPicker({
  latitude,
  longitude,
  onChange,
  className,
}: LostFoundMapPickerProps) {
  const [locating, setLocating] = useState(false);
  const hasPin = typeof latitude === "number" && typeof longitude === "number";
  const center = useMemo<[number, number]>(
    () => (hasPin ? [latitude as number, longitude as number] : DEFAULT_CENTER),
    [hasPin, latitude, longitude],
  );

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [onChange]);

  return (
    <div className={className}>
      <div className="relative h-60 w-full overflow-hidden border-2 border-black">
        <MapContainer
          center={center}
          zoom={hasPin ? 17 : 15}
          className="h-full w-full"
          key={hasPin ? `${latitude}-${longitude}` : "unpinned"}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToDropPin onPick={onChange} />
          {hasPin && (
            <Marker
              position={center}
              draggable
              eventHandlers={{
                dragend(e) {
                  const marker = e.target;
                  const position = marker.getLatLng();
                  onChange(position.lat, position.lng);
                },
              }}
            />
          )}
        </MapContainer>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="absolute bottom-4 right-4 z-[1000] flex items-center justify-center border-2 border-black bg-[#ffde00] p-2 hover:bg-[#ffde00]/80 disabled:opacity-50"
          title="Use current location"
        >
          <Crosshair className={`h-5 w-5 ${locating ? "animate-spin" : ""}`} />
        </button>
      </div>
      {hasPin && (
        <div className="mt-2 flex items-center justify-between text-xs font-mono text-black/60">
          <span>Lat: {latitude?.toFixed(6)}, Lng: {longitude?.toFixed(6)}</span>
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className="text-red-600 hover:underline"
          >
            Clear Pin
          </button>
        </div>
      )}
    </div>
  );
}
