import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import LogOut from "lucide-react/dist/esm/icons/log-out";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Power from "lucide-react/dist/esm/icons/power";

interface EventItem {
  id: string;
  title: string;
  max_attendees: number;
}

export default function WatchDashboard() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [occupancy, setOccupancy] = useState(0);
  const [maxCapacity, setMaxCapacity] = useState(0);
  const [powerSave, setPowerSave] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const supabase = createClient();

  // 1. Session Guard
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem("watch_session_token");
      if (!storedToken) {
        navigate("/watch/login");
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: storedToken,
        refresh_token: "",
      });
      if (error) {
        localStorage.removeItem("watch_session_token");
        navigate("/watch/login");
      } else {
        setSessionChecked(true);
      }
    };
    checkAuth();
  }, [navigate, supabase]);

  // 2. Fetch User's Managed Events
  useEffect(() => {
    if (!sessionChecked) return;
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, max_attendees")
        .order("start_date", { ascending: false })
        .limit(5);
      if (!error && data) {
        setEvents(data);
      }
    };
    fetchEvents();
  }, [sessionChecked, supabase]);

  // 3. Fetch Event Capacity & Occupancy Count
  const fetchMetrics = useCallback(async () => {
    if (!selectedEvent) return;
    try {
      // Fetch current max attendees
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("max_attendees")
        .eq("id", selectedEvent.id)
        .single();
      if (!eventError && eventData) {
        setMaxCapacity(eventData.max_attendees);
      }

      // Count checked-in RSVPs
      const { count, error: countError } = await supabase
        .from("event_rsvps")
        .select("id", { count: "exact", head: true })
        .eq("event_id", selectedEvent.id)
        .eq("checked_in", true);

      if (!countError) {
        setOccupancy(count ?? 0);
      }
    } catch (err) {
      console.error("Error fetching metrics:", err);
    }
  }, [selectedEvent, supabase]);

  useEffect(() => {
    if (selectedEvent) {
      fetchMetrics();
    }
  }, [selectedEvent, fetchMetrics]);

  // 4. Realtime / Polling logic
  useEffect(() => {
    if (!selectedEvent || !sessionChecked) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let channel: any = null;

    if (powerSave) {
      // Polling Fallback Mode: Fetch every 10 seconds
      fetchMetrics();
      intervalId = setInterval(() => {
        fetchMetrics();
      }, 10000);
    } else {
      // Realtime Mode
      channel = supabase
        .channel(`watch_occupancy_${selectedEvent.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "event_rsvps",
            filter: `event_id=eq.${selectedEvent.id}`,
          },
          () => {
            fetchMetrics();
          }
        )
        .subscribe();
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (channel) supabase.removeChannel(channel);
    };
  }, [selectedEvent, powerSave, sessionChecked, fetchMetrics, supabase]);

  // 5. Handle Increase Capacity
  const handleIncreaseCapacity = async () => {
    if (!selectedEvent) return;
    try {
      setLoading(true);
      const { error } = await supabase.rpc("increment_event_capacity", {
        p_event_id: selectedEvent.id,
        p_increment_amount: 10,
      });
      if (error) throw error;
      await fetchMetrics();
      toast.success("Capacity +10");
    } catch (err) {
      console.error(err);
      toast.error("Failed to increase capacity");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("watch_session_token");
    await supabase.auth.signOut();
    navigate("/watch/login");
  };

  if (!sessionChecked) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-lime font-mono text-xs">
        Loading...
      </div>
    );
  }

  const isAtCapacity = maxCapacity > 0 && occupancy >= maxCapacity;

  return (
    <div
      style={{ width: "100vw", height: "100vh", margin: 0, padding: 0 }}
      className={`flex flex-col items-center justify-between p-2 box-border text-cream overflow-hidden select-none font-mono transition-colors duration-300 ${
        isAtCapacity
          ? "bg-red-950/90 animate-pulse border-red-500 border-2"
          : "bg-black"
      }`}
    >
      {!selectedEvent ? (
        // Event List Selection View
        <div className="flex flex-col items-center justify-between w-full h-full max-w-[200px] max-h-[200px] py-1">
          <div className="text-[10px] uppercase font-bold tracking-wider text-lime flex items-center justify-between w-full">
            <span>Select Event</span>
            <button
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 active:scale-95"
              aria-label="Logout"
            >
              <LogOut size={12} />
            </button>
          </div>
          <div className="flex flex-col gap-1 w-full overflow-y-auto max-h-[140px] pr-0.5">
            {events.length === 0 ? (
              <div className="text-[9px] text-brand-gray-base-600 text-center mt-4">
                No recent events
              </div>
            ) : (
              events.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setSelectedEvent(ev)}
                  className="w-full text-left px-2 py-1.5 bg-brand-gray-base-900 border border-brand-gray-base-800 rounded font-bold text-[9px] truncate hover:bg-brand-gray-base-800 text-cream"
                >
                  {ev.title}
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        // Capacity Monitor View
        <div className="flex flex-col items-center justify-between w-full h-full max-w-[200px] max-h-[200px]">
          {/* Header Row */}
          <div className="flex items-center justify-between w-full text-[9px] text-brand-gray-base-500 font-bold uppercase py-0.5 border-b border-brand-gray-base-800">
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="text-lime hover:text-lime/80 flex items-center gap-0.5"
            >
              <ArrowLeft size={10} />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={() => setPowerSave((prev) => !prev)}
              className={`flex items-center gap-0.5 ${
                powerSave ? "text-amber-500 font-extrabold" : "text-brand-gray-base-500"
              }`}
              title={powerSave ? "Battery Saver: Polling" : "Realtime Updates"}
            >
              <Power size={9} />
              <span>{powerSave ? "Poll" : "Live"}</span>
            </button>
          </div>

          {/* Occupancy Indicator */}
          <div className="flex flex-col items-center justify-center my-0.5">
            <div
              className={`text-3xl font-extrabold tracking-tighter ${
                isAtCapacity ? "text-red-400" : "text-lime"
              }`}
            >
              {occupancy}
            </div>
            <div className="text-[10px] text-brand-gray-base-400 font-semibold mt-0.5">
              Limit: {maxCapacity}
            </div>
          </div>

          {/* Warning Banner */}
          {isAtCapacity && (
            <div className="flex items-center gap-1 text-[8px] bg-red-900/60 border border-red-500 px-1 py-0.5 rounded text-red-200 uppercase font-black tracking-widest animate-bounce">
              <ShieldAlert size={8} />
              CAPACITY FULL
            </div>
          )}

          {/* Increment Button */}
          <button
            type="button"
            onClick={handleIncreaseCapacity}
            disabled={loading}
            className="w-full h-8 bg-lime text-black border-2 border-black rounded-lg font-mono text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 flex items-center justify-center gap-1"
          >
            +10 Capacity
          </button>
        </div>
      )}
    </div>
  );
}
