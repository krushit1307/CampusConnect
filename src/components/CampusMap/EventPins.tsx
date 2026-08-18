import { Marker, Popup } from "react-leaflet";
import { ActiveEventMapData } from "@/types/heatmap";

interface EventPinsProps {
  events: ActiveEventMapData[];
}

export function EventPins({ events }: EventPinsProps) {
  // Assuming default Leaflet markers. Can be swapped with custom icons if needed.
  return (
    <>
      {events.map((event) => (
        <Marker key={event.id} position={[event.lat, event.lng]}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold mb-1">Active Event</p>
              <p>RSVPs: {event.rsvpCount}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
