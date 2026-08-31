import { motion } from "framer-motion";
import { Star, TrendingUp, ThumbsUp, BarChart3, Users } from "lucide-react";
import { useEventFeedbackStats } from "@/hooks/useEventFeedback";
import { RATING_LABELS, type RatingValue } from "@/types/eventFeedback";
import { cn } from "@/lib/utils";

interface FeedbackStatsPanelProps {
  eventId: string;
}

export function FeedbackStatsPanel({ eventId }: FeedbackStatsPanelProps) {
  const { data: stats, isLoading } = useEventFeedbackStats(eventId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats || stats.total_reviews === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
        <Star className="h-8 w-8 text-amber-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">
          No reviews yet. Be the first to share your experience!
        </p>
      </div>
    );
  }

  const maxDist = Math.max(...Object.values(stats.rating_distribution), 1);

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
          <Star className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-amber-700">{stats.average_rating}</p>
          <p className="text-[10px] font-bold uppercase text-amber-600">Avg Rating</p>
        </div>
        <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4 text-center">
          <Users className="h-5 w-5 text-indigo-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-indigo-700">{stats.total_reviews}</p>
          <p className="text-[10px] font-bold uppercase text-indigo-600">Reviews</p>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
          <ThumbsUp className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-emerald-700">{stats.recommend_pct}%</p>
          <p className="text-[10px] font-bold uppercase text-emerald-600">Recommend</p>
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-center">
          <TrendingUp className="h-5 w-5 text-gray-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-gray-700">{stats.sentiment_breakdown.positive}</p>
          <p className="text-[10px] font-bold uppercase text-gray-600">Positive</p>
        </div>
      </div>

      {/* Rating distribution */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" /> Rating Distribution
        </h4>
        <div className="space-y-2">
          {([5, 4, 3, 2, 1] as RatingValue[]).map((rating) => {
            const count = stats.rating_distribution[rating];
            const pct = Math.round((count / maxDist) * 100);
            const meta = RATING_LABELS[rating];
            return (
              <div key={rating} className="flex items-center gap-3">
                <span className="w-6 text-center text-sm">{meta.emoji}</span>
                <span className="text-xs font-mono text-gray-500 w-3">{rating}</span>
                <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-400 w-6 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sentiment breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Sentiment</h4>
        <div className="flex gap-4">
          {[
            {
              label: "Positive",
              count: stats.sentiment_breakdown.positive,
              color: "bg-emerald-500",
            },
            { label: "Neutral", count: stats.sentiment_breakdown.neutral, color: "bg-amber-400" },
            { label: "Negative", count: stats.sentiment_breakdown.negative, color: "bg-red-400" },
          ].map((s) => (
            <div key={s.label} className="flex-1 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className={cn("h-2 w-2 rounded-full", s.color)} />
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
              <p className="text-lg font-bold text-gray-800">{s.count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
