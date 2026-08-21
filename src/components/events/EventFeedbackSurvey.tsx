import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Star from "lucide-react/dist/esm/icons/star";
import { toast } from "sonner";
import { useQuery } from "@/hooks/useReactQueryReplacement";

interface EventFeedbackSurveyProps {
  eventId: string;
}

export function EventFeedbackSurvey({
  eventId,
}: EventFeedbackSurveyProps) {
  const supabase = createClient();

  const [selectedRating, setSelectedRating] = useState<number | null>(
    null,
  );

  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: feedback } = useQuery({
    queryKey: ["event-feedback", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_feedback")
        .select("id, rating, comments")
        .eq("event_id", eventId)
        .maybeSingle();

      if (error) throw error;

      return data;
    },
  });

  const submitRating = async (rating: number) => {
    if (!feedback?.id || saving) return;

    setSelectedRating(rating);
    setSaving(true);

    const { error } = await supabase
      .from("event_feedback")
      .update({
        rating,
        comments: comments.trim() || null,
      })
      .eq("id", feedback.id);

    setSaving(false);

    if (error) {
      toast.error("Could not save your rating.");
      return;
    }

    setSubmitted(true);
    toast.success("Thanks for your feedback!");
  };

  if (!feedback || feedback.rating !== null || submitted) {
    return null;
  }

  return (
    <section className="mx-6 mb-6 border-2 border-black bg-yellow-100 p-5 shadow-[4px_4px_0_0_#000]">
      <p className="font-mono text-xs font-bold uppercase">
        Quick Feedback
      </p>

      <h2 className="mt-2 font-display text-2xl font-black uppercase">
        How was this event?
      </h2>

      <div
        className="mt-4 flex gap-2"
        role="radiogroup"
        aria-label="Event rating"
      >
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => submitRating(rating)}
            disabled={saving}
            aria-label={`${rating} star${rating > 1 ? "s" : ""}`}
            className="border-2 border-black bg-white p-2 transition-transform hover:-translate-y-1 disabled:opacity-50"
          >
            <Star
              size={28}
              fill={
                selectedRating !== null &&
                rating <= selectedRating
                  ? "currentColor"
                  : "none"
              }
            />
          </button>
        ))}
      </div>

      <label className="mt-5 block">
        <span className="font-mono text-xs font-bold uppercase">
          Optional comment
        </span>

        <textarea
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          placeholder="What could we improve?"
          maxLength={500}
          className="mt-2 min-h-24 w-full border-2 border-black bg-white p-3 font-mono text-xs outline-none"
        />
      </label>

      <p className="mt-2 font-mono text-[10px] text-black/50">
        Tap a star to submit your rating instantly.
      </p>
    </section>
  );
}