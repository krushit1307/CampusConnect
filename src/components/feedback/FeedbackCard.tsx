import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ThumbsUp, Flag, CheckCircle2, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMarkHelpful } from "@/hooks/useEventFeedback";
import { RATING_LABELS, FEEDBACK_TAGS } from "@/types/eventFeedback";
import type { EventFeedback, RatingValue } from "@/types/eventFeedback";

interface FeedbackCardProps {
  feedback: EventFeedback;
  currentUserId: string | null;
}

export function FeedbackCard({ feedback, currentUserId }: FeedbackCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const markHelpful = useMarkHelpful();
  const ratingMeta = RATING_LABELS[feedback.rating as RatingValue];

  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(feedback.created_at).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }, [feedback.created_at]);

  const handleHelpful = (e: React.MouseEvent) => {
    e.stopPropagation();
    markHelpful.mutate({
      feedbackId: feedback.id,
      eventId: feedback.event_id,
      isCurrentlyHelpful: feedback.user_has_marked_helpful,
    });
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "rounded-xl border bg-white p-5 transition-all duration-200",
        isHovered ? "border-indigo-200 shadow-md" : "border-gray-200 shadow-sm",
      )}
    >
      {/* Header: user + rating + time */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 overflow-hidden">
            {feedback.user_avatar ? (
              <img src={feedback.user_avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              feedback.user_name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{feedback.user_name}</span>
              {feedback.is_verified_attendee && (
                <Badge
                  variant="outline"
                  className="text-[9px] gap-0.5 bg-emerald-50 text-emerald-700 border-emerald-200"
                >
                  <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-gray-400 font-mono">{timeAgo}</span>
          </div>
        </div>
        {/* Rating badge */}
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{ratingMeta.emoji}</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <span
                key={s}
                className={cn("text-xs", s <= feedback.rating ? "text-amber-400" : "text-gray-200")}
              >
                ★
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Title */}
      {feedback.title && <h4 className="text-sm font-bold text-gray-900 mb-1">{feedback.title}</h4>}

      {/* Review */}
      <p className="text-sm text-gray-600 leading-relaxed mb-3 whitespace-pre-wrap">
        {feedback.review}
      </p>

      {/* Tags */}
      {feedback.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {feedback.tags.map((tag) => {
            const tagDisplay = tag.replace(/_/g, " ");
            return (
              <Badge key={tag} variant="secondary" className="text-[9px] bg-gray-100 text-gray-600">
                {tagDisplay}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Footer: recommend + helpful */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {feedback.would_recommend !== null && (
            <span
              className={cn(
                "flex items-center gap-1",
                feedback.would_recommend ? "text-emerald-600" : "text-red-500",
              )}
            >
              {feedback.would_recommend ? "👍 Would recommend" : "👎 Would not recommend"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleHelpful}
            disabled={!currentUserId || markHelpful.isPending}
            className={cn(
              "h-7 gap-1.5 rounded-full text-xs",
              feedback.user_has_marked_helpful ? "text-indigo-600 bg-indigo-50" : "text-gray-500",
            )}
          >
            <ThumbsUp className="h-3 w-3" />
            Helpful ({feedback.helpful_count})
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
