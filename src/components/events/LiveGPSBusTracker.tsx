import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import Navigation from "lucide-react/dist/esm/icons/navigation";
import Play from "lucide-react/dist/esm/icons/play";
import Square from "lucide-react/dist/esm/icons/square";
import Bus from "lucide-react/dist/esm/icons/bus";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import L from "leaflet";

import "leaflet/dist/leaflet.css";

// Create custom Bus Marker Icon using high-contrast svg
const busIcon = L.divIcon({
  html: `<div class="bg-yellow-400 border-2 border-black p-1.5 rounded-full shadow-lg flex items-center justify-center w-8 h-8"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-black"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v10c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M13 17h2"/><path d="M9 17h4"/><path d="M19 10h-6"/></svg></div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Helper component to center map on bus location
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

interface BusTrackerProps {
  eventId: string;
  isCaptain: boolean;
  eventTitle: string;
}

export const LiveGPSBusTracker: React.FC<BusTrackerProps> = ({
  eventId,
  isCaptain,
  eventTitle,
}) => {
  const supabase = createClient();
  const [active, setActive] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const watchId = useRef<number | null>(null);
  const broadcastInterval = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to real-time event updates for live GPS changes
  useEffect(() => {
    const channel = supabase
      .channel(`bus-tracker:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${eventId}`,
        },
        (payload: any) => {
          const updated = payload.new;
          if (updated) {
            setActive(updated.bus_tracker_active);
            setLatitude(updated.bus_latitude);
            setLongitude(updated.bus_longitude);
          }
        }
      )
      .subscribe();

    // Fetch initial bus status
    const fetchBusStatus = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("bus_tracker_active, bus_latitude, bus_longitude")
        .eq("id", eventId)
        .single();

      if (!error && data) {
        setActive(data.bus_tracker_active);
        setLatitude(data.bus_latitude);
        setLongitude(data.bus_longitude);
      }
    };

    fetchBusStatus();

    return () => {
      supabase.removeChannel(channel);
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      if (broadcastInterval.current) {
        clearInterval(broadcastInterval.current);
      }
    };
  }, [eventId, supabase]);

  const startBroadcasting = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    let lastLat: number | null = null;
    let lastLng: number | null = null;

    // Watch position from GPS sensor
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        lastLat = position.coords.latitude;
        lastLng = position.coords.longitude;
        setLatitude(lastLat);
        setLongitude(lastLng);
      },
      (error) => {
        console.error("GPS Watch error:", error);
        toast.error("Failed to retrieve GPS location coordinates");
      },
      { enableHighAccuracy: true }
    );

    // Periodically stream coordinates to database (throttled every 5 seconds)
    broadcastInterval.current = setInterval(async () => {
      if (lastLat !== null && lastLng !== null) {
        const { error } = await supabase.rpc("update_bus_location", {
          p_event_id: eventId,
          p_latitude: lastLat,
          p_longitude: lastLng,
        });
        if (error) {
          console.error("Error broadcasting location:", error.message);
        }
      }
    }, 5000);

    setActive(true);
    setLoading(false);
    toast.success("Bus Location Broadcasting Active");

    // Automatically auto-terminate after a 4-hour safety window
    setTimeout(() => {
      stopBroadcasting();
    }, 4 * 60 * 60 * 1000);
  };

  const stopBroadcasting = async () => {
    setLoading(true);
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (broadcastInterval.current) {
      clearInterval(broadcastInterval.current);
      broadcastInterval.current = null;
    }

    const { error } = await supabase.rpc("terminate_bus_tracker", {
      p_event_id: eventId,
    });

    if (error) {
      toast.error("Could not cleanly terminate broadcast");
    } else {
      setActive(false);
      setLatitude(null);
      setLongitude(null);
      toast.success("Broadcast Terminated cleanly");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4 rounded-lg border-2 border-black bg-cream p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-2">
        <div className="flex items-center gap-2">
          <Bus className="h-5 w-5 text-black" />
          <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-black">
            Real-time GPS Bus Tracker
          </h3>
        </div>
        {isCaptain && (
          <div className="flex items-center gap-2">
            {!active ? (
              <button
                type="button"
                disabled={loading}
                onClick={startBroadcasting}
                className="neu-border bg-lime hover:bg-lime/80 px-3 py-1 font-mono text-xs font-bold uppercase text-black flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
              >
                <Play className="h-3.5 w-3.5" />
                Start Broadcasting
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={stopBroadcasting}
                className="neu-border bg-red-500 text-white hover:bg-red-600 px-3 py-1 font-mono text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
              >
                <Square className="h-3.5 w-3.5" />
                Stop (Arrived)
              </button>
            )}
          </div>
        )}
      </div>

      {active && latitude !== null && longitude !== null ? (
        <div className="space-y-2">
          <div className="h-80 w-full rounded border-2 border-black overflow-hidden relative">
            <MapContainer
              center={[latitude, longitude]}
              zoom={15}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[latitude, longitude]} icon={busIcon}>
                <Popup>
                  <span className="font-mono text-xs font-bold">{eventTitle} Charter Bus</span>
                </Popup>
              </Marker>
              <RecenterMap lat={latitude} lng={longitude} />
            </MapContainer>
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] text-gray-500">
            <span>Coordinates: {latitude.toFixed(5)}, {longitude.toFixed(5)}</span>
            <span className="text-lime-700 font-bold animate-pulse flex items-center gap-1">
              <Navigation className="h-3 w-3 rotate-45" /> Live Streaming Active
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 bg-white border-2 border-dashed border-gray-300 text-center rounded">
          <Bus className="h-10 w-10 text-gray-300 mb-2" />
          <p className="font-mono text-xs text-gray-500">
            {active ? "Waiting for captain GPS coordinates..." : "Bus tracking is currently offline."}
          </p>
        </div>
      )}
    </div>
  );
};
