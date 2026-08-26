import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { duplicateEvent } from "@/lib/events/duplicateEvent";
import ReactECharts from "echarts-for-react";
import { toast } from "sonner";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Star from "lucide-react/dist/esm/icons/star";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { EventFinancesSection } from "@/components/analytics/EventFinancesSection";
import { EventMetricRadarChart } from "@/components/analytics/EventMetricRadarChart";
import { EventPodcastPanel } from "@/components/audio/EventPodcastPanel";
import { WaitlistChurnPredictionCard } from "@/components/events/WaitlistChurnPredictionCard";
import { EventPollsExportSection } from "@/components/polls/EventPollsExportSection";
import { HardwareProvisioningPanel } from "@/components/events/HardwareProvisioningPanel";

import { EventAnnouncerBroadcast } from "@/components/events/EventAnnouncerBroadcast";
import { ManageTicketTiers } from "@/components/events/ManageTicketTiers";
import { OrganizerNoiseBroadcaster } from "@/components/events/OrganizerNoiseBroadcaster";

const EChartsWrapper = lazy(() => import("@/components/analytics/EChartsWrapper"));

export default function EventDashboard() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();
  const [breakdownType, setBreakdownType] = useState<"major" | "year">("major");

  const { data: sheetLink, refetch: refetchSheetLink } = useQuery({
    queryKey: ["event_google_sheet_link", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/google-sheet`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!eventId,
  });

  const startSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/google-sheet`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Failed to initialize sync");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Google Spreadsheet created and sync enabled!");
      refetchSheetLink();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to sync to Google Sheets");
    },
  });

  const {
    data: analyticsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["event_analytics", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_analytics", { p_event_id: eventId! });
      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    enabled: !!eventId,
  });
  const { data: feedbackSummary } = useQuery({
    queryKey: ["event_feedback_summary", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_feedback_summary", {
        p_event_id: eventId!,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    enabled: !!eventId,
  });

  const { data: eventData, refetch: refetchEventData } = useQuery({
    queryKey: ["event_details_dashboard", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("title, is_public_showcase")
        .eq("id", eventId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const { data: topPromoters = [] } = useQuery({
    queryKey: ["event_top_promoters", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_top_promoters", {
        p_event_id: eventId!,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId,
  });

  if (isError) {
    return (
      <SiteShell>
        <div className="flex h-[50vh] flex-col items-center justify-center p-8 text-center">
          <p className="font-mono text-red-500 font-bold uppercase">Error loading analytics</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 font-mono text-sm underline hover:text-black/70"
          >
            Go Back
          </button>
        </div>
      </SiteShell>
    );
  }

  if (isLoading || !analyticsData) {
    return (
      <SiteShell>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
        </div>
      </SiteShell>
    );
  }

  // Parse RPC response

  const data = (analyticsData as Record<string, any>) || {};
  const rsvpsByDate = data.rsvps_by_date || [];
  const attendeesByMajor = data.attendees_by_major || [];
  const attendeesByYear = data.attendees_by_year || [];

  // ECharts Configurations
  const areaChartOption = {
    title: {
      text: "RSVPs (Last 30 Days)",
      textStyle: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 16, fontWeight: "bold" },
      left: "center",
      top: 10,
    },
    tooltip: {
      trigger: "axis",
      textStyle: { fontFamily: "monospace" },
      formatter: "{b}<br />RSVPs: <b>{c}</b>",
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: rsvpsByDate.map((item: { date: string; count: number }) => item.date),
      axisLabel: { fontFamily: "monospace", fontSize: 10 },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontFamily: "monospace" },
      minInterval: 1,
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
    series: [
      {
        data: rsvpsByDate.map((item: { date: string; count: number }) => item.count),
        type: "line",
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(0, 0, 0, 0.4)" },
              { offset: 1, color: "rgba(0, 0, 0, 0.05)" },
            ],
          },
        },
        itemStyle: { color: "#000" },
        lineStyle: { width: 3 },
        smooth: true,
      },
    ],
  };

  const pieChartData = breakdownType === "major" ? attendeesByMajor : attendeesByYear;

  const pieChartOption = {
    title: {
      text: `Attendees by ${breakdownType === "major" ? "Major" : "Grad Year"}`,
      textStyle: { fontFamily: "Inter, system-ui, sans-serif", fontSize: 16, fontWeight: "bold" },
      left: "center",
      top: 10,
    },
    tooltip: {
      trigger: "item",
      textStyle: { fontFamily: "monospace" },
      formatter: "{b}: <b>{c}</b> ({d}%)",
    },
    legend: {
      orient: "horizontal",
      bottom: "bottom",
      textStyle: { fontFamily: "monospace", fontSize: 12 },
    },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: "#fff",
          borderWidth: 2,
        },
        label: { show: false, position: "center" },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: "bold",
            fontFamily: "monospace",
          },
        },
        labelLine: { show: false },
        data: pieChartData.length > 0 ? pieChartData : [{ name: "No data", value: 0 }],
      },
    ],
  };

  function EventLiveSupportPanel({ eventId }: { eventId: string }) {
    const supabase = createClient();
    const [tickets, setTickets] = useState<any[]>([]);

    useEffect(() => {
      if (!eventId) return;

      supabase
        .from("event_live_tickets")
        .select("id, message, status, created_at, user_id")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          if (data) setTickets(data);
        });

      const channel = supabase
        .channel("event_live_tickets_channel")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "event_live_tickets",
            filter: `event_id=eq.${eventId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              setTickets((prev) => [payload.new, ...prev]);
              toast.error(`New Support Ticket: "${payload.new.message}"`, {
                duration: 8000,
              });

              // Web Audio API beep sound
              try {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(880, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.25);
              } catch (e) {
                console.warn("Audio Context block: ", e);
              }
            } else if (payload.eventType === "UPDATE") {
              setTickets((prev) => prev.map((t) => (t.id === payload.new.id ? payload.new : t)));
            }
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [eventId, supabase]);

    const resolveTicket = async (ticketId: string) => {
      const { error } = await supabase
        .from("event_live_tickets")
        .update({ status: "resolved", updated_at: new Date().toISOString() })
        .eq("id", ticketId);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Ticket resolved!");
      }
    };

    const openTickets = tickets.filter((t) => t.status === "open");
    const resolvedTickets = tickets.filter((t) => t.status === "resolved");

    return (
      <div className="neu-border bg-white p-5 shadow-[4px_4px_0_0_#000] text-black">
        <h2 className="font-display text-xl font-black uppercase mb-4 flex items-center gap-2">
          🚨 Live Support Ticketing
        </h2>
        <p className="font-mono text-xs text-black/60 mb-4">
          Incoming real-time issues reported by attendees during the event.
        </p>

        {/* Alert Banner for Open Tickets */}
        {openTickets.length > 0 && (
          <div className="border-2 border-black bg-red-100 p-3 mb-4 animate-pulse font-mono text-xs font-bold text-red-800 uppercase flex items-center justify-between">
            <span>⚠️ {openTickets.length} unresolved issue(s) reported!</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Open tickets column */}
          <div className="border-2 border-black p-4 space-y-3 bg-gray-50">
            <h3 className="font-mono text-xs font-bold uppercase text-red-600">
              Open Tickets ({openTickets.length})
            </h3>
            <div className="space-y-2">
              {openTickets.length > 0 ? (
                openTickets.map((t) => (
                  <div key={t.id} className="border border-black bg-white p-3 space-y-2">
                    <p className="font-mono text-xs font-bold">{t.message}</p>
                    <div className="flex items-center justify-between text-[9px] text-gray-500 font-mono">
                      <span>{new Date(t.created_at).toLocaleTimeString()}</span>
                      <button
                        onClick={() => resolveTicket(t.id)}
                        className="border border-black bg-green-200 px-2 py-1 font-bold uppercase text-green-800 hover:bg-green-300 transition-colors"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="font-mono text-xs text-gray-400 italic">No open issues.</p>
              )}
            </div>
          </div>

          {/* Resolved tickets column */}
          <div className="border-2 border-black p-4 space-y-3 bg-gray-50">
            <h3 className="font-mono text-xs font-bold uppercase text-green-600">
              Resolved Tickets ({resolvedTickets.length})
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {resolvedTickets.length > 0 ? (
                resolvedTickets.map((t) => (
                  <div key={t.id} className="border border-black bg-white p-3 opacity-60">
                    <p className="font-mono text-xs line-through">{t.message}</p>
                    <p className="text-[9px] text-gray-400 font-mono mt-1">
                      Resolved at {new Date(t.updated_at || t.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="font-mono text-xs text-gray-400 italic">No resolved issues yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SiteShell>
      <div className="min-h-screen bg-cream px-4 py-8 md:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 font-mono text-sm font-bold uppercase hover:underline mb-4"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              {eventData?.title ? `${eventData.title} Analytics` : "Event Analytics"}
            </h1>
            <div className="flex flex-wrap gap-3 items-center mt-4 sm:mt-0">
              {/* Public Showcase Toggle */}
              <label className="flex items-center gap-2 font-mono text-xs font-bold uppercase cursor-pointer select-none bg-blue-50 dark:bg-blue-950/20 border-2 border-black dark:border-white p-2 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors">
                <input
                  type="checkbox"
                  checked={!!eventData?.is_public_showcase}
                  onChange={async (e) => {
                    const checked = e.target.checked;
                    const { error } = await supabase
                      .from("events")
                      .update({ is_public_showcase: checked })
                      .eq("id", eventId!);
                    if (error) {
                      toast.error(error.message);
                    } else {
                      toast.success(
                        checked ? "Added to Public Showcase!" : "Removed from Public Showcase.",
                      );
                      refetchEventData();
                    }
                  }}
                  className="h-4 w-4 border-2 border-black rounded-none accent-black"
                />
                Public Showcase 🌐
              </label>

              <button
                onClick={async () => {
                  try {
                    const {
                      data: { user },
                    } = await supabase.auth.getUser();
                    if (!user) throw new Error("Not logged in");
                    toast.loading("Duplicating event...", { id: "duplicate" });
                    const newId = await duplicateEvent(supabase, eventId!, user.id);
                    toast.success("Event duplicated as draft!", { id: "duplicate" });
                    navigate("/events/" + newId);
                  } catch (err: any) {
                    toast.error(err.message || "Failed to duplicate event", { id: "duplicate" });
                  }
                }}
                className="neu-border neu-press bg-yellow-300 text-black px-4 py-2 font-mono text-xs font-bold uppercase hover:-translate-y-1 transition-transform whitespace-nowrap"
              >
                Duplicate Event
              </button>
            </div>
          </div>

          {/* Google Sheets Live Sync Widget */}
          <div className="mb-8 border-2 border-black bg-emerald-50 p-5 shadow-[4px_4px_0_0_#000]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-black uppercase text-emerald-900">
                  Google Sheets Live Sync 📊
                </h2>
                <p className="font-mono text-xs text-emerald-700/80 mt-1">
                  Keep your catering team, club officers, and spreadsheet tools up to date with
                  automatic live RSVP exports.
                </p>
              </div>
              {sheetLink?.linked ? (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${sheetLink.spreadsheetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="neu-border neu-press bg-emerald-400 text-black px-4 py-2.5 font-mono text-xs font-bold uppercase hover:-translate-y-1 transition-transform text-center"
                >
                  Open Live Spreadsheet
                </a>
              ) : (
                <button
                  onClick={() => startSyncMutation.mutate()}
                  disabled={startSyncMutation.isPending}
                  className="neu-border neu-press bg-[#a3e635] text-black px-4 py-2.5 font-mono text-xs font-bold uppercase hover:-translate-y-1 transition-transform whitespace-nowrap"
                >
                  {startSyncMutation.isPending ? "Setting up..." : "Sync to Google Sheets"}
                </button>
              )}
            </div>
          </div>
          <div className="mb-8 border-2 border-black bg-yellow-100 p-5 shadow-[4px_4px_0_0_#000]">
            <div className="flex items-center gap-2">
              <Star size={20} />

              <h2 className="font-display text-xl font-black uppercase">Post-Event Feedback</h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="border-2 border-black bg-white p-4">
                <p className="font-mono text-xs font-bold uppercase">Average Rating</p>

                <p className="mt-2 font-display text-3xl font-black">
                  {Number(feedbackSummary?.average_rating ?? 0).toFixed(1)}
                  <span className="ml-1 text-lg">/ 5</span>
                </p>
              </div>

              <div className="border-2 border-black bg-white p-4">
                <p className="font-mono text-xs font-bold uppercase">Responses</p>

                <p className="mt-2 font-display text-3xl font-black">
                  {feedbackSummary?.response_count ?? 0}
                </p>
              </div>

              <div className="border-2 border-black bg-white p-4">
                <p className="font-mono text-xs font-bold uppercase">Response Rate</p>

                <p className="mt-2 font-display text-3xl font-black">
                  {Number(feedbackSummary?.response_rate ?? 0).toFixed(1)}%
                </p>

                <p className="mt-1 font-mono text-[10px] text-black/50">
                  Based on {feedbackSummary?.attendee_count ?? 0} checked-in attendees
                </p>
              </div>
            </div>

            <div className="mt-6 border-2 border-black bg-white p-4">
              <p className="font-mono text-xs font-bold uppercase mb-2">Rating Dimensions</p>
              <EventMetricRadarChart eventId={eventId!} />
            </div>
          </div>

          <div className="mb-8">
            <EventPollsExportSection eventId={eventId!} />
          </div>

          <div className="mb-8">
            {event && <HardwareProvisioningPanel eventId={eventId!} clubId={event.club_id} />}
          </div>

          <div className="mb-8">
            <WaitlistChurnPredictionCard eventId={eventId!} />
          </div>

          <div className="mb-8">
            <EventLiveSupportPanel eventId={eventId!} />
          </div>

          <div className="mb-8 border-2 border-black bg-purple-100 p-5 shadow-[4px_4px_0_0_#000]">
            <h2 className="font-display text-xl font-black uppercase mb-4 flex items-center gap-2">
              🏆 Top Promoters Leaderboard
            </h2>
            {topPromoters.length > 0 ? (
              <div className="border-2 border-black bg-white divide-y-2 divide-black">
                {topPromoters.map((promoter: any, index: number) => (
                  <div
                    key={promoter.referrer_id}
                    className="flex items-center justify-between p-3 font-mono text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg w-6">#{index + 1}</span>
                      <div className="h-8 w-8 rounded-full border border-black overflow-hidden bg-gray-100">
                        {promoter.referrer_avatar_url ? (
                          <img
                            src={promoter.referrer_avatar_url}
                            alt={promoter.referrer_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-purple-200 text-xs font-bold">
                            {promoter.referrer_name?.charAt(0) || "P"}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold">{promoter.referrer_name}</p>
                        <p className="text-xs text-gray-500">
                          @{promoter.referrer_handle || "username"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="neu-border bg-green-200 px-2.5 py-1 text-xs font-bold uppercase">
                        {promoter.referral_count}{" "}
                        {promoter.referral_count === 1 ? "invite" : "invites"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-mono text-gray-600 bg-white p-4 border-2 border-black italic">
                No referrals recorded for this event yet. Encourage attendees to generate referral
                invite links!
              </p>
            )}
          </div>

          <div className="mb-8">
            <OrganizerNoiseBroadcaster eventId={eventId!} />
          </div>

          <div className="mb-8">
            <EventAnnouncerBroadcast eventId={eventId!} />
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Area Chart Card */}
            <div className="neu-border bg-white p-4 transition-transform hover:-translate-y-1">
              <ReactECharts
                option={areaChartOption}
                style={{ height: "400px", width: "100%" }}
                opts={{ renderer: "svg" }}
              />
              <Suspense fallback={<ChartSkeleton height="400px" />}>
                <EChartsWrapper
                  option={areaChartOption}
                  style={{ height: "400px", width: "100%" }}
                  opts={{ renderer: "svg" }}
                />
              </Suspense>
            </div>

            {/* Pie Chart Card */}
            <div className="neu-border bg-white p-4 transition-transform hover:-translate-y-1 flex flex-col">
              <div className="flex justify-end mb-2 gap-2">
                <button
                  onClick={() => setBreakdownType("major")}
                  className={`neu-border px-3 py-1 font-mono text-xs font-bold uppercase transition-colors ${
                    breakdownType === "major"
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  Major
                </button>
                <button
                  onClick={() => setBreakdownType("year")}
                  className={`neu-border px-3 py-1 font-mono text-xs font-bold uppercase transition-colors ${
                    breakdownType === "year"
                      ? "bg-black text-white"
                      : "bg-white text-black hover:bg-gray-100"
                  }`}
                >
                  Year
                </button>
              </div>
              <ReactECharts
                option={pieChartOption}
                style={{ height: "350px", width: "100%" }}
                opts={{ renderer: "svg" }}
              />
              <Suspense fallback={<ChartSkeleton height="350px" />}>
                <EChartsWrapper
                  option={pieChartOption}
                  style={{ height: "350px", width: "100%" }}
                  opts={{ renderer: "svg" }}
                />
              </Suspense>
            </div>
          </div>

          <div className="mb-8 border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000]">
            <ManageTicketTiers eventId={eventId!} />
          </div>

          <EventFinancesSection eventId={eventId!} />
          <EventPodcastPanel eventId={eventId!} />
        </div>
      </div>
    </SiteShell>
  );
}
