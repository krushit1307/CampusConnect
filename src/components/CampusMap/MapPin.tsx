// src/components/CampusMap/MapPin.tsx
import React, { useState } from "react";
import { MapEvent, EventPopover } from "./EventPopover";
import { cn } from "../../lib/utils";
import { MapPin as MapPinIcon } from "lucide-react";

interface MapPinProps {
  event: MapEvent;
  x: number;
  y: number;
  scale: number;
  onViewDetails: (eventId: string) => void;
}

/**
 * Animated pin rendered at absolute X/Y coordinates over the SVG map.
 * Uses CSS transforms to remain perfectly sized regardless of the current zoom level.
 */
export const MapPin: React.FC<MapPinProps> = ({ event, x, y, scale, onViewDetails }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Counter-scale the pin so it doesn't grow massive when the user zooms in on the map
  const counterScale = 1 / scale;

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -100%) scale(${counterScale})`,
        transformOrigin: "bottom center",
        transition: "transform 0.1s linear",
        zIndex: isOpen ? 50 : 10,
      }}
    >
      <EventPopover
        event={event}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onViewDetails={() => onViewDetails(event.id)}
      >
        <button
          className={cn(
            "group relative flex flex-col items-center focus:outline-none transition-transform hover:scale-110 active:scale-95",
            isOpen && "scale-110",
          )}
          aria-label={`View details for ${event.title}`}
        >
          {/* Pulse animation ring */}
          <span
            className="absolute bottom-0 w-6 h-6 rounded-full opacity-75 animate-ping"
            style={{ backgroundColor: event.color }}
          />

          {/* Pin Icon */}
          <div
            className="relative z-10 p-1.5 rounded-full shadow-lg border-2 border-white transition-colors"
            style={{ backgroundColor: event.color }}
          >
            <MapPinIcon className="w-5 h-5 text-white fill-white" />
          </div>

          {/* Pin Drop Shadow/Tail */}
          <div className="w-2 h-2 bg-black/30 rounded-full blur-sm mt-0.5" />
        </button>
      </EventPopover>
    </div>
  );
};
