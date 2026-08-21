import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  GeoJSON as GeoJSONLayer,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { createClient } from "@/lib/supabase/client";
import { formatEventDateRange } from "@/lib/eventUtils";
import { formatStandardDate } from "@/utils/dateUtils";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Flame from "lucide-react/dist/esm/icons/flame";
import Users from "lucide-react/dist/esm/icons/users";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

// Campus center default
const DEFAULT_MAP_CENTER: [number, number] = [28.7041, 77.1025];
const DEFAULT_ZOOM = 15;

interface HeatmapEvent {
  id: string;
  title: string;
  intensity: number; // 0-1
  attendee_count: number;
  start_date: string;
  end_date: string;
  location?: string;
  club_name?: string;
  latitude: number;
  longitude: number;
  banner_url?: string | null;
}

interface CampusHeatmapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
  refreshInterval?: number; // ms, default 30000
}

// Helper: Create intensity-colored circle marker
function getHeatmapMarkerColor(intensity: number): string {
  if (intensity < 0.2) return "#3B82F6"; // Blue (low)
  if (intensity < 0.4) return "#10B981"; // Green (low-medium)
  if (intensity < 0.6) return "#F59E0B"; // Amber (medium)
  if (intensity < 0.8) return "#EF4444"; // Red (high)
  return "#DC2626"; // Dark red (very high)
}

function getHeatmapMarkerSize(attendeeCount: number): number {
  // Size based on attendee count: 10-50 attendees
  if (attendeeCount < 10) return 15;
  if (attendeeCount < 50) return 25;
  if (attendeeCount < 100) return 35;
  if (attendeeCount < 200) return 45;
  return 55;
}

function RecenterController({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center[0], center[1]]);
  }, [center[0], center[1], map]);

  return null;
}

