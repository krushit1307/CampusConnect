import React, { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { User } from "@supabase/supabase-js";

interface EventFeedbackFormProps {
  eventId: string;
  user: User | null;
}

export function EventFeedbackForm({ eventId, user }: EventFeedbackFormProps) {
  const supabase = createClient();
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState("");

  const {
    data: existingFeedback,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["event_feedback", eventId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("event_feedbacks")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 is "No rows found"
      return data || null;
    },
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");
      if (rating < 1 || rating > 5) throw new Error("Please select a rating between 1 and 5");

      const { error } = await supabase.from("event_feedbacks").insert({
        event_id: eventId,
        user_id: user.id,
        rating,
        comment: comment.trim() || null,
      });

      if (error) {
        if (error.code === "23505") {
          // Unique violation
          throw new Error("You have already submitted feedback for this event.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Feedback submitted successfully!");
      refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to submit feedback");
    },
  });

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-gray-200 w-full" />;
  }

  if (existingFeedback) {
    return (
      <div className="neu-border bg-brand-green-bg p-6 mb-8">
        <h3 className="font-display text-xl font-bold uppercase mb-4 text-black">Your Feedback</h3>
        <div className="flex gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={24}
              className={`${
                star <= existingFeedback.rating
                  ? "text-brand-orange-base fill-brand-orange-base"
                  : "text-gray-400"
              }`}
            />
          ))}
        </div>
        {existingFeedback.comment && (
          <p className="font-mono text-sm text-gray-800 bg-white p-4 neu-border">
            {existingFeedback.comment}
          </p>
        )}
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
      <h3 className="font-display text-xl font-bold uppercase mb-4 text-black">Leave Feedback</h3>

      <div className="mb-6">
        <label className="block font-mono text-sm font-bold mb-2 uppercase">
          Rating (Required)
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="focus:outline-none transition-transform hover:scale-110"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
            >
              <Star
                size={32}
                className={`${
                  star <= (hoverRating || rating)
                    ? "text-brand-orange-base fill-brand-orange-base"
                    : "text-gray-400"
                } transition-colors`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="comment" className="block font-mono text-sm font-bold mb-2 uppercase">
          Comments (Optional)
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What did you think of the event?"
          className="neu-border w-full p-3 font-mono text-sm min-h-[100px] resize-y"
        />
      </div>

      <button
        type="submit"
        disabled={rating === 0 || submitMutation.isPending}
        className="neu-border neu-press bg-black px-6 py-3 font-mono text-sm font-bold uppercase text-white transition-transform hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {submitMutation.isPending ? "Submitting..." : "Submit Feedback"}
      </button>
    </form>
  );
}
