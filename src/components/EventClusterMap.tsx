import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createClient } from "@/lib/supabase/client";
import { formatStandardDate } from "@/utils/dateUtils";

interface EventCluster {
  cluster_id: number;
  event_count: number;
  center_lat: number;
  center_lng: number;
  event_ids: string[];
  titles: string[];
}

interface EventData {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  latitude: number;
  longitude: number;
  start_date: string | null;
  end_date: string | null;
  club_name: string | null;
  banner_url: string | null;
}

interface ClusterMapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
}

function MapEventHandler({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => {
      onBoundsChange(map.getBounds());
    },
    zoomend: () => {
      onBoundsChange(map.getBounds());
    },
  });
  return null;
}

function ClusterMarker({
  cluster,
  events,
  onClick,
}: {
  cluster: EventCluster;
  events: EventData[];
  onClick: (eventIds: string[]) => void;
}) {
  // Determine color based on cluster size
  const getColor = (count: number) => {
    if (count >= 20) return "#ef4444"; // red
    if (count >= 10) return "#f97316"; // orange
    if (count >= 5) return "#eab308"; // yellow
    return "#22c55e"; // green
  };

  // Calculate radius based on cluster size and zoom
  const getRadius = (count: number) => {
    const baseSize = 30;
    const sizePerEvent = Math.min(5, count);
    return Math.min(baseSize + sizePerEvent * 3, 60);
  };

  const color = getColor(cluster.event_count);
  const radius = getRadius(cluster.event_count);

  // Get events in this cluster
  const clusterEvents = events.filter((e) => cluster.event_ids.includes(e.id));

  return (
    <CircleMarker
      center={[cluster.center_lat, cluster.center_lng]}
      radius={radius}
      pathOptions={{
        color: "#000",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.8,
      }}
      eventHandlers={{
        click: () => onClick(cluster.event_ids),
      }}
    >
      <Popup>
        <div className="min-w-48 p-2">
          <div className="mb-2 border-b border-gray-300 pb-2">
            <span className="text-lg font-bold" style={{ color }}>
              {cluster.event_count} Events
            </span>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {clusterEvents.slice(0, 5).map((event) => (
              <div key={event.id} className="text-sm">
                <div className="font-semibold truncate">{event.title}</div>
                {event.club_name && <div className="text-xs text-gray-600">{event.club_name}</div>}
              </div>
            ))}
            {clusterEvents.length > 5 && (
              <div className="text-xs text-gray-500">+{clusterEvents.length - 5} more events</div>
            )}
          </div>
        </div>
      </Popup>
    </CircleMarker>
  );
}

function SingleEventMarker({ event, onClick }: { event: EventData; onClick: () => void }) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBD";
    return formatStandardDate(dateStr, "MMM d, h:mm a");
  };

  return (
    <CircleMarker
      center={[event.latitude, event.longitude]}
      radius={8}
      pathOptions={{
        color: "#000",
        weight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.9,
      }}
      eventHandlers={{
        click: onClick,
      }}
    >
      <Popup>
        <div className="min-w-40 p-2">
          <div className="mb-1 font-bold text-lg">{event.title}</div>
          {event.club_name && <div className="mb-2 text-sm text-gray-600">{event.club_name}</div>}
          {event.location && <div className="mb-1 text-sm">{event.location}</div>}
          {event.start_date && (
            <div className="text-xs text-gray-500">
              {formatDate(event.start_date)}
              {event.end_date && ` - ${formatDate(event.end_date)}`}
            </div>
          )}
        </div>
      </Popup>
    </CircleMarker>
  );
}

export function EventClusterMap({
  initialCenter = [40.7128, -74.006], // Default to NYC
  initialZoom = 12,
  className = "",
}: ClusterMapProps) {
  const supabase = createClient();
  const [clusters, setClusters] = useState<EventCluster[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<string[] | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchClusters = useCallback(
    async (bounds: L.LatLngBounds) => {
      setLoading(true);
      setError(null);

      try {
        const minLat = bounds.getSouth();
        const maxLat = bounds.getNorth();
        const minLng = bounds.getWest();
        const maxLng = bounds.getEast();

        // Get current zoom level from map
        const map = document.querySelector(".leaflet-container") as HTMLElement;
        const zoomLevel = map ? parseInt(map.getAttribute("data-zoom") || "12") : 12;

        // Call the edge function
        const { data, error: fetchError } = await supabase.functions.invoke("event-clustering", {
          body: {
            min_lat: minLat,
            max_lat: maxLat,
            min_lng: minLng,
            max_lng: maxLng,
            zoom_level: zoomLevel,
            cluster_radius: 0.01,
            use_kmeans: false,
          },
        });

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        if (data?.clusters) {
          setClusters(data.clusters);
          setEvents(data.events || []);
        }
      } catch (err) {
        console.error("Failed to fetch clusters:", err);
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  const handleBoundsChange = useCallback(
    (bounds: L.LatLngBounds) => {
      // Debounce API calls to avoid excessive requests
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        fetchClusters(bounds);
      }, 150); // 150ms debounce for smooth panning
    },
    [fetchClusters],
  );

  // Initial load
  useEffect(() => {
    if (mapBounds) {
      fetchClusters(mapBounds);
    }
  }, []);

  const handleClusterClick = (eventIds: string[]) => {
    setExpandedCluster(eventIds);
  };

  // Determine what to render: expanded cluster or all clusters
  const renderMarkers = () => {
    // If a cluster is expanded, show individual event markers
    if (expandedCluster) {
      const expandedEvents = events.filter((e) => expandedCluster.includes(e.id));
      return expandedEvents.map((event) => (
        <SingleEventMarker key={event.id} event={event} onClick={() => {}} />
      ));
    }

    // Otherwise, show clusters
    return clusters.map((cluster) => (
      <ClusterMarker
        key={cluster.cluster_id}
        cluster={cluster}
        events={events}
        onClick={handleClusterClick}
      />
    ));
  };

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEventHandler onBoundsChange={handleBoundsChange} />
        {renderMarkers()}
      </MapContainer>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute left-0 top-0 z-[1000] flex h-full w-full items-center justify-center bg-white/80">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-black" />
            <span className="font-mono text-sm">Loading events...</span>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute left-0 top-0 z-[1000] m-4 rounded-lg bg-red-100 p-4 text-red-700">
          <p className="font-mono text-sm">{error}</p>
          <button
            onClick={() => mapBounds && fetchClusters(mapBounds)}
            className="mt-2 text-sm underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Back to clusters button */}
      {expandedCluster && (
        <button
          onClick={() => setExpandedCluster(null)}
          className="neu-border absolute bottom-4 left-4 z-[1000] bg-white px-4 py-2 font-mono text-xs font-bold uppercase"
        >
          ← Back to Clusters
        </button>
      )}

      {/* Legend */}
      <div className="neu-border absolute bottom-4 right-4 z-[1000] bg-white p-3">
        <div className="mb-2 font-mono text-xs font-bold uppercase">Cluster Size</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="font-mono text-xs">20+ events</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            <span className="font-mono text-xs">10-19 events</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <span className="font-mono text-xs">5-9 events</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="font-mono text-xs">1-4 events</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      {clusters.length > 0 && !loading && (
        <div className="neu-border absolute left-4 top-4 z-[1000] bg-white p-3">
          <div className="font-mono text-xs">
            <div className="font-bold">Map Statistics</div>
            <div>{clusters.length} clusters</div>
            <div>{events.length} total events</div>
          </div>
        </div>
      )}
    </div>
  );
}
