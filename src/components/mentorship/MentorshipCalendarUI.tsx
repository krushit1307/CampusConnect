import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Loader2,
  Video,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface MentorshipCalendarUIProps {
  recipientId: string;
  recipientName: string;
  onClose: () => void;
}

export function MentorshipCalendarUI({
  recipientId,
  recipientName,
  onClose,
}: MentorshipCalendarUIProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasIntegration, setHasIntegration] = useState<boolean | null>(null);
  const [availableSlots, setAvailableSlots] = useState<{ start: string; end: string }[]>([]);
  const [scheduling, setScheduling] = useState(false);
  const [currentDateIndex, setCurrentDateIndex] = useState(0);

  useEffect(() => {
    checkIntegrationAndLoadAvailability();
  }, [recipientId]);

  const checkIntegrationAndLoadAvailability = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      // 1. Check if user has calendar integration
      const { data: integration } = await supabase
        .from("user_calendar_integrations")
        .select("user_id")
        .eq("user_id", user.id)
        .single();

      if (!integration) {
        setHasIntegration(false);
        setLoading(false);
        return;
      }

      setHasIntegration(true);

      // 2. Fetch availability from edge function
      const { data: slots, error: availErr } = await supabase.functions.invoke(
        "mentorship-calendar",
        {
          body: {
            action: "availability",
            mentor_id: user.id, // For this feature, role doesn't strictly matter for the algorithm
            mentee_id: recipientId,
          },
        },
      );

      if (availErr) {
        throw new Error(availErr.message || "Failed to fetch availability");
      }

      if (slots && Array.isArray(slots.availableSlots)) {
        setAvailableSlots(slots.availableSlots);
      } else {
        setAvailableSlots([]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectCalendar = () => {
    // Navigate to API route
    window.location.href = "/api/calendar/connect?provider=google";
  };

  const handleSchedule = async (slot: { start: string; end: string }) => {
    setScheduling(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const { data, error: scheduleErr } = await supabase.functions.invoke("mentorship-calendar", {
        body: {
          action: "schedule",
          mentor_id: user.id,
          mentee_id: recipientId,
          start_time: slot.start,
          end_time: slot.end,
        },
      });

      if (scheduleErr) {
        throw new Error(scheduleErr.message || "Failed to schedule meeting");
      }

      toast.success("Meeting scheduled successfully! An invite has been sent.");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error scheduling meeting");
      console.error(err);
    } finally {
      setScheduling(false);
    }
  };

  // Group slots by date
  const slotsByDate: Record<string, typeof availableSlots> = {};
  availableSlots.forEach((slot) => {
    const d = new Date(slot.start);
    const dateStr = d.toLocaleDateString();
    if (!slotsByDate[dateStr]) slotsByDate[dateStr] = [];
    slotsByDate[dateStr].push(slot);
  });

  const availableDates = Object.keys(slotsByDate).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl border-2 border-black dark:border-cream dark:bg-zinc-950 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black bg-indigo-500 p-4 text-white">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <h2 className="font-display text-lg font-bold uppercase tracking-wider">
              Schedule Meeting
            </h2>
          </div>
          <button onClick={onClose} className="rounded hover:bg-white/20 p-1 transition-colors">
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-zinc-900">
          <p className="text-sm font-medium mb-6 text-slate-700 dark:text-slate-300">
            Find mutual availability with{" "}
            <span className="font-bold text-black dark:text-cream">{recipientName}</span>.
          </p>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
              <RefreshCw className="h-8 w-8 animate-spin mb-4" />
              <p className="font-mono text-xs uppercase font-bold tracking-widest">
                Analyzing Calendars...
              </p>
            </div>
          ) : !hasIntegration ? (
            <div className="rounded-lg border-2 border-dashed border-black dark:border-cream p-8 text-center bg-white dark:bg-zinc-950">
              <Calendar className="mx-auto h-12 w-12 text-slate-400 mb-4" />
              <h3 className="font-display text-lg font-bold text-black dark:text-cream mb-2">
                Connect Your Calendar
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                To find mutual availability, you need to connect your Google Calendar. We'll only
                check your free/busy status.
              </p>
              <button
                onClick={handleConnectCalendar}
                className="neu-border inline-flex items-center justify-center gap-2 bg-black px-6 py-3 font-mono text-sm font-bold uppercase text-white transition-all hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(79,70,229,1)] dark:bg-cream dark:text-black"
              >
                Connect Google Calendar
              </button>
            </div>
          ) : error ? (
            <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4 text-red-700 dark:bg-red-950 dark:text-red-300">
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertCircle className="h-4 w-4" /> Error
              </div>
              <p className="text-sm font-mono">{error}</p>
              <button
                onClick={checkIntegrationAndLoadAvailability}
                className="mt-3 text-xs font-bold underline underline-offset-2 hover:text-red-900"
              >
                Try Again
              </button>
            </div>
          ) : availableDates.length === 0 ? (
            <div className="text-center py-12 border-2 border-black bg-white dark:bg-zinc-950 dark:border-cream">
              <AlertCircle className="mx-auto h-8 w-8 text-amber-500 mb-3" />
              <h3 className="font-display font-bold text-lg">No Mutual Availability</h3>
              <p className="text-sm text-slate-500 mt-2">
                We couldn't find any common free time in the next 7 days. Try messaging them
                directly to coordinate.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  disabled={currentDateIndex === 0}
                  onClick={() => setCurrentDateIndex((prev) => prev - 1)}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-zinc-800"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="font-display font-bold uppercase tracking-wider text-sm border-b-2 border-indigo-500 pb-1">
                  {availableDates[currentDateIndex]}
                </div>
                <button
                  disabled={currentDateIndex === availableDates.length - 1}
                  onClick={() => setCurrentDateIndex((prev) => prev + 1)}
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-zinc-800"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                {slotsByDate[availableDates[currentDateIndex]].map((slot, idx) => {
                  const startTime = new Date(slot.start).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <button
                      key={idx}
                      disabled={scheduling}
                      onClick={() => handleSchedule(slot)}
                      className="neu-border flex items-center justify-center gap-2 border-2 border-black bg-white py-3 transition-transform hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(99,102,241,1)] disabled:opacity-50 dark:border-cream dark:bg-zinc-900"
                    >
                      <Clock className="h-4 w-4 text-indigo-500" />
                      <span className="font-mono text-sm font-bold">{startTime}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
