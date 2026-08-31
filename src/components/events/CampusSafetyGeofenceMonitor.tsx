import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MapPin, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  GEOFENCE_ACKNOWLEDGEMENT_WINDOW_MS,
  getGeofenceWindowRemainingMs,
  haversineDistanceMeters,
  isOutsideGeofence,
} from "@/lib/campusSafetyGeofence";
import type { Database } from "@/types/database.types";

type GeofenceAlert = Database["public"]["Tables"]["event_geofence_alerts"]["Row"];

type LocationReading = {
  distanceMeters: number;
  accuracyMeters: number | null;
};

export type CampusSafetyGeofenceMonitorProps = {
  rsvpId: string;
  eventStart: string | null | undefined;
  eventEnd: string | null | undefined;
  geofencingEnabled: boolean;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  radiusMeters: number;
};

function isValidCoordinate(value: number | null | undefined, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function formatAlertTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function CampusSafetyGeofenceMonitor({
  rsvpId,
  eventStart,
  eventEnd,
  geofencingEnabled,
  latitude,
  longitude,
  radiusMeters,
}: CampusSafetyGeofenceMonitorProps) {
  const supabase = useMemo(() => createClient(), []);
  const [clock, setClock] = useState(() => Date.now());
  const [status, setStatus] = useState<
    "idle" | "breached" | "escalated" | "acknowledged" | "error"
  >("idle");
  const [breachedAt, setBreachedAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(GEOFENCE_ACKNOWLEDGEMENT_WINDOW_MS);
  const [alertId, setAlertId] = useState<string | null>(null);
  const [reading, setReading] = useState<LocationReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const escalationTimerRef = useRef<number | null>(null);
  const lastReadingRef = useRef<LocationReading | null>(null);
  const statusRef = useRef(status);
  const mountedRef = useRef(true);
  statusRef.current = status;

  const eventStartMs = eventStart ? new Date(eventStart).getTime() : Number.NaN;
  const eventEndMs = eventEnd ? new Date(eventEnd).getTime() : Number.NaN;
  const isActive =
    Number.isFinite(eventStartMs) &&
    Number.isFinite(eventEndMs) &&
    clock >= eventStartMs &&
    clock <= eventEndMs;
  const hasVenueCoordinates =
    isValidCoordinate(latitude, -90, 90) && isValidCoordinate(longitude, -180, 180);

  useEffect(() => {
    mountedRef.current = true;
    const intervalId = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (status !== "breached" || breachedAt === null) {
      setRemainingMs(GEOFENCE_ACKNOWLEDGEMENT_WINDOW_MS);
      return;
    }

    const intervalId = window.setInterval(() => {
      const nextRemaining = getGeofenceWindowRemainingMs(breachedAt);
      setRemainingMs(nextRemaining);
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [breachedAt, status]);

  useEffect(() => {
    const clearWatch = () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    if (!geofencingEnabled || !isActive || !hasVenueCoordinates || !rsvpId) {
      clearWatch();
      return;
    }

    if (!navigator.geolocation) {
      setError("Location monitoring is unavailable in this browser.");
      return clearWatch;
    }

    const handlePosition = (position: GeolocationPosition) => {
      const nextReading = {
        distanceMeters: haversineDistanceMeters(
          { latitude: position.coords.latitude, longitude: position.coords.longitude },
          { latitude: latitude as number, longitude: longitude as number },
        ),
        accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      };
      lastReadingRef.current = nextReading;
      setReading(nextReading);
      setError(null);

      if (!isOutsideGeofence(nextReading.distanceMeters, radiusMeters)) {
        if (statusRef.current === "acknowledged") setStatus("idle");
        return;
      }

      if (statusRef.current !== "idle") return;

      const nextBreachedAt = Date.now();
      setAlertId(null);
      setBreachedAt(nextBreachedAt);
      setRemainingMs(GEOFENCE_ACKNOWLEDGEMENT_WINDOW_MS);
      setStatus("breached");
      escalationTimerRef.current = window.setTimeout(async () => {
        const latestReading = lastReadingRef.current;
        if (!latestReading || !mountedRef.current) return;

        const { data: alert, error: rpcError } = await supabase.rpc("raise_event_geofence_alert", {
          p_rsvp_id: rsvpId,
          p_distance_meters: latestReading.distanceMeters,
          p_accuracy_meters: latestReading.accuracyMeters,
        });

        if (!mountedRef.current) return;
        if (rpcError || !alert) {
          setError("We could not notify the organizer. Stay somewhere safe and try again.");
          setStatus("error");
          return;
        }
        setAlertId(alert.id);
        setStatus("escalated");
      }, GEOFENCE_ACKNOWLEDGEMENT_WINDOW_MS);
    };

    const handleError = (positionError: GeolocationPositionError) => {
      if (!mountedRef.current) return;
      setError(
        positionError.code === positionError.PERMISSION_DENIED
          ? "Location permission is needed during this event to monitor the safety boundary."
          : "Your location could not be updated. Check GPS or device permissions.",
      );
    };

    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 20_000,
    });

    return () => {
      clearWatch();
      if (escalationTimerRef.current !== null) {
        window.clearTimeout(escalationTimerRef.current);
        escalationTimerRef.current = null;
      }
    };
  }, [
    geofencingEnabled,
    hasVenueCoordinates,
    isActive,
    latitude,
    longitude,
    radiusMeters,
    rsvpId,
    supabase,
  ]);

  const acknowledge = async () => {
    if (status !== "breached" && status !== "escalated" && status !== "error") return;
    if (escalationTimerRef.current !== null) {
      window.clearTimeout(escalationTimerRef.current);
      escalationTimerRef.current = null;
    }

    if (status === "breached") {
      setBreachedAt(null);
      setStatus("acknowledged");
      setError(null);
      return;
    }

    if (!alertId) {
      setError("The organizer alert could not be identified on this device.");
      return;
    }

    const { error: rpcError } = await supabase.rpc("acknowledge_event_geofence_alert", {
      p_alert_id: alertId,
    });
    if (rpcError) {
      setError("The organizer alert could not be acknowledged from this device.");
      return;
    }
    setStatus("acknowledged");
    setError(null);
  };

  if (!geofencingEnabled || !hasVenueCoordinates || !isActive) return null;

  const isWarning = status === "breached" || status === "escalated" || status === "error";
  const countdownSeconds = Math.ceil(remainingMs / 1_000);

  return (
    <section
      className={`neu-border mt-6 max-w-xl p-4 ${isWarning ? "bg-red-100" : "bg-white"}`}
      aria-labelledby="campus-safety-geofence-title"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert
          className={`mt-0.5 h-5 w-5 shrink-0 ${isWarning ? "text-red-700" : "text-teal-700"}`}
        />
        <div className="min-w-0 flex-1">
          <h2
            id="campus-safety-geofence-title"
            className="font-display text-lg font-black uppercase"
          >
            Campus Safety boundary
          </h2>
          <p className="mt-1 font-mono text-xs leading-5 text-black/70">
            Your device checks the {radiusMeters}m event boundary locally. Raw GPS coordinates are
            never sent to CampusConnect.
          </p>
          {reading && (
            <p className="mt-2 flex items-center gap-1 font-mono text-[11px] text-black/60">
              <MapPin className="h-3.5 w-3.5" />
              {Math.round(reading.distanceMeters)}m from the event area
            </p>
          )}
          {error && <p className="mt-2 font-mono text-xs font-bold text-red-800">{error}</p>}
        </div>
      </div>

      {status === "breached" && (
        <div className="mt-4 border-2 border-red-800 bg-red-600 p-3 text-white" role="alert">
          <p className="font-display text-xl font-black uppercase">
            You are leaving the event area.
          </p>
          <p className="mt-1 font-mono text-xs leading-5">
            Are you okay? Let the organizer know if you need help.
          </p>
          <p className="mt-2 font-mono text-xs font-black uppercase">
            Organizer notification in {countdownSeconds}s
          </p>
          <button
            type="button"
            onClick={() => void acknowledge()}
            className="neu-press mt-3 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-black uppercase text-black"
          >
            <Check className="mr-1 inline h-4 w-4" /> I’m okay
          </button>
        </div>
      )}

      {status === "escalated" && (
        <div className="mt-4 border-2 border-red-800 bg-red-50 p-3 text-red-900" role="alert">
          <p className="font-mono text-xs font-black uppercase">Organizer notified</p>
          <p className="mt-1 font-mono text-xs leading-5">
            If you need help, stay in a safe, visible place and contact campus emergency services.
          </p>
          <button
            type="button"
            onClick={() => void acknowledge()}
            className="neu-press mt-3 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-black uppercase text-black"
          >
            I’m okay now
          </button>
        </div>
      )}

      {status === "acknowledged" && (
        <p className="mt-3 font-mono text-xs font-bold text-emerald-800" role="status">
          Thanks for checking in. Local monitoring continues while you remain at the event.
        </p>
      )}
    </section>
  );
}

export function CampusSafetyGeofenceAlerts({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [alerts, setAlerts] = useState<GeofenceAlert[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAlerts = async () => {
      const { data, error: queryError } = await supabase
        .from("event_geofence_alerts")
        .select(
          "id, event_id, rsvp_id, attendee_id, attendee_name, status, breached_at, escalated_at, responded_at, distance_meters, accuracy_meters, created_at",
        )
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (cancelled) return;
      if (queryError) setError(queryError.message);
      else setAlerts((data ?? []) as GeofenceAlert[]);
    };

    void loadAlerts();
    const channel = supabase
      .channel(`campus-safety-geofence:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_geofence_alerts",
          filter: `event_id=eq.${eventId}`,
        },
        () => void loadAlerts(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  return (
    <section
      className="neu-border mt-8 max-w-3xl bg-white p-5"
      aria-labelledby="campus-safety-alerts-title"
    >
      <div className="flex items-start justify-between gap-3 border-b-2 border-black pb-3">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
            Organizer safety console
          </p>
          <h2
            id="campus-safety-alerts-title"
            className="mt-1 font-display text-2xl font-black uppercase"
          >
            Geofence alerts
          </h2>
          <p className="mt-1 font-mono text-xs text-black/60">{eventTitle}</p>
        </div>
        <ShieldAlert className="h-6 w-6 text-red-700" aria-hidden="true" />
      </div>

      {error && <p className="mt-3 font-mono text-xs font-bold text-red-800">{error}</p>}
      {alerts.length === 0 ? (
        <p className="mt-4 font-mono text-xs text-black/60">
          No geofence breaches have been escalated.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {alerts.map((alert) => (
            <article key={alert.id} className="border-2 border-black bg-red-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-lg font-black uppercase">{alert.attendee_name}</p>
                <span className="font-mono text-[10px] font-black uppercase text-red-800">
                  {alert.status === "acknowledged" ? "Attendee responded" : "Action needed"}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs leading-5 text-black/70">
                Breach escalated at {formatAlertTime(alert.escalated_at)}. The attendee’s raw GPS
                coordinates were not stored.
              </p>
              {typeof alert.distance_meters === "number" && (
                <p className="mt-2 font-mono text-[10px] font-bold uppercase text-black/60">
                  Reported distance: {Math.round(alert.distance_meters)}m
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