export function CampusHeatmap({
  initialCenter = DEFAULT_MAP_CENTER,
  initialZoom = DEFAULT_ZOOM,
  className = "",
  refreshInterval = 30000,
}: CampusHeatmapProps) {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<HeatmapEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCenter, setCurrentCenter] = useState<[number, number]>(initialCenter);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const mapRef = useRef<any>(null);
  const markerClusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  // Fetch active heatmap events
  const fetchActiveHeatmap = useCallback(async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase.functions.invoke("get-active-heatmap");

      if (fetchError) throw fetchError;

      if (data && data.features) {
        const heatmapEvents: HeatmapEvent[] = data.features.map((feature: any) => ({
          id: feature.properties.id,
          title: feature.properties.title,
          intensity: feature.properties.intensity,
          attendee_count: feature.properties.attendee_count,
          start_date: feature.properties.start_date,
          end_date: feature.properties.end_date,
          location: feature.properties.location,
          club_name: feature.properties.club_name,
          latitude: feature.geometry.coordinates[1],
          longitude: feature.geometry.coordinates[0],
          banner_url: feature.properties.banner_url,
        }));

        setEvents(heatmapEvents);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error("Failed to fetch heatmap:", err);
      setError(err instanceof Error ? err.message : "Failed to load heatmap");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchActiveHeatmap();
    }
  }, [fetchActiveHeatmap]);

  // Auto-refresh heatmap
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveHeatmap();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchActiveHeatmap, refreshInterval]);

  // Group events by location to detect overlaps
  const groupedByLocation = useMemo(() => {
    const groups: Record<string, HeatmapEvent[]> = {};

    events.forEach((event) => {
      const key = `${event.latitude.toFixed(5)},${event.longitude.toFixed(5)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });

    return groups;
  }, [events]);

  // Calculate marker positions for overlapping events (spiral layout)
  const processedMarkers = useMemo(() => {
    const markers: Array<HeatmapEvent & { adjustedPos?: [number, number] }> = [];

    Object.entries(groupedByLocation).forEach(([, locationEvents]) => {
      if (locationEvents.length === 1) {
        markers.push(locationEvents[0]);
      } else {
        // Spiral layout for overlapping markers
        locationEvents.forEach((event, index) => {
          const angle = (index / locationEvents.length) * Math.PI * 2;
          const radius = 0.0001; // Slight offset in degrees (~10 meters)
          const adjustedLat = event.latitude + radius * Math.cos(angle);
          const adjustedLng = event.longitude + radius * Math.sin(angle);

          markers.push({
            ...event,
            adjustedPos: [adjustedLat, adjustedLng],
          });
        });
      }
    });

    return markers;
  }, [groupedByLocation]);

  const handleResetView = () => {
    setCurrentCenter(initialCenter);
  };

  const handleManualRefresh = () => {
    setLoading(true);
    fetchActiveHeatmap();
  };

  return (
    <div className={`relative flex flex-col ${className}`} data-testid="campus-heatmap-container">
      {/* Heatmap Header Controls */}
      <div className="z-[1000] mb-3 border-2 border-black bg-white p-3.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-1 items-center gap-2 min-w-[200px]">
            <Flame className="h-5 w-5 text-red-500" />
            <h2 className="font-display text-sm font-bold uppercase text-black">
              Live Campus Activity Heatmap
            </h2>
            <span className="rounded bg-lime border border-black px-2 py-1 font-mono text-xs font-bold">
              {events.length} Active {events.length === 1 ? "Event" : "Events"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-gray-600">
              Last updated:{" "}
              {lastRefresh.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              title="Refresh heatmap data"
              className="flex items-center gap-1 border-2 border-black bg-white px-2.5 py-1 font-mono text-xs font-bold hover:bg-cream disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleResetView}
              title="Reset to campus center"
              className="flex items-center gap-1 border-2 border-black bg-white px-2.5 py-1 font-mono text-xs font-bold hover:bg-cream"
            >
              Reset View
            </button>
          </div>
        </div>

        {/* Intensity Legend */}
        <div className="mt-2.5 flex flex-wrap items-center gap-3 border-t border-gray-300 pt-2.5">
          <span className="font-mono text-[10px] font-bold uppercase text-gray-600">
            Intensity Scale:
          </span>
          {[
            { intensity: 0.1, label: "1-5", color: "#3B82F6" },
            { intensity: 0.3, label: "5-50", color: "#10B981" },
            { intensity: 0.6, label: "50-100", color: "#F59E0B" },
            { intensity: 0.8, label: "100-200", color: "#EF4444" },
            { intensity: 1.0, label: "200+", color: "#DC2626" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded-full border border-black"
                style={{ backgroundColor: color }}
              />
              <span className="font-mono text-[10px]">{label} people</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map Container */}
      <div className="relative min-h-[500px] flex-1 overflow-hidden border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <MapContainer
          ref={mapRef}
          center={currentCenter}
          zoom={initialZoom}
          scrollWheelZoom={true}
          className="h-full w-full"
          data-testid="heatmap-leaflet-container"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterController center={currentCenter} />

          {/* Render heatmap markers with intensity colors */}
          {processedMarkers.map((event) => {
            const position: [number, number] = event.adjustedPos || [
              event.latitude,
              event.longitude,
            ];
            const color = getHeatmapMarkerColor(event.intensity);
            const size = getHeatmapMarkerSize(event.attendee_count);

            // Create custom circle icon
            const circleIcon = L.divIcon({
              className: "heatmap-marker",
              html: `
                <div style="
                  width: ${size}px;
                  height: ${size}px;
                  background: ${color};
                  border: 2px solid rgba(0,0,0,0.8);
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-weight: bold;
                  font-size: ${Math.max(size / 3, 8)}px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.2);
                  animation: pulse 2s infinite;
                ">
                  ${event.attendee_count}
                </div>
                <style>
                  @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                  }
                </style>
              `,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
              popupAnchor: [0, -(size / 2 + 10)],
            });

            return (
              <Marker
                key={`${event.id}-${position.join(",")}`}
                position={position}
                icon={circleIcon}
                eventHandlers={{
                  click: () => {
                    setCurrentCenter([event.latitude, event.longitude]);
                  },
                }}
              >
                <Popup
                  className="heatmap-popup min-w-[260px]"
                  data-testid={`heatmap-popup-${event.id}`}
                >
                  <div className="p-2 font-sans">
                    <h3 className="mb-1 font-display text-sm font-bold leading-tight text-black">
                      {event.title}
                    </h3>

                    {event.club_name && (
                      <p className="mb-1 font-mono text-[11px] font-semibold text-gray-700">
                        Hosted by {event.club_name}
                      </p>
                    )}

                    {/* Attendee Count & Intensity */}
                    <div className="mb-2 flex items-center gap-2 rounded bg-gray-100 p-1.5">
                      <Users className="h-4 w-4 text-blue-600" />
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-bold text-black">
                          {event.attendee_count} checked-in
                        </span>
                        <span className="font-mono text-[10px] text-gray-600">
                          {(event.intensity * 100).toFixed(0)}% intensity
                        </span>
                      </div>
                    </div>

                    {/* Date/Time */}
                    <div className="mb-1 flex items-start gap-1 font-mono text-[11px] text-gray-600">
                      <Calendar className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{formatEventDateRange(event.start_date, event.end_date)}</span>
                    </div>

                    {/* Location */}
                    {event.location && (
                      <div className="mb-2.5 flex items-start gap-1 font-mono text-[11px] text-gray-600">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                        <span>{event.location}</span>
                      </div>
                    )}

                    {/* CTA */}
                    <Link
                      to={`/events/${event.id}`}
                      className="neu-border neu-press inline-block w-full text-center bg-peach py-1.5 px-3 font-mono text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-yellow-300"
                    >
                      View Event →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Loading State */}
        {loading && (
          <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-white/85">
            <div className="flex flex-col items-center gap-2 border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-black border-t-transparent" />
              <span className="font-mono text-xs font-bold uppercase">
                Loading Live Activity...
              </span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute bottom-4 right-4 z-[1001] max-w-xs border-2 border-black bg-red-100 p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h4 className="font-display font-bold text-red-800">Error loading heatmap</h4>
            <p className="mt-1 font-mono text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && events.length === 0 && (
          <div className="absolute inset-0 z-[1001] flex items-center justify-center">
            <div className="border-2 border-black bg-white p-6 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Flame className="mx-auto h-12 w-12 text-gray-300 mb-2" />
              <p className="font-mono text-sm font-bold uppercase text-gray-700">
                No active events on campus right now
              </p>
              <p className="mt-1 font-mono text-xs text-gray-600">
                Check back soon for live activity!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
