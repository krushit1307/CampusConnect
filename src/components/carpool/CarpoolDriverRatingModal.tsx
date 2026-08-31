import { useState } from "react";
import { Star, ShieldAlert, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { COMMON_SAFETY_TAGS, validateDriverRatingSubmission } from "@/lib/carpoolDriverRating";
import { submitDriverRating } from "@/lib/supabase/carpoolMatching";

interface CarpoolDriverRatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  driverUserId: string;
  driverName: string;
  riderUserId: string;
  onSuccess?: () => void;
}

export function CarpoolDriverRatingModal({
  open,
  onOpenChange,
  vehicleId,
  driverUserId,
  driverName,
  riderUserId,
  onSuccess,
}: CarpoolDriverRatingModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateDriverRatingSubmission({
      vehicleId,
      driverUserId,
      riderUserId,
      rating,
      feedback,
      safetyTags: selectedTags,
    });

    if (!validation.isValid) {
      toast.error(validation.error || "Please provide a valid rating.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await submitDriverRating(
        vehicleId,
        rating,
        feedback.trim() || undefined,
        selectedTags,
      );

      if (error || !data?.success) {
        toast.error(data?.message || "Failed to submit rating.");
      } else {
        if (data.is_blocked) {
          toast.warning(
            `Review recorded. This driver has been blocked due to consistent low ratings.`,
            { duration: 6000 },
          );
        } else {
          toast.success("Thank you! Your driver review was recorded.");
        }
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Unexpected error submitting rating.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-2 border-black bg-white p-6 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold uppercase tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> Rate Your Driver
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-black/70">
            How was your carpool experience with <strong>{driverName}</strong>? Your feedback helps
            maintain a safe campus community.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Star Rating Select */}
          <div className="flex flex-col items-center justify-center p-3 bg-amber-50/60 border-2 border-dashed border-amber-300 rounded-lg">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating ?? rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 text-2xl transition-transform hover:scale-125 focus:outline-none"
                    aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={`h-8 w-8 ${
                        isFilled
                          ? "fill-amber-400 text-amber-500"
                          : "text-gray-300 hover:text-amber-300"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <p className="font-mono text-xs font-bold text-amber-900 mt-2">
              {rating === 5 && "⭐ Excellent - Safe & Courteous"}
              {rating === 4 && "⭐ Good - Reliable ride"}
              {rating === 3 && "⭐ Okay - Room for improvement"}
              {rating === 2 && "⚠️ Poor - Uncomfortable / Concerns"}
              {rating === 1 && "🚨 Terrible - Unsafe / Dangerous"}
            </p>
          </div>

          {/* Safety & Ride Tags */}
          <div>
            <label className="font-mono text-xs uppercase font-bold text-black/70 block mb-1.5">
              Trip Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SAFETY_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`font-mono text-xs px-2.5 py-1 rounded border transition-colors ${
                      isSelected
                        ? tag.isPositive
                          ? "bg-emerald-500 text-white border-black font-bold"
                          : "bg-red-500 text-white border-black font-bold"
                        : "bg-gray-100 text-black/70 border-gray-300 hover:border-black"
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Written Feedback */}
          <div>
            <label className="font-mono text-xs uppercase font-bold text-black/70 block mb-1.5">
              Written Comments (Optional)
            </label>
            <Textarea
              placeholder="Share details about driver punctuality, safety, or vehicle condition..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              className="border-2 border-black font-mono text-xs"
            />
          </div>

          {rating <= 2 && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-300 p-2.5 rounded text-red-900 font-mono text-xs">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <p>
                Ratings below 3.0 contribute to automated safety reviews and potential driver
                suspension.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-2 border-black font-mono font-bold"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="border-2 border-black bg-black text-white font-mono font-bold uppercase tracking-wider hover:bg-black/80 shadow-[2px_2px_0px_rgba(0,0,0,1)]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Submit Review
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
