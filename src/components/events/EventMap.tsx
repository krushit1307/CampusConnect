import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Link } from "react-router-dom";
import format from "date-fns/format";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Users from "lucide-react/dist/esm/icons/users";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

// Fix Leaflet's default icon issue with bundlers
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// @ts-expect-error - fixing leaflet prototype issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
});

interface EventItem {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
  banner_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface EventMapProps {
  events: EventItem[];
}

export default function EventMap({ events }: EventMapProps) {
  // Filter events that actually have coordinates
  const mappableEvents = events.filter(
    (event) => typeof event.latitude === "number" && typeof event.longitude === "number",
  );

  // If there are no events at all to show on the map, provide an empty state
  if (mappableEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] border-4 border-black bg-white/50 p-8 text-center neu-border">
        <MapPin className="h-16 w-16 mb-4 text-gray-400" />
        <h3 className="text-xl font-bold font-display uppercase tracking-wider mb-2">
          No map locations found
        </h3>
        <p className="text-gray-600 max-w-md">
          There are currently no upcoming events with valid location coordinates.
        </p>
      </div>
    );
  }

  // Calculate dynamic center based on available events, or fallback to generic coordinates (e.g. general NYC campus coords)
  const centerLat =
    mappableEvents.reduce((sum, e) => sum + (e.latitude || 0), 0) / mappableEvents.length ||
    40.7128;
  const centerLng =
    mappableEvents.reduce((sum, e) => sum + (e.longitude || 0), 0) / mappableEvents.length ||
    -74.006;

  return (
    <div className="h-full w-full relative z-0 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={15}
        className="h-full w-full min-h-[500px]"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={50}>
          {mappableEvents.map((event) => (
            <Marker key={event.id} position={[event.latitude!, event.longitude!]}>
              <Popup className="neu-popup">
                <div className="flex flex-col gap-2 max-w-[250px]">
                  {event.banner_url && (
                    <img
                      src={event.banner_url}
                      alt={event.title}
                      className="w-full h-24 object-cover border-2 border-black"
                    />
                  )}
                  <Link
                    to={`/events/${event.id}`}
                    className="font-bold text-base hover:underline line-clamp-2"
                  >
                    {event.title}
                  </Link>

                  <div className="flex flex-col gap-1 text-sm text-gray-600">
                    {event.event_date && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>{format(new Date(event.event_date), "MMM d, h:mm a")}</span>
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{event.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Custom styles to override leaflet popups with our brutalist theme */}
      <style>{`
        .neu-popup .leaflet-popup-content-wrapper {
          border: 3px solid black;
          border-radius: 0;
          box-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
          padding: 0;
        }
        .neu-popup .leaflet-popup-content {
          margin: 12px;
        }
        .neu-popup .leaflet-popup-tip {
          border: 3px solid black;
          border-top: none;
          border-left: none;
        }
      `}</style>
    </div>
  );
}
