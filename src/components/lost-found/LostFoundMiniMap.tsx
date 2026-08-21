import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Default Icon
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// @ts-expect-error - fixing leaflet prototype issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

interface LostFoundMiniMapProps {
  latitude: number;
  longitude: number;
  title: string;
  floorDetails?: string | null;
  className?: string;
}

export function LostFoundMiniMap({
  latitude,
  longitude,
  title,
  floorDetails,
  className,
}: LostFoundMiniMapProps) {
  const center = useMemo<[number, number]>(() => [latitude, longitude], [latitude, longitude]);

  return (
    <div className={className}>
      <div className="h-40 w-full overflow-hidden border-2 border-black">
        <MapContainer
          center={center}
          zoom={17}
          scrollWheelZoom={false}
          dragging={false}
          zoomControl={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={center}>
            <Popup>
              <div className="font-mono text-xs">
                <p className="font-bold">{title}</p>
                {floorDetails && <p className="text-black/60 mt-1">{floorDetails}</p>}
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}
