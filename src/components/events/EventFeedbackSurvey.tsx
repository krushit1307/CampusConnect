import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Star from "lucide-react/dist/esm/icons/star";
import { toast } from "sonner";
import { useQuery } from "@/hooks/useReactQueryReplacement";

interface EventFeedbackSurveyProps {
  eventId: string;
}

const CHURN_REASONS = ["Too fast", "Too slow", "Schedule Conflict", "Content Mismatch / Boring"];

export function EventFeedbackSurvey({ eventId }: EventFeedbackSurveyProps) {
  const supabase = createClient();

  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [churnReason, setChurnReason] = useState<string | null>(null);
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 1. Fetch the existing feedback record
  const { data: feedback, isLoading: isFeedbackLoading } = useQuery({
    queryKey: ["event-feedback", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_feedback")
        .select("id, rating, comments, churn_reason")
        .eq("event_id", eventId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // 2. NEW: Fetch the RSVP status to check if this user is a dropout risk
  const { data: rsvpData, isLoading: isRsvpLoading } = useQuery({
    queryKey: ["event-rsvp", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("dropout_risk")
        .eq("event_id", eventId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const isDropoutRisk = rsvpData?.dropout_risk === true;
  const isLoading = isFeedbackLoading || isRsvpLoading;

  const submitFeedback = async (ratingOverride?: number) => {
    if (!feedback?.id || saving) return;

    const finalRating = ratingOverride ?? selectedRating;

    // Validation
    if (!isDropoutRisk && finalRating === null) return;
    if (isDropoutRisk && !churnReason) {
      toast.error("Please select a reason so we can improve.");
      return;
    }

    if (ratingOverride) {
      setSelectedRating(ratingOverride);
    }

    setSaving(true);

    // Update the record with either the standard rating OR the churn reason
    const { error } = await supabase
      .from("event_feedback")
      .update({
        rating: isDropoutRisk ? null : finalRating,
        churn_reason: isDropoutRisk ? churnReason : null,
        comments: comments.trim() || null,
      })
      .eq("id", feedback.id);

    setSaving(false);

    if (error) {
      toast.error("Could not save your feedback.");
      return;
    }

    setSubmitted(true);
    toast.success("Thanks for your feedback!");
  };

  if (isLoading) return null;

  // Hide if already completed
  if (!feedback || feedback.rating !== null || feedback.churn_reason !== null || submitted) {
    return null;
  }

  return (
    <section className="mx-6 mb-6 border-2 border-black bg-yellow-100 p-5 shadow-[4px_4px_0_0_#000]">
      <p className="font-mono text-xs font-bold uppercase">
        {isDropoutRisk ? "We Missed You!" : "Quick Feedback"}
      </p>

      <h2 className="mt-2 font-display text-2xl font-black uppercase">
        {isDropoutRisk ? "Why did you stop attending?" : "How was this event?"}
      </h2>

      {isDropoutRisk ? (
        <div className="mt-4 flex flex-col gap-3">
          {CHURN_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => setChurnReason(reason)}
              className={`border-2 border-black p-3 font-mono text-sm font-bold uppercase transition-transform hover:-translate-y-1 shadow-[2px_2px_0_0_#000] ${
                churnReason === reason ? "bg-black text-white" : "bg-white text-black"
              }`}
            >
              {reason}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex gap-2" role="radiogroup" aria-label="Event rating">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => submitFeedback(rating)}
              disabled={saving}
              aria-label={`${rating} star${rating > 1 ? "s" : ""}`}
              className="border-2 border-black bg-white p-2 transition-transform hover:-translate-y-1 disabled:opacity-50"
            >
              <Star
                size={28}
                fill={selectedRating !== null && rating <= selectedRating ? "currentColor" : "none"}
              />
            </button>
          ))}
        </div>
      )}

      <label className="mt-5 block">
        <span className="font-mono text-xs font-bold uppercase">
          {isDropoutRisk ? "Anything else we should know?" : "Optional comment"}
        </span>

        <textarea
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          placeholder="What could we improve?"
          maxLength={500}
          className="mt-2 min-h-24 w-full border-2 border-black bg-white p-3 font-mono text-xs outline-none"
        />
      </label>

      {isDropoutRisk && (
        <button
          onClick={() => submitFeedback()}
          disabled={saving || !churnReason}
          className="mt-4 w-full border-2 border-black bg-[#a3e635] p-3 font-mono text-sm font-bold uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5 disabled:opacity-50 transition-transform text-black"
        >
          {saving ? "Submitting..." : "Submit Feedback"}
        </button>
      )}

      {!isDropoutRisk && (
        <p className="mt-2 font-mono text-[10px] text-black/50">
          Tap a star to submit your rating instantly.
        </p>
      )}
    </section>
  );
}
