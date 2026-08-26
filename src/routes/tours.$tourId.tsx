import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Circle, Popup, TileLayer, useMap } from "react-leaflet";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import PartyPopper from "lucide-react/dist/esm/icons/party-popper";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Navigation from "lucide-react/dist/esm/icons/navigation";
import SkipForward from "lucide-react/dist/esm/icons/skip-forward";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { useAuthHydration } from "@/hooks/useAuthHydration";
import { createClient } from "@/lib/supabase/client";
import { calculateHaversineDistance } from "@/lib/campusRoutePlanner";
import "leaflet/dist/leaflet.css";

type Waypoint = {
  id: string;
  sequence_order: number;
  latitude: number;
  longitude: number;
  radius_meters: number;
  title: string;
  description: string | null;
};

type Tour = {
  id: string;
  title: string;
  description: string | null;
};

type UserLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

function RecenterMap({
  location,
}: {
  location: UserLocation | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!location) return;

    map.setView([location.latitude, location.longitude], Math.max(map.getZoom(), 18), {
      animate: true,
    });
  }, [location, map]);

  return null;
}

export default function TourMode() {
  const { tourId } = useParams();
  const supabase = createClient();
  const { user, isInitializing } = useAuthHydration();

  const [tour, setTour] = useState<Tour | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [celebration, setCelebration] = useState<Waypoint | null>(null);

  const watchIdRef = useRef<number | null>(null);

  const currentWaypoint = waypoints[currentIndex] || null;

  const loadTour = useCallback(async () => {
    if (!tourId) return;

    setLoading(true);

    try {
      const [{ data: tourData, error: tourError }, { data: waypointData, error: waypointError }] =
        await Promise.all([
          supabase
            .from("tours" as never)
            .select("id, title, description")
            .eq("id", tourId)
            .single(),
          supabase
            .from("tour_waypoints" as never)
            .select(
              "id, sequence_order, latitude, longitude, radius_meters, title, description",
            )
            .eq("tour_id", tourId)
            .order("sequence_order"),
        ]);

      if (tourError) throw tourError;
      if (waypointError) throw waypointError;

      setTour(tourData);
      setWaypoints(waypointData || []);

      if (user) {
        const { data: progress } = await supabase
          .from("user_tour_progress" as never)
          .select("current_waypoint_index, completed")
          .eq("tour_id", tourId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (progress) {
          setCurrentIndex(progress.completed ? (waypointData?.length || 1) : progress.current_waypoint_index);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Could not load this campus tour.");
    } finally {
      setLoading(false);
    }
  }, [tourId, user]);

  useEffect(() => {
    loadTour();
  }, [loadTour]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setTracking(false);
  }, []);

  const saveProgress = useCallback(
    async (nextIndex: number) => {
      if (!user || !tourId) return;

      const completed = nextIndex >= waypoints.length;

      const { error } = await supabase
        .from("user_tour_progress" as never)
        .upsert(
          {
            tour_id: tourId,
            user_id: user.id,
            current_waypoint_index: Math.min(nextIndex, waypoints.length),
            completed,
            last_unlocked_at: new Date().toISOString(),
          } as never,
          {
            onConflict: "tour_id,user_id",
          },
        );

      if (error) {
        console.error("Failed to save tour progress:", error);
      }
    },
    [user, tourId, waypoints.length],
  );

  const unlockCurrentWaypoint = useCallback(
    async (manual = false) => {
      if (!currentWaypoint) return;

      const nextIndex = currentIndex + 1;

      setCelebration(currentWaypoint);
      setCurrentIndex(nextIndex);

      await saveProgress(nextIndex);

      if (manual) {
        toast.success(`${currentWaypoint.title} unlocked manually.`);
      } else {
        toast.success(`${currentWaypoint.title} unlocked!`);
      }

      window.setTimeout(() => {
        setCelebration(null);
      }, 3500);
    },
    [currentWaypoint, currentIndex, saveProgress],
  );

  const handlePosition = useCallback(
    async (position: GeolocationPosition) => {
      const nextLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      setLocation(nextLocation);

      if (!currentWaypoint) return;

      const distance = calculateHaversineDistance(
        {
          latitude: nextLocation.latitude,
          longitude: nextLocation.longitude,
        },
        {
          latitude: currentWaypoint.latitude,
          longitude: currentWaypoint.longitude,
        },
      );

      if (distance <= currentWaypoint.radius_meters) {
        await unlockCurrentWaypoint(false);
      }
    },
    [currentWaypoint, unlockCurrentWaypoint],
  );

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Your browser does not support GPS location.");
      return;
    }

    stopTracking();

    setTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (error) => {
        console.error("Geolocation error:", error);

        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Please allow location access to use Tour Mode.");
        } else {
          toast.error("Could not read your current location.");
        }

        stopTracking();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );
  }, [handlePosition, stopTracking]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTracking();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopTracking();
    };
  }, [stopTracking]);

  useEffect(() => {
    if (!currentWaypoint) {
      stopTracking();
    }
  }, [currentWaypoint, stopTracking]);

  const distanceToNext = useMemo(() => {
    if (!location || !currentWaypoint) return null;

    return calculateHaversineDistance(
      {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      {
        latitude: currentWaypoint.latitude,
        longitude: currentWaypoint.longitude,
      },
    );
  }, [location, currentWaypoint]);

  if (isInitializing || loading) {
    return (
      <SiteShell>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SiteShell>
    );
  }

  if (!tour) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-3xl p-8 text-center">
          <h1 className="font-display text-3xl font-black uppercase">
            Tour not found
          </h1>
        </div>
      </SiteShell>
    );
  }

  const completed = currentIndex >= waypoints.length;

  const mapCenter: [number, number] =
    location
      ? [location.latitude, location.longitude]
      : currentWaypoint
        ? [currentWaypoint.latitude, currentWaypoint.longitude]
        : [20.5937, 78.9629];

  return (
    <SiteShell>
      <div className="min-h-screen bg-cream">
        <div className="border-b-2 border-black bg-white px-4 py-6">
          <div className="mx-auto max-w-7xl">
            <p className="eyebrow font-bold">Tour Mode</p>

            <h1 className="mt-2 font-display text-3xl font-black uppercase md:text-5xl">
              {tour.title}
            </h1>

            {tour.description && (
              <p className="mt-2 max-w-3xl font-mono text-sm text-black/60">
                {tour.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3 font-mono text-xs font-bold uppercase">
              <span className="border-2 border-black bg-yellow-100 px-3 py-2">
                {Math.min(currentIndex, waypoints.length)} / {waypoints.length} unlocked
              </span>

              {tracking && (
                <span className="border-2 border-black bg-green-100 px-3 py-2">
                  GPS tracking active
                </span>
              )}
            </div>
          </div>
        </div>

        {celebration && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4">
            <div className="max-w-lg border-4 border-black bg-yellow-200 p-8 text-center shadow-[10px_10px_0_0_#000]">
              <PartyPopper className="mx-auto mb-4 h-16 w-16" />

              <p className="font-mono text-xs font-bold uppercase">
                Waypoint Unlocked
              </p>

              <h2 className="mt-2 font-display text-4xl font-black uppercase">
                {celebration.title}
              </h2>

              {celebration.description && (
                <p className="mt-4 font-mono text-sm">
                  {celebration.description}
                </p>
              )}

              <Button
                className="mt-6"
                onClick={() => setCelebration(null)}
              >
                Continue Tour
              </Button>
            </div>
          </div>
        )}

        <div className="mx-auto grid max-w-7xl gap-6 p-4 md:p-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-5">
            <div className="neu-border bg-white p-5">
              {completed ? (
                <div className="text-center">
                  <PartyPopper className="mx-auto h-12 w-12" />

                  <h2 className="mt-3 font-display text-2xl font-black uppercase">
                    Tour Complete!
                  </h2>

                  <p className="mt-2 font-mono text-sm text-black/60">
                    You visited every waypoint on this campus tour.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <MapPin className="h-7 w-7" />

                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase text-black/50">
                        Next Stop
                      </p>

                      <h2 className="font-display text-2xl font-black uppercase">
                        {currentWaypoint?.title}
                      </h2>
                    </div>
                  </div>

                  {currentWaypoint?.description && (
                    <p className="mt-4 font-mono text-sm leading-6">
                      {currentWaypoint.description}
                    </p>
                  )}

                  <div className="mt-5 space-y-2 border-t-2 border-black pt-4 font-mono text-xs">
                    <p>
                      Unlock radius:{" "}
                      <strong>{currentWaypoint?.radius_meters}m</strong>
                    </p>

                    {distanceToNext !== null && (
                      <p>
                        Distance: <strong>{distanceToNext}m</strong>
                      </p>
                    )}

                    {location && (
                      <p>
                        GPS accuracy:{" "}
                        <strong>±{Math.round(location.accuracy)}m</strong>
                      </p>
                    )}
                  </div>

                  <div className="mt-5 flex flex-col gap-3">
                    <Button
                      onClick={tracking ? stopTracking : startTracking}
                    >
                      <Navigation className="h-4 w-4" />
                      {tracking ? "Stop GPS" : "Start Tour Tracking"}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => unlockCurrentWaypoint(true)}
                    >
                      <SkipForward className="h-4 w-4" />
                      I'm Here — Unlock
                    </Button>
                  </div>

                  <p className="mt-3 text-center font-mono text-[10px] text-black/50">
                    Use the manual unlock option for indoor locations where GPS
                    accuracy is poor.
                  </p>
                </>
              )}
            </div>

            <div className="neu-border bg-white p-5">
              <p className="mb-3 font-mono text-xs font-bold uppercase">
                Tour Stops
              </p>

              <div className="space-y-2">
                {waypoints.map((waypoint, index) => {
                  const unlocked = index < currentIndex;
                  const active = index === currentIndex;

                  return (
                    <div
                      key={waypoint.id}
                      className={`border-2 p-3 ${
                        unlocked
                          ? "border-green-600 bg-green-50"
                          : active
                            ? "border-black bg-yellow-100"
                            : "border-black/20 bg-white opacity-60"
                      }`}
                    >
                      <p className="font-mono text-xs font-bold uppercase">
                        {index + 1}. {waypoint.title}
                      </p>

                      <p className="mt-1 font-mono text-[10px]">
                        {unlocked
                          ? "Unlocked"
                          : active
                            ? "Current destination"
                            : "Locked"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-h-[600px] overflow-hidden border-4 border-black bg-white shadow-[6px_6px_0_0_#000]">
            <MapContainer
              center={mapCenter}
              zoom={18}
              className="h-[700px] w-full"
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <RecenterMap location={location} />

              {location && (
                <Circle
                  center={[location.latitude, location.longitude]}
                  radius={Math.max(location.accuracy, 5)}
                  pathOptions={{
                    color: "#2563eb",
                    fillOpacity: 0.15,
                  }}
                />
              )}

              {location && (
                <Marker position={[location.latitude, location.longitude]}>
                  <Popup>You are here</Popup>
                </Marker>
              )}

              {waypoints.map((waypoint, index) => (
                <Marker
                  key={waypoint.id}
                  position={[waypoint.latitude, waypoint.longitude]}
                >
                  <Popup>
                    <strong>
                      {index + 1}. {waypoint.title}
                    </strong>
                  </Popup>
                </Marker>
              ))}

              {currentWaypoint && (
                <Circle
                  center={[
                    currentWaypoint.latitude,
                    currentWaypoint.longitude,
                  ]}
                  radius={currentWaypoint.radius_meters}
                  pathOptions={{
                    color: "#dc2626",
                    fillOpacity: 0.1,
                  }}
                />
              )}
            </MapContainer>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}