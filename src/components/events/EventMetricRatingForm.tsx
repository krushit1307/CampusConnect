import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { Slider } from "@/components/ui/slider";
import { User } from "@supabase/supabase-js";

export const DEFAULT_RATING_METRICS = [
  "Food Quality",
  "Networking Value",
  "Venue Comfort",
  "Organization",
  "Overall Experience",
];

interface EventMetricRatingFormProps {
  eventId: string;
  user: User | null;
  /** Organizer-defined rating dimensions (from events.rating_metrics). */
  metrics?: string[];
}

interface MetricScore {
  id: string;
  metric_name: string;
  score: number;
}

/**
 * Post-Event multi-dimensional rating form.
 *
 * Prompts a checked-in attendee to score each organizer-defined
 * dimension (0-100) using draggable sliders. Submits one row per
 * metric into `event_feedback_metrics` (RLS requires an approved,
 * checked-in RSVP). Re-uses the query/mutation + toast conventions
 * used by EventFeedbackForm.
 */
export default function EventMetricRatingForm({
  eventId,
  user,
  metrics = [],
}: EventMetricRatingFormProps) {
  const supabase = createClient();
  const metricNames = metrics.length > 0 ? metrics : DEFAULT_RATING_METRICS;
  const [scores, setScores] = useState<Record<string, number>>({});

  const {
    data: existingScores,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["event_feedback_metrics", eventId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("event_feedback_metrics")
        .select("id, metric_name, score")
        .eq("event_id", eventId)
        .eq("user_id", user.id);

      if (error) throw error;
      return (data || []) as MetricScore[];
    },
    enabled: !!user,
  });

  const hasSubmitted = (existingScores?.length ?? 0) > 0;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");

      const rows = metricNames.map((metric) => ({
        event_id: eventId,
        user_id: user.id,
        metric_name: metric,
        score: scores[metric] ?? 0,
      }));

      const { error } = await supabase.from("event_feedback_metrics").insert(rows);

      if (error) {
        if (error.code === "23505") {
          throw new Error("You have already submitted rating for this event.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Rating submitted successfully!");
      refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to submit rating");
    },
  });

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-gray-200 w-full" />;
  }

  if (hasSubmitted && existingScores) {
    return (
      <div className="neu-border bg-brand-green-bg p-6 mb-8">
        <h3 className="font-display text-xl font-bold uppercase mb-4 text-black">
          Your Event Rating
        </h3>
        <div className="space-y-3">
          {existingScores.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between bg-white p-3 neu-border"
            >
              <span className="font-mono text-sm font-bold uppercase text-black">
                {entry.metric_name}
              </span>
              <span className="font-display text-2xl font-black text-black">
                {entry.score}
                <span className="ml-1 text-sm text-black/50">/100</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitMutation.mutate();
      }}
      className="neu-border bg-brand-red-bg p-6 mb-8"
    >
      <h3 className="font-display text-xl font-bold uppercase mb-2 text-black">Rate This Event</h3>
      <p className="mb-6 font-mono text-xs uppercase text-black/60">
        Drag the sliders to score each category from 0 to 100.
      </p>

      <div className="space-y-5">
        {metricNames.map((metric) => {
          const value = scores[metric] ?? 0;
          return (
            <div key={metric}>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor={`metric-${metric}`}
                  className="font-mono text-sm font-bold uppercase text-black"
                >
                  {metric}
                </label>
                <span className="font-display text-lg font-black text-black">{value}</span>
              </div>
              <Slider
                id={`metric-${metric}`}
                min={0}
                max={100}
                step={1}
                value={[value]}
                onValueChange={([next]) => setScores((prev) => ({ ...prev, [metric]: next }))}
                aria-label={metric}
              />
              <div className="mt-1 flex justify-between font-mono text-[10px] uppercase text-black/40">
                <span>0</span>
                <span>100</span>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="submit"
        disabled={submitMutation.isPending}
        className="neu-border neu-press mt-6 bg-black px-4 py-2 font-mono text-sm font-bold uppercase text-white transition-transform hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {submitMutation.isPending ? "Submitting..." : "Submit Rating"}
      </button>
    </form>
  );
}
