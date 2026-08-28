import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitFeedback } from "@/hooks/useEventFeedback";
import { useEventFeedbackStore } from "@/store/useEventFeedbackStore";
import { StarRating } from "@/components/feedback/StarRating";
import { FEEDBACK_TAGS, RATING_LABELS, type RatingValue } from "@/types/eventFeedback";
import { Send, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const feedbackSchema = z.object({
  title: z.string().max(100).nullable(),
  review: z.string().min(10, "Review must be at least 10 characters").max(2000),
  rating: z.number().min(1, "Please select a rating").max(5),
  would_recommend: z.boolean(),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

interface FeedbackFormProps {
  eventId: string;
  eventTitle: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
}

export function FeedbackForm({
  eventId,
  eventTitle,
  userId,
  userName,
  userAvatar,
}: FeedbackFormProps) {
  const { isFormOpen, setFormOpen } = useEventFeedbackStore();
  const submitFeedback = useSubmitFeedback();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [rating, setRating] = useState<RatingValue | 0>(0);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      title: null,
      review: "",
      rating: 0,
      would_recommend: true,
    },
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const onSubmit = (data: FeedbackFormData) => {
    submitFeedback.mutate({
      payload: {
        event_id: eventId,
        rating: rating as RatingValue,
        title: data.title,
        review: data.review,
        tags: selectedTags,
        would_recommend: data.would_recommend,
      },
      userId,
      userName,
      userAvatar,
    });
    reset();
    setRating(0);
    setSelectedTags([]);
  };

  const handleClose = () => {
    setFormOpen(false);
    reset();
    setRating(0);
    setSelectedTags([]);
  };

  return (
    <Dialog open={isFormOpen} onOpenChange={(open) => (open ? setFormOpen(true) : handleClose())}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Review This Event</DialogTitle>
          <DialogDescription>
            Share your experience at{" "}
            <span className="font-semibold text-gray-800">{eventTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-3">
          {/* Star rating */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Your Rating <span className="text-red-500">*</span>
            </Label>
            <StarRating
              value={rating}
              onChange={(v) => {
                setRating(v);
                setValue("rating", v);
              }}
              size="lg"
            />
            {rating === 0 && <p className="text-xs text-gray-400">Click a star to rate</p>}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Review Title</Label>
            <Input
              placeholder="Sum it up in a few words..."
              {...register("title")}
              className="h-9 text-sm"
            />
          </div>

          {/* Review */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              Your Review <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Tell others what you liked, what could be improved, and whether you'd attend again..."
              rows={5}
              {...register("review")}
              className={cn("resize-none", errors.review && "border-red-400")}
            />
            {errors.review && <p className="text-xs text-red-500">{errors.review.message}</p>}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Tags (optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-medium border transition-all",
                      isSelected
                        ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
                    )}
                  >
                    {tag.replace(/_/g, " ")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Would recommend */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="recommend"
              {...register("would_recommend")}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="recommend" className="text-sm cursor-pointer">
              I would recommend this event to others
            </Label>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="rounded-full">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitFeedback.isPending || rating === 0}
              className="rounded-full gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {submitFeedback.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit Review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
