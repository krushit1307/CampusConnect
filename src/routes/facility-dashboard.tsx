import { useEffect, useState, useCallback } from "react";
import { Navigate, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import Check from "lucide-react/dist/esm/icons/check";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Users from "lucide-react/dist/esm/icons/users";
import Flame from "lucide-react/dist/esm/icons/flame";
import Thermometer from "lucide-react/dist/esm/icons/thermometer";
import Activity from "lucide-react/dist/esm/icons/activity";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

import {
  ThermalOvercrowdingService,
  type ThermostatReading,
  type ThermalAlert,
} from "@/services/thermalOvercrowdingService";
import { AcousticDensityTelemetry } from "@/components/facility/AcousticDensityTelemetry";

interface Venue {
  id: string;
  name: string;
  building: string;
  capacity: number;
}

interface EventData {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  clubs: { name: string } | null;
}

interface AccommodationRequest {
  id: string;
  event_id: string;
  accommodation_type: string;
  state: string;
  private_note: string | null;
}

interface VenueDeployment {
  id: string;
  event_id: string;
  action: string;
  status: string;
}

export default function FacilityDashboard() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");

  const [telemetry, setTelemetry] = useState<ThermostatReading[]>([]);
  const [alerts, setAlerts] = useState<ThermalAlert[]>([]);
  const [simTemp, setSimTemp] = useState<string>("72");
  const [refreshing, setRefreshing] = useState(false);

  const loadThermalData = useCallback(async () => {
    if (!selectedVenueId) return;
    const tel = await ThermalOvercrowdingService.fetchTelemetry(selectedVenueId);
    setTelemetry(tel);
    const al = await ThermalOvercrowdingService.fetchActiveAlerts(selectedVenueId);
    setAlerts(al);
  }, [selectedVenueId]);

  useEffect(() => {
    void loadThermalData();
  }, [selectedVenueId, loadThermalData]);

  useEffect(() => {
    if (!selectedVenueId) return;
    const channel = supabase
      .channel(`thermal-realtime-${selectedVenueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "thermostat_telemetry",
          filter: `venue_id=eq.${selectedVenueId}`,
        },
        () => {
          void loadThermalData();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "thermal_alerts",
          filter: `venue_id=eq.${selectedVenueId}`,
        },
        () => {
          void loadThermalData();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedVenueId, loadThermalData, supabase]);

  const handleIngest = async (tempVal: number) => {
    if (!selectedVenueId) return;
    setRefreshing(true);
    const res = await ThermalOvercrowdingService.ingestReading(selectedVenueId, tempVal);
    setRefreshing(false);
    if (res.success) {
      toast.success(`Telemetry recorded: ${tempVal}°F. Delta T: ${res.delta_t}°F.`);
      if (res.alert_triggered) {
        toast.error("WARNING: Overcrowding Alert Triggered! Campus Police dispatched.");
      }
      void loadThermalData();
    } else {
      toast.error("Failed to record telemetry.");
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    setRefreshing(true);
    const ok = await ThermalOvercrowdingService.resolveAlert(alertId);
    setRefreshing(false);
    if (ok) {
      toast.success("Thermal alert resolved. HVAC cooling systems normalized.");
      void loadThermalData();
    } else {
      toast.error("Failed to resolve alert.");
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile) {
          setRole(profile.role);
        }
      }
      setAuthChecked(true);
    });
  }, [supabase]);

  // Fetch Venues managed by the user (or all venues if system admin)
  const { data: venues = [], isLoading: isLoadingVenues } = useQuery<Venue[]>({
    queryKey: ["facility_venues", user?.id, role],
    queryFn: async () => {
      if (!user || !role) return [];
      if (role === "system_admin") {
        const { data, error } = await supabase
          .from("venues")
          .select("id, name, building, capacity")
          .order("building", { ascending: true })
          .order("name", { ascending: true });
        if (error) throw error;
        return data as Venue[];
      } else {
        const { data, error } = await supabase
          .from("venue_managers")
          .select("venue_id, venues(id, name, building, capacity)")
          .eq("user_id", user.id);
        if (error) throw error;
        return (data || []).map((item: any) => item.venues).filter(Boolean) as Venue[];
      }
    },
    enabled: authChecked && !!user && !!role,
  });

  // Auto-select first venue
  useEffect(() => {
    if (venues.length > 0 && !selectedVenueId) {
      setSelectedVenueId(venues[0].id);
    }
  }, [venues, selectedVenueId]);

  // Fetch today's events for selected venue
  const {
    data: events = [],
    isLoading: isLoadingEvents,
    refetch: refetchEvents,
  } = useQuery<EventData[]>({
    queryKey: ["facility_events_today", selectedVenueId],
    queryFn: async () => {
      if (!selectedVenueId) return [];
      const todayStr = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("events")
        .select("id, title, start_date, end_date, status, clubs(name)")
        .eq("venue_id", selectedVenueId)
        .neq("status", "cancelled")
        .gte("end_date", `${todayStr}T00:00:00Z`)
        .lte("start_date", `${todayStr}T23:59:59Z`);
      if (error) throw error;
      return (data || []) as EventData[];
    },
    enabled: !!selectedVenueId,
  });

  const eventIds = events.map((e) => e.id);

  // Fetch accommodation requests for today's events
  const {
    data: requests = [],
    isLoading: isLoadingRequests,
    refetch: refetchRequests,
  } = useQuery<AccommodationRequest[]>({
    queryKey: ["facility_accommodations_today", eventIds],
    queryFn: async () => {
      if (eventIds.length === 0) return [];
      const { data, error } = await supabase
        .from("accommodation_requests")
        .select("id, event_id, accommodation_type, state, private_note")
        .in("event_id", eventIds)
        .neq("state", "WITHDRAWN");
      if (error) throw error;
      return (data || []) as AccommodationRequest[];
    },
    enabled: eventIds.length > 0,
  });

  // Fetch deployments for selected venue
  const { data: deployments = [], refetch: refetchDeployments } = useQuery<VenueDeployment[]>({
    queryKey: ["facility_deployments", selectedVenueId],
    queryFn: async () => {
      if (!selectedVenueId) return [];
      const { data, error } = await supabase
        .from("venue_deployments")
        .select("id, event_id, action, status")
        .eq("venue_id", selectedVenueId);
      if (error) throw error;
      return (data || []) as VenueDeployment[];
    },
    enabled: !!selectedVenueId,
  });

  // Mutation to toggle/toggle deployments
  const toggleDeployment = useMutation({
    mutationFn: async ({
      eventId,
      action,
      isDeployed,
    }: {
      eventId: string;
      action: string;
      isDeployed: boolean;
    }) => {
      if (isDeployed) {
        // Remove deployment
        const { error } = await supabase
          .from("venue_deployments")
          .delete()
          .eq("venue_id", selectedVenueId)
          .eq("event_id", eventId)
          .eq("action", action);
        if (error) throw error;
      } else {
        // Add deployment
        const { error } = await supabase.from("venue_deployments").insert({
          venue_id: selectedVenueId,
          event_id: eventId,
          action,
          status: "completed",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Deployment status updated successfully!");
      refetchDeployments();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update deployment.");
    },
  });

  if (!authChecked || isLoadingVenues) {
    return (
      <SiteShell>
        <div className="flex h-[60vh] items-center justify-center font-mono">
          <div className="animate-pulse">Loading Facility Dashboard...</div>
        </div>
      </SiteShell>
    );
  }

  // Enforce access control
  if (!user || (role !== "facility_manager" && role !== "system_admin")) {
    return <Navigate to="/" replace />;
  }

  if (venues.length === 0) {
    return (
      <SiteShell>
        <main className="mx-auto max-w-4xl p-6">
          <div className="border-4 border-black bg-yellow-50 p-8 text-center shadow-[8px_8px_0_0_#000]">
            <ShieldAlert className="mx-auto h-12 w-12 text-black mb-4" />
            <h1 className="font-display text-2xl font-black uppercase text-black">
              No Assigned Venues
            </h1>
            <p className="mt-2 font-mono text-sm text-zinc-600">
              You are registered as a facility manager but have not been assigned to any venues yet.
              Please contact a system administrator.
            </p>
          </div>
        </main>
      </SiteShell>
    );
  }

  const selectedVenue = venues.find((v) => v.id === selectedVenueId) || venues[0];

  // Helper to format event times
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Build daily briefings
  const dailyBriefingList: string[] = [];
  events.forEach((event) => {
    const eventRequests = requests.filter((r) => r.event_id === event.id);
    const wheelchairCount = eventRequests.filter(
      (r) => r.accommodation_type === "WHEELCHAIR_SEATING",
    ).length;
    const aslCount = eventRequests.filter((r) => r.accommodation_type === "ASL_INTERPRETER").length;

    if (wheelchairCount > 0 || aslCount > 0) {
      const timeStr = formatTime(event.start_date);
      let details = "";
      if (wheelchairCount > 0 && aslCount > 0) {
        details = `${wheelchairCount} wheelchair user${wheelchairCount > 1 ? "s" : ""} and ${aslCount} ASL request${aslCount > 1 ? "s" : ""}`;
      } else if (wheelchairCount > 0) {
        details = `${wheelchairCount} wheelchair user${wheelchairCount > 1 ? "s" : ""}`;
      } else {
        details = `${aslCount} ASL request${aslCount > 1 ? "s" : ""}`;
      }
      dailyBriefingList.push(
        `Today, expect ${details} for "${event.title}" starting at ${timeStr}.`,
      );
    }
  });

  return (
    <SiteShell>
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {/* Header Block */}
        <header className="border-4 border-black bg-lime p-6 shadow-[8px_8px_0_0_#000] mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="font-display text-3xl font-black uppercase tracking-tight text-black sm:text-4xl">
                Facility Manager Dashboard
              </h1>
              <p className="mt-1 font-mono text-xs uppercase tracking-wider text-black/60">
                Venue Operations & Real-Time Accessibility Briefing
              </p>
            </div>

            {/* Venue Dropdown & HVAC Model Shortcut */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/events/venue-main-auditorium/hvac-pre-cooling"
                data-testid="link-hvac-precooling-model"
                className="border-2 border-black bg-cyan-400 hover:bg-cyan-300 px-3 py-1.5 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] flex items-center gap-1.5 transition text-black"
              >
                <Thermometer className="w-3.5 h-3.5" />
                HVAC Pre-Cooling Model
              </Link>
              <label
                htmlFor="venue-select"
                className="font-mono text-xs font-bold uppercase text-black"
              >
                Select Venue:
              </label>
              <select
                id="venue-select"
                value={selectedVenueId}
                onChange={(e) => setSelectedVenueId(e.target.value)}
                className="border-2 border-black bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000]"
              >
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.building} - {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Daily Briefing Card */}
        <section className="border-4 border-black bg-yellow-50 p-6 shadow-[8px_8px_0_0_#000] mb-8">
          <div className="flex items-center gap-2 border-b-2 border-black pb-3 mb-4">
            <Flame className="h-6 w-6 text-black fill-black" />
            <h2 className="font-display text-xl font-black uppercase text-black">
              Daily Accessibility Briefing
            </h2>
          </div>
          {dailyBriefingList.length > 0 ? (
            <ul className="space-y-3">
              {dailyBriefingList.map((briefing, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 font-mono text-sm text-zinc-900 leading-relaxed"
                >
                  <span className="text-lime font-bold">•</span>
                  <span>{briefing}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-mono text-sm text-zinc-600">
              No critical physical accessibility accommodations requested for today's events at this
              venue.
            </p>
          )}
        </section>

        {/* Environmental Control & Thermal Overcrowding Telemetry */}
        <section className="border-4 border-black bg-cyan-100 p-6 shadow-[8px_8px_0_0_#000] mb-8 font-mono text-black">
          <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Thermometer className="h-6 w-6 text-black" />
              <h2 className="font-display text-xl font-black uppercase text-black">
                HVAC & Thermostat Telemetry
              </h2>
            </div>
            <button
              onClick={() => void loadThermalData()}
              className="border-2 border-black bg-white p-1 shadow-[2px_2px_0_0_#000] active:translate-y-0.5 hover:bg-zinc-50"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Active Thermal Overcrowding Security Alerts */}
          {alerts.length > 0 && (
            <div className="border-4 border-red-600 bg-red-100 p-4 shadow-[4px_4px_0_0_#000] mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-600 animate-bounce shrink-0" />
                <div>
                  <h3 className="font-black text-red-600 uppercase text-sm">
                    🚨 Thermal Overcrowding Alert Active
                  </h3>
                  <p className="text-xs text-black font-bold">
                    University HVAC reports an extreme ambient spike of{" "}
                    {alerts[0].temp_spike.toFixed(1)}°F. Campus Police notified of high-density
                    biological mass.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleResolveAlert(alerts[0].id)}
                disabled={refreshing}
                className="shrink-0 border-2 border-black bg-black text-white px-4 py-2 text-xs font-black uppercase shadow-[2px_2px_0_0_#000] active:translate-y-0.5 hover:bg-zinc-800"
              >
                Resolve & Reset HVAC
              </button>
            </div>
          )}

          {/* Grid: Environmental metrics & Simulation */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Metric Displays */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Current temperature */}
                <div className="border-2 border-black bg-white p-3 shadow-[3px_3px_0_0_#000]">
                  <span className="text-[10px] font-black uppercase text-zinc-500">
                    Current Temp
                  </span>
                  <div className="text-2xl font-black text-black">
                    {telemetry[0]
                      ? `${telemetry[0].temperature_fahrenheit.toFixed(1)}°F`
                      : "70.0°F"}
                  </div>
                  <span className="text-[9px] font-bold text-zinc-400 block mt-1">
                    HVAC Normal Setpoint: 70°F - 74°F
                  </span>
                </div>

                {/* Rate of Change Delta T */}
                <div className="border-2 border-black bg-white p-3 shadow-[3px_3px_0_0_#000]">
                  <span className="text-[10px] font-black uppercase text-zinc-500">
                    20-Min Rate of Change (ΔT)
                  </span>
                  <div
                    className={`text-2xl font-black ${telemetry[0]?.temperature_fahrenheit - (telemetry[telemetry.length - 1]?.temperature_fahrenheit || 70) >= 10 ? "text-red-600 animate-pulse" : "text-black"}`}
                  >
                    {telemetry.length > 0
                      ? `+${(telemetry[0].temperature_fahrenheit - telemetry[telemetry.length - 1].temperature_fahrenheit).toFixed(1)}°F`
                      : "+0.0°F"}
                  </div>
                  <span className="text-[9px] font-bold text-zinc-400 block mt-1">
                    Anomalous Limit: +10.0°F
                  </span>
                </div>
              </div>

              {/* Log History */}
              <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
                <h4 className="font-bold text-xs uppercase text-black border-b border-black/10 pb-2 mb-2 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Recent Readings
                </h4>
                {telemetry.length === 0 ? (
                  <p className="text-xs italic text-zinc-500">No telemetry log entries found.</p>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-1.5 pr-2">
                    {telemetry.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between text-xs font-mono"
                      >
                        <span className="text-zinc-600">
                          {new Date(t.recorded_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                        <span className="font-black text-black">
                          {t.temperature_fahrenheit.toFixed(1)}°F
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Simulation controls */}
            <div className="border-2 border-black bg-yellow-50 p-4 shadow-[4px_4px_0_0_#000] flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm uppercase text-black border-b border-black/10 pb-2 mb-3">
                  Simulation & Testing Bench
                </h3>
                <p className="text-xs text-zinc-600 mb-4">
                  Simulate external facilities API integrations (Siemens/Johnson Controls) to test
                  the mathematical thermal spike alarm loop.
                </p>

                <div className="flex gap-2 items-end mb-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
                      Inject Temperature (°F)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={simTemp}
                      onChange={(e) => setSimTemp(e.target.value)}
                      className="border-2 border-black bg-white px-2 py-1 text-sm font-mono outline-none w-full text-black"
                    />
                  </div>
                  <button
                    onClick={() => handleIngest(parseFloat(simTemp))}
                    disabled={refreshing || isNaN(parseFloat(simTemp))}
                    className="border-2 border-black bg-white px-4 py-1.5 text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] active:translate-y-0.5 hover:bg-zinc-100"
                  >
                    Ingest Temp
                  </button>
                </div>
              </div>

              <div className="border-t border-black/10 pt-3">
                <button
                  onClick={handleTriggerSpike}
                  disabled={refreshing}
                  className="w-full border-2 border-black bg-black text-cream font-bold py-2 text-xs font-mono uppercase shadow-[3px_3px_0_0_#000] active:translate-y-0.5 hover:bg-zinc-800"
                >
                  🔥 Trigger 12°F Spike (Simulation)
                </button>
              </div>
            </div>
          </div>
        </section>

        {selectedVenueId && (
          <AcousticDensityTelemetry venueId={selectedVenueId} />
        )}

        {/* Today's Events Grid */}
        <section className="space-y-6">
          <h2 className="font-display text-2xl font-black uppercase text-black border-b-4 border-black pb-2">
            Today's Events ({events.length})
          </h2>

          {isLoadingEvents ? (
            <div className="font-mono text-sm py-8 text-center animate-pulse">
              Loading today's events...
            </div>
          ) : events.length === 0 ? (
            <div className="border-4 border-black border-dashed p-8 text-center text-zinc-500 font-mono text-sm">
              No events scheduled at this venue for today.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {events.map((event) => {
                const eventRequests = requests.filter((r) => r.event_id === event.id);
                const wheelchairRequests = eventRequests.filter(
                  (r) => r.accommodation_type === "WHEELCHAIR_SEATING",
                );
                const aslRequests = eventRequests.filter(
                  (r) => r.accommodation_type === "ASL_INTERPRETER",
                );

                const isRampDeployed = deployments.some(
                  (d) => d.event_id === event.id && d.action === "Ramp Deployed",
                );
                const isAslConfirmed = deployments.some(
                  (d) => d.event_id === event.id && d.action === "ASL Interpreter Confirmed",
                );

                return (
                  <article
                    key={event.id}
                    className="flex flex-col border-4 border-black bg-white p-6 shadow-[6px_6px_0_0_#000] relative hover:-translate-y-1 transition-all"
                  >
                    {/* Event Meta */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-display text-lg font-black uppercase text-black leading-tight">
                          {event.title}
                        </h3>
                        <p className="font-mono text-xs text-zinc-500 mt-1 uppercase">
                          Hosted by: {event.clubs?.name || "Independent Club"}
                        </p>
                      </div>
                      <span className="shrink-0 border-2 border-black bg-black text-cream px-2 py-1 font-mono text-[10px] font-bold uppercase">
                        {event.status}
                      </span>
                    </div>

                    {/* Timeline */}
                    <div className="flex items-center gap-1.5 mt-3 text-zinc-700 font-mono text-xs">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {formatTime(event.start_date)} - {formatTime(event.end_date)}
                      </span>
                    </div>

                    {/* Aggregated Requirements list */}
                    <div className="border-t-2 border-black/10 mt-4 pt-4 flex-1">
                      <h4 className="font-display text-xs font-bold uppercase tracking-wider text-black mb-3">
                        Requested Accommodations
                      </h4>

                      {eventRequests.length === 0 ? (
                        <p className="font-mono text-xs italic text-zinc-500">
                          No accommodations requested for this event.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {/* Wheelchair Seating block */}
                          {wheelchairRequests.length > 0 && (
                            <div className="flex flex-col gap-2 p-3 bg-zinc-50 border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,0.15)]">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-bold text-black uppercase">
                                  ♿ Wheelchair Access ({wheelchairRequests.length})
                                </span>
                                <button
                                  onClick={() =>
                                    toggleDeployment.mutate({
                                      eventId: event.id,
                                      action: "Ramp Deployed",
                                      isDeployed: isRampDeployed,
                                    })
                                  }
                                  className={`border-2 border-black px-2.5 py-1 font-mono text-[10px] font-bold uppercase shadow-[1px_1px_0_0_#000] cursor-pointer transition-all active:translate-y-0.5 ${
                                    isRampDeployed
                                      ? "bg-lime text-black"
                                      : "bg-black text-white hover:bg-zinc-800"
                                  }`}
                                >
                                  {isRampDeployed ? "✓ Ramp Deployed" : "Deploy Ramp"}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* ASL Interpreter block */}
                          {aslRequests.length > 0 && (
                            <div className="flex flex-col gap-2 p-3 bg-zinc-50 border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,0.15)]">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-bold text-black uppercase">
                                  🖐️ ASL Interpreter ({aslRequests.length})
                                </span>
                                <button
                                  onClick={() =>
                                    toggleDeployment.mutate({
                                      eventId: event.id,
                                      action: "ASL Interpreter Confirmed",
                                      isDeployed: isAslConfirmed,
                                    })
                                  }
                                  className={`border-2 border-black px-2.5 py-1 font-mono text-[10px] font-bold uppercase shadow-[1px_1px_0_0_#000] cursor-pointer transition-all active:translate-y-0.5 ${
                                    isAslConfirmed
                                      ? "bg-lime text-black"
                                      : "bg-black text-white hover:bg-zinc-800"
                                  }`}
                                >
                                  {isAslConfirmed ? "✓ Interpreter Confirmed" : "Confirm ASL"}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Render other general request types */}
                          {eventRequests
                            .filter(
                              (r) =>
                                r.accommodation_type !== "WHEELCHAIR_SEATING" &&
                                r.accommodation_type !== "ASL_INTERPRETER",
                            )
                            .map((req) => (
                              <div
                                key={req.id}
                                className="flex items-center justify-between p-2.5 bg-zinc-50 border-2 border-black/20 font-mono text-xs"
                              >
                                <span className="text-zinc-700">
                                  • {req.accommodation_type.replace(/_/g, " ")}
                                </span>
                                <span className="border border-black bg-zinc-150 px-1.5 py-0.5 text-[9px] uppercase font-bold text-zinc-600">
                                  {req.state}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </SiteShell>
  );
}
