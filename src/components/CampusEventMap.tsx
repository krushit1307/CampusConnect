import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { createClient } from "@/lib/supabase/client";
import { parseCoordinates, formatEventDateRange } from "@/lib/eventUtils";
import { formatStandardDate } from "@/utils/dateUtils";
import { MapPin, Calendar, Search, RefreshCw } from "lucide-react";

// Campus center default (Delhi campus or customizable)
const DEFAULT_MAP_CENTER: [number, number] = [28.7041, 77.1025];

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface MapEventItem {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  event_date?: string | null;
  banner_url?: string | null;
  club_name?: string | null;
  clubs?: { name: string } | { name: string }[] | null;
  rsvp_count?: number;
}

export interface CampusEventMapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
  events?: MapEventItem[];
  showSearch?: boolean;
}

function RecenterController({ center }: { center: [number, number] }) {
  const map = useMap();
  const lat = center[0];
  const lng = center[1];

  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);

  return null;
}

function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    // Remove existing layer if any
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (points.length > 0 && (L as any).heatLayer) {
      layerRef.current = (L as any)
        .heatLayer(points, {
          radius: 25,
          blur: 15,
          maxZoom: 17,
        })
        .addTo(map);
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points]);

  return null;
}

export function CampusEventMap({
  initialCenter = DEFAULT_MAP_CENTER,
  initialZoom = 15,
  className = "",
  events: initialEvents,
  showSearch = true,
}: CampusEventMapProps) {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<MapEventItem[]>(initialEvents || []);
  const [loading, setLoading] = useState<boolean>(!initialEvents);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentCenter, setCurrentCenter] = useState<[number, number]>(initialCenter);
  const [viewMode, setViewMode] = useState<"pins" | "heatmap">(
    initialEvents && initialEvents.length > 500 ? "heatmap" : "pins",
  );

  // Fetch upcoming events from Supabase if not provided via props
  const fetchUpcomingEvents = useCallback(async () => {
    if (initialEvents && initialEvents.length > 0) return;

    try {
      const nowIso = new Date().toISOString();
      const { data, error: fetchError } = await supabase
        .from("events")
        .select(
          `
          id,
          title,
          description,
          location,
          latitude,
          longitude,
          start_date,
          end_date,
          event_date,
          banner_url,
          clubs ( name ),
          event_rsvps ( count )
        `,
        )
        .or(`start_date.gte.${nowIso},event_date.gte.${nowIso},start_date.is.null`)
        .order("created_at", { ascending: false })
        .limit(100);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (data) {
        const formatted: MapEventItem[] = data.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          location: item.location,
          latitude: item.latitude,
          longitude: item.longitude,
          start_date: item.start_date,
          end_date: item.end_date,
          event_date: item.event_date,
          banner_url: item.banner_url,
          club_name: Array.isArray(item.clubs) ? item.clubs[0]?.name : item.clubs?.name,
          rsvp_count:
            Array.isArray(item.event_rsvps) && item.event_rsvps.length > 0
              ? item.event_rsvps[0].count || 0
              : typeof item.event_rsvps === "object" && item.event_rsvps?.count
                ? item.event_rsvps.count
                : 0,
        }));
        setEvents(formatted);
        if (formatted.length > 500 && !initialEvents) {
          setViewMode("heatmap");
        }
      }
    } catch (err) {
      console.error("Failed to fetch events for campus map:", err);
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [initialEvents, supabase]);

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!initialEvents && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchUpcomingEvents();
    }
  }, [initialEvents, fetchUpcomingEvents]);

  // Process events and map each event to valid coordinates
  const mappedEvents = useMemo(() => {
    return events
      .map((event) => {
        let lat: number | undefined = event.latitude ?? undefined;
        let lng: number | undefined = event.longitude ?? undefined;

        if ((lat == null || lng == null) && event.location) {
          const parsed = parseCoordinates(event.location);
          if (parsed.isCoordinates && parsed.isValid && parsed.lat != null && parsed.lng != null) {
            lat = parsed.lat;
            lng = parsed.lng;
          }
        }

        if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
          return {
            ...event,
            coords: [lat, lng] as [number, number],
          };
        }
        return null;
      })
      .filter((e): e is MapEventItem & { coords: [number, number] } => e !== null);
  }, [events]);

  // Filter mapped events based on search query
  const filteredEvents = useMemo(() => {
    if (!searchTerm.trim()) return mappedEvents;
    const term = searchTerm.toLowerCase().trim();
    return mappedEvents.filter(
      (event) =>
        event.title.toLowerCase().includes(term) ||
        (event.location && event.location.toLowerCase().includes(term)) ||
        (event.club_name && event.club_name.toLowerCase().includes(term)),
    );
  }, [mappedEvents, searchTerm]);

  const heatPoints = useMemo(() => {
    const maxRsvps = Math.max(1, ...filteredEvents.map((e) => e.rsvp_count || 0));
    return filteredEvents.map((event) => {
      const weight = (event.rsvp_count || 0) / maxRsvps;
      const finalWeight = Math.max(0.1, weight);
      return [event.coords[0], event.coords[1], finalWeight] as [number, number, number];
    });
  }, [filteredEvents]);

  // Helper for displaying dates nicely in popup
  const getEventDateText = (event: MapEventItem): string => {
    if (event.start_date && event.end_date) {
      return formatEventDateRange(event.start_date, event.end_date);
    }
    const d = event.start_date || event.event_date;
    if (!d) return "Date TBD";
    return formatStandardDate(d, "MMM d, yyyy h:mm a");
  };

  const getClubName = (event: MapEventItem): string | null => {
    if (event.club_name) return event.club_name;
    if (Array.isArray(event.clubs) && event.clubs.length > 0) return event.clubs[0].name;
    if (event.clubs && typeof event.clubs === "object" && "name" in event.clubs) {
      return (event.clubs as { name: string }).name;
    }
    return null;
  };

  const handleResetView = () => {
    setCurrentCenter(initialCenter);
  };

  return (
    <div className={`relative flex flex-col ${className}`} data-testid="campus-event-map-container">
      {/* Search & Filter Bar */}
      {showSearch && (
        <div className="z-[1000] mb-3 flex flex-wrap items-center justify-between gap-2 border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="relative flex flex-1 items-center min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search map events by title, venue..."
              className="w-full border-2 border-black py-1.5 pl-9 pr-3 font-mono text-xs font-bold uppercase transition-colors focus:bg-amber-50 focus:outline-none"
              data-testid="campus-map-search-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="border border-black bg-peach px-2.5 py-1 font-mono text-xs font-bold">
              {filteredEvents.length} {filteredEvents.length === 1 ? "Event" : "Events"} On Map
            </span>
            <button
              onClick={() => setViewMode((v) => (v === "pins" ? "heatmap" : "pins"))}
              title="Toggle View Mode"
              className="flex items-center gap-1 border-2 border-black bg-white px-2.5 py-1 font-mono text-xs font-bold hover:bg-cream active:translate-y-0.5"
            >
              {viewMode === "pins" ? "Show Heatmap" : "Show Pins"}
            </button>
            <button
              onClick={handleResetView}
              title="Reset Campus View"
              className="flex items-center gap-1 border-2 border-black bg-white px-2.5 py-1 font-mono text-xs font-bold hover:bg-cream active:translate-y-0.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset View
            </button>
          </div>
        </div>
      )}

      {/* Map Display Container */}
      <div className="relative min-h-[450px] w-full flex-1 overflow-hidden border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <MapContainer
          center={currentCenter}
          zoom={initialZoom}
          scrollWheelZoom={true}
          className="h-full w-full min-h-[450px]"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterController center={currentCenter} />
          {viewMode === "heatmap" && <HeatmapLayer points={heatPoints} />}

          {viewMode === "pins" &&
            filteredEvents.map((event) => {
              const clubName = getClubName(event);
              const dateStr = getEventDateText(event);

              return (
                <Marker
                  key={event.id}
                  position={event.coords}
                  icon={markerIcon}
                  eventHandlers={{
                    click: () => {
                      setCurrentCenter(event.coords);
                    },
                  }}
                >
                  <Popup className="campus-map-popup min-w-[220px]">
                    <div className="p-1 font-sans" data-testid={`event-popup-${event.id}`}>
                      {event.banner_url && (
                        <div className="mb-2 overflow-hidden border border-black">
                          <img
                            src={event.banner_url}
                            alt={event.title}
                            className="h-24 w-full object-cover"
                          />
                        </div>
                      )}
                      <h3 className="mb-1 font-display text-sm font-bold leading-tight text-black">
                        {event.title}
                      </h3>

                      {clubName && (
                        <p className="mb-1 font-mono text-[11px] font-semibold text-gray-700">
                          Hosted by {clubName}
                        </p>
                      )}

                      <div className="mb-1.5 flex items-start gap-1 font-mono text-[11px] text-gray-600">
                        <Calendar className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{dateStr}</span>
                      </div>

                      {event.location && (
                        <div className="mb-2.5 flex items-start gap-1 font-mono text-[11px] text-gray-600">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}

                      <Link
                        to={`/events/${event.id}`}
                        className="neu-border neu-press inline-block w-full text-center bg-peach py-1.5 px-3 font-mono text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-yellow-300"
                      >
                        View Event Page →
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
        </MapContainer>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/85">
            <div className="flex flex-col items-center gap-2 border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-black border-t-transparent" />
              <span className="font-mono text-xs font-bold uppercase">
                Loading Campus Events...
              </span>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/90 p-4">
            <div className="max-w-md border-2 border-black bg-red-100 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h4 className="font-display font-bold text-red-800">Failed to load map events</h4>
              <p className="mt-1 font-mono text-xs text-red-700">{error}</p>
              <button
                onClick={fetchUpcomingEvents}
                className="mt-3 border-2 border-black bg-white px-3 py-1 font-mono text-xs font-bold uppercase hover:bg-cream"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty state overlay */}
        {!loading && !error && filteredEvents.length === 0 && (
          <div className="absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2 border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="font-mono text-xs font-bold uppercase text-gray-700">
              No upcoming events with location markers found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
