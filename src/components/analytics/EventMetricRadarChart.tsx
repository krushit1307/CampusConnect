import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

interface MetricSummary {
  metric_name: string;
  average_score: number;
  response_count: number;
}

/**
 * Radar chart of aggregated crowd-sourced rating dimensions.
 *
 * Fetches per-metric averages for an event via the organizer-only
 * `get_event_feedback_metrics_summary` RPC and renders them on a
 * Recharts radar plot (0-100 scale).
 */
export function EventMetricRadarChart({ eventId }: { eventId: string }) {
  const supabase = createClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["event_feedback_metrics_summary", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_feedback_metrics_summary", {
        p_event_id: eventId,
      });

      if (error) throw error;

      const metrics = (data as { metrics?: MetricSummary[] } | null)?.metrics ?? [];
      return metrics.map((m) => ({
        metric: m.metric_name,
        score: Number(m.average_score ?? 0),
      }));
    },
    enabled: !!eventId,
  });

  if (isError) {
    return (
      <p className="font-mono text-sm text-red-600 italic">Could not load rating dimensions.</p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="font-mono text-sm text-gray-600 italic">
        No rating dimensions collected yet. Attendees will rate these after the event.
      </p>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#000" strokeDasharray="3 3" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontFamily: "monospace", fontSize: 11, fill: "#000" }}
          />
          <Radar
            name="Average score"
            dataKey="score"
            stroke="#000"
            fill="rgba(34, 197, 94, 0.35)"
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
