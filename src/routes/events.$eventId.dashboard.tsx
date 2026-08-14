import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import ReactECharts from "echarts-for-react";
import { toast } from "sonner";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Star from "lucide-react/dist/esm/icons/star";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { EventFinancesSection } from "@/components/analytics/EventFinancesSection";
import { EventPodcastPanel } from "@/components/audio/EventPodcastPanel";

const EChartsWrapper = lazy(() => import("@/components/analytics/EChartsWrapper"));

export default function EventDashboard() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();
  const [breakdownType, setBreakdownType] = useState<"major" | "year">("major");

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

  const { data: eventData } = useQuery({
    queryKey: ["event_details_dashboard", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("title")
        .eq("id", eventId!)
        .single();
      if (error) throw error;
      return data;
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
          <EventFinancesSection eventId={eventId!} />
          <EventPodcastPanel eventId={eventId!} />
        </div>
      </div>
    </SiteShell>
  );
}
