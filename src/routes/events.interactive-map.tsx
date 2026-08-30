import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { toast } from "sonner";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Users from "lucide-react/dist/esm/icons/users";
import X from "lucide-react/dist/esm/icons/x";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Check from "lucide-react/dist/esm/icons/check";

interface EventVenue {
  name: string;
  latitude: number | null;
  longitude: number | null;
}

interface EventData {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  attendee_count: number;
  banner_url: string | null;
  status: string;
  venues: EventVenue | null;
}

// Recenter Map Helper
function ChangeMapCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Generate glowing custom Leaflet marker icon
const createGlowingMarker = (isActive: boolean, attendeeCount: number) => {
  const baseSize = 20;
  // Size grows dynamically based on attendee count (up to 48px max)
  const extraSize = Math.min(28, Math.floor((attendeeCount || 0) / 4));
  const size = baseSize + extraSize;

  const colorClass = isActive ? "bg-lime-400 border-lime-400" : "bg-purple-400 border-purple-400";
  const glowShadow = isActive ? "shadow-[0_0_12px_#a3e635]" : "shadow-[0_0_12px_#c084fc]";

  const html = `
    <div class="relative flex items-center justify-center" style="width: ${size}px; height: ${size}px;">
      ${
        isActive
          ? `<div class="absolute inset-0 rounded-full bg-lime-400/40 animate-ping" style="animation-duration: 2s;"></div>`
          : `<div class="absolute inset-0 rounded-full bg-purple-400/20 animate-pulse" style="animation-duration: 3s;"></div>`
      }
      <div class="rounded-full bg-zinc-950 border-2 ${colorClass} ${glowShadow} flex items-center justify-center transition-all duration-300" style="width: 80%; height: 80%;">
        <div class="rounded-full ${colorClass}" style="width: 45%; height: 45%;"></div>
      </div>
    </div>
  `;

  return L.divIcon({
    className: "custom-glowing-node",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

export default function InteractiveCampusMap() {
  const supabase = createClient();
  const navigate = useNavigate();
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [user, setUser] = useState<any>(null);
  const [userRsvps, setUserRsvps] = useState<Record<string, boolean>>({});

  // 1. Get current authenticated user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user);
        // Fetch user's RSVPs to identify which events they already joined
        supabase
          .from("event_rsvps")
          .select("event_id, status")
          .eq("user_id", data.user.id)
          .then(({ data: rsvps }) => {
            if (rsvps) {
              const rsvpMap: Record<string, boolean> = {};
              rsvps.forEach((r) => {
                if (r.status === "attending") {
                  rsvpMap[r.event_id] = true;
                }
              });
              setUserRsvps(rsvpMap);
            }
          });
      }
    });
  }, [supabase]);

  // 2. Fetch today's events (with fallback to upcoming events)
  const { data: events = [], isLoading } = useQuery<EventData[]>({
    queryKey: ["campus-interactive-events"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      let { data, error } = await supabase
        .from("events")
        .select(`
          id,
          title,
          description,
          start_date,
          end_date,
          location,
          latitude,
          longitude,
          attendee_count,
          banner_url,
          status,
          venues (
            name,
            latitude,
            longitude
          )
        `)
        .or("status.eq.upcoming,status.eq.ongoing,status.eq.published,status.eq.active")
        .gte("end_date", todayStart.toISOString())
        .lte("start_date", todayEnd.toISOString());

      if (error) throw error;

      // Fallback: If no events today, query all upcoming events
      if (!data || data.length === 0) {
        const { data: upcomingData, error: upcomingError } = await supabase
          .from("events")
          .select(`
            id,
            title,
            description,
            start_date,
            end_date,
            location,
            latitude,
            longitude,
            attendee_count,
            banner_url,
            status,
            venues (
              name,
              latitude,
              longitude
            )
          `)
          .or("status.eq.upcoming,status.eq.ongoing,status.eq.published,status.eq.active")
          .gte("end_date", new Date().toISOString())
          .order("start_date", { ascending: true })
          .limit(25);

        if (upcomingError) throw upcomingError;
        data = upcomingData;
      }

      return (data || []) as EventData[];
    },
  });

  // Calculate default map center
  const validCoordinates = events
    .map((e) => {
      const lat = e.latitude || e.venues?.latitude;
      const lng = e.longitude || e.venues?.longitude;
      return lat && lng ? [Number(lat), Number(lng)] : null;
    })
    .filter(Boolean) as [number, number][];

  const mapCenter: [number, number] =
    validCoordinates.length > 0
      ? [
          validCoordinates.reduce((sum, c) => sum + c[0], 0) / validCoordinates.length,
          validCoordinates.reduce((sum, c) => sum + c[1], 0) / validCoordinates.length,
        ]
      : [30.3564, 76.3647]; // Default to center campus

  // 3. Instant RSVP Toggle Mutation
  const toggleRsvpMutation = useMutation({
    mutationFn: async ({ eventId, hasRsvpd }: { eventId: string; hasRsvpd: boolean }) => {
      if (!user) {
        toast.error("Please log in to RSVP.");
        throw new Error("Unauthorized");
      }

      // Invoke Supabase toggle-rsvp Edge Function
      const { data, error } = await supabase.functions.invoke("toggle-rsvp", {
        body: { eventId, hasRsvpd },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      const { eventId, hasRsvpd } = variables;
      const newStatus = !hasRsvpd;

      // Update local RSVP map
      setUserRsvps((prev) => ({ ...prev, [eventId]: newStatus }));

      // Update local events state (adjusting attendee count instantly)
      if (selectedEvent && selectedEvent.id === eventId) {
        setSelectedEvent((prev) =>
          prev
            ? {
                ...prev,
                attendee_count: Math.max(0, prev.attendee_count + (newStatus ? 1 : -1)),
              }
            : null
        );
      }

      toast.success(newStatus ? "Successfully RSVP'd! 🎉" : "RSVP Cancelled.");
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err.message || "Failed to update RSVP. Please try again.");
    },
  });

  const now = new Date();
  const isEventActive = (event: EventData) => {
    if (!event.start_date || !event.end_date) return false;
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    return now >= start && now <= end;
  };

  return (
    <div className="relative h-screen w-screen bg-zinc-950 text-white overflow-hidden select-none">
      {/* Full-Screen Map */}
      {isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-50">
          <Loader2 className="w-10 h-10 text-lime-400 animate-spin mb-4" />
          <p className="font-mono text-sm tracking-wider uppercase">Loading Interactive Map...</p>
        </div>
      ) : (
        <MapContainer
          center={mapCenter}
          zoom={14}
          zoomControl={false}
          className="absolute inset-0 h-full w-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a> Dark Matter basemap'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {selectedEvent && (
            <ChangeMapCenter
              center={[
                Number(selectedEvent.latitude || selectedEvent.venues?.latitude || mapCenter[0]),
                Number(selectedEvent.longitude || selectedEvent.venues?.longitude || mapCenter[1]),
              ]}
            />
          )}

          {events.map((event) => {
            const lat = event.latitude || event.venues?.latitude;
            const lng = event.longitude || event.venues?.longitude;
            if (!lat || !lng) return null;

            const active = isEventActive(event);
            const markerIcon = createGlowingMarker(active, event.attendee_count);

            return (
              <Marker
                key={event.id}
                position={[Number(lat), Number(lng)]}
                icon={markerIcon}
                eventHandlers={{
                  click: () => {
                    setSelectedEvent(event);
                  },
                }}
              />
            );
          })}
        </MapContainer>
      )}

      {/* Floating Header UI */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
        <button
          onClick={() => navigate(-1)}
          className="pointer-events-auto flex items-center justify-center h-12 w-12 rounded-full border-2 border-black bg-white text-black shadow-[3px_3px_0_0_#000] hover:bg-zinc-100 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="hidden md:flex flex-col items-center border-2 border-black bg-zinc-950/80 backdrop-blur-md px-6 py-2 shadow-[4px_4px_0_0_#000] rounded-none">
          <h1 className="font-display text-lg font-black uppercase tracking-wider flex items-center gap-2 text-lime-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
            Campus Snap Map
          </h1>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-400 mt-0.5">
            Glowing rings indicate currently active study & social sessions
          </p>
        </div>

        <div className="pointer-events-auto flex gap-2 font-mono text-[10px]">
          <div className="border border-black bg-zinc-950/90 px-3 py-1 shadow-[2px_2px_0_0_#000] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-lime-400"></span>
            ACTIVE
          </div>
          <div className="border border-black bg-zinc-950/90 px-3 py-1 shadow-[2px_2px_0_0_#000] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
            UPCOMING
          </div>
        </div>
      </div>

      {/* Bottom Sheet Details Sheet */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 max-h-[70vh] bg-white text-black border-t-4 border-black p-6 shadow-2xl z-20 overflow-y-auto select-text rounded-t-3xl md:max-w-md md:mx-auto md:bottom-6 md:rounded-3xl md:border-4 dark:bg-zinc-900 dark:text-white"
          >
            {/* Header / Close button */}
            <div className="flex justify-between items-start gap-4">
              <h2 className="font-display text-xl font-black uppercase text-purple-900 dark:text-purple-300">
                {selectedEvent.title}
              </h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="h-8 w-8 rounded-full border-2 border-black bg-zinc-100 flex items-center justify-center text-black hover:bg-zinc-200 shadow-[2px_2px_0_0_#000] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Banner preview */}
            {selectedEvent.banner_url && (
              <div className="mt-4 border-2 border-black rounded-none overflow-hidden h-28 w-full bg-zinc-100 shadow-[2px_2px_0_0_#000]">
                <img
                  src={selectedEvent.banner_url}
                  alt={selectedEvent.title}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {/* Info Metrics grid */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              <div className="flex items-center gap-2 border border-zinc-200 p-2 dark:border-zinc-800">
                <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                <div className="truncate">
                  <p className="font-bold text-[9px] uppercase text-zinc-400">Date & Time</p>
                  <p className="truncate">
                    {selectedEvent.start_date
                      ? new Date(selectedEvent.start_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "TBD"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 border border-zinc-200 p-2 dark:border-zinc-800">
                <MapPin className="w-4 h-4 text-purple-600 shrink-0" />
                <div className="truncate">
                  <p className="font-bold text-[9px] uppercase text-zinc-400">Location</p>
                  <p className="truncate">
                    {selectedEvent.venues?.name || selectedEvent.location || "TBD"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 border border-zinc-200 p-2 dark:border-zinc-800">
                <Users className="w-4 h-4 text-purple-600 shrink-0" />
                <div className="truncate">
                  <p className="font-bold text-[9px] uppercase text-zinc-400">Going</p>
                  <p className="font-bold">{selectedEvent.attendee_count} attendees</p>
                </div>
              </div>

              <div className="flex items-center gap-2 border border-zinc-200 p-2 dark:border-zinc-800">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                <div className="truncate">
                  <p className="font-bold text-[9px] uppercase text-zinc-400">Status</p>
                  <p className="font-bold uppercase text-lime-600 dark:text-lime-400">
                    {isEventActive(selectedEvent) ? "LIVE NOW 🟢" : "UPCOMING 🕒"}
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="mt-4 font-mono text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3">
              {selectedEvent.description || "No description provided."}
            </p>

            {/* Action buttons */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  const hasRsvpd = !!userRsvps[selectedEvent.id];
                  toggleRsvpMutation.mutate({ eventId: selectedEvent.id, hasRsvpd });
                }}
                disabled={toggleRsvpMutation.isPending}
                className={`flex-1 border-2 border-black px-4 py-2.5 font-mono text-sm font-bold uppercase shadow-[3px_3px_0_0_#000] hover:-translate-y-0.5 transition-all text-center flex items-center justify-center gap-2 select-none ${
                  userRsvps[selectedEvent.id]
                    ? "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
                    : "bg-[#a3e635] text-black hover:bg-[#b5f448]"
                }`}
              >
                {toggleRsvpMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : userRsvps[selectedEvent.id] ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    RSVP'd ✓
                  </>
                ) : (
                  "RSVP Now"
                )}
              </button>

              <Link
                to={`/events/${selectedEvent.id}`}
                className="border-2 border-black bg-white text-black px-4 py-2.5 font-mono text-sm font-bold uppercase shadow-[3px_3px_0_0_#000] hover:-translate-y-0.5 transition-all text-center flex items-center justify-center dark:bg-zinc-800 dark:text-white"
              >
                Details →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
