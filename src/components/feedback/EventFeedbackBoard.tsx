import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Star, Plus, Search, RefreshCw, AlertCircle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventFeedbackList, useMyFeedback } from "@/hooks/useEventFeedback";
import { useEventFeedbackStore } from "@/store/useEventFeedbackStore";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { FeedbackStatsPanel } from "@/components/feedback/FeedbackStatsPanel";
import { RATING_LABELS, type RatingValue, type FeedbackSentiment } from "@/types/eventFeedback";
import { cn } from "@/lib/utils";

interface EventFeedbackBoardProps {
  eventId: string;
  eventTitle: string;
  currentUserId: string | null;
  currentUserName: string;
  currentUserAvatar: string | null;
}

export function EventFeedbackBoard({
  eventId,
  eventTitle,
  currentUserId,
  currentUserName,
  currentUserAvatar,
}: EventFeedbackBoardProps) {
  const { filters, setFilter, resetFilters, setFormOpen } = useEventFeedbackStore();
  const {
    data: feedbackList = [],
    isLoading,
    isError,
    refetch,
  } = useEventFeedbackList(eventId, filters);
  const { data: myFeedback } = useMyFeedback(currentUserId, eventId);

  const count = feedbackList.length;
  const hasAlreadyReviewed = !!myFeedback;
  const activeFilters =
    (filters.rating !== "all" ? 1 : 0) +
    (filters.sentiment !== "all" ? 1 : 0) +
    (filters.search ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-rose-500 via-pink-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2Mmgxem0tMTItNHYySDExdi0yaDN6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Star className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Event Reviews</h1>
                <p className="text-pink-200 text-sm mt-0.5">for {eventTitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-5">
              {currentUserId && !hasAlreadyReviewed && (
                <Button
                  onClick={() => setFormOpen(true)}
                  className="rounded-full gap-2 bg-white text-pink-700 hover:bg-pink-50 font-bold shadow-lg"
                >
                  <Plus className="h-4 w-4" /> Write Review
                </Button>
              )}
              {hasAlreadyReviewed && (
                <Badge
                  variant="outline"
                  className="bg-white/20 border-white/30 text-white text-sm px-3 py-1"
                >
                  ✅ You reviewed this event
                </Badge>
              )}
              <span className="text-sm text-pink-200 font-mono">
                {count} review{count !== 1 ? "s" : ""}
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        <FeedbackStatsPanel eventId={eventId} />

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search reviews..."
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              className="h-10 rounded-full text-sm pl-9"
            />
          </div>
          <Select value={filters.rating} onValueChange={(v) => setFilter("rating", v as any)}>
            <SelectTrigger className="w-32 h-10 rounded-full text-sm">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              {([5, 4, 3, 2, 1] as RatingValue[]).map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {RATING_LABELS[r].emoji} {RATING_LABELS[r].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.sentiment}
            onValueChange={(v) => setFilter("sentiment", v as FeedbackSentiment | "all")}
          >
            <SelectTrigger className="w-32 h-10 rounded-full text-sm">
              <SelectValue placeholder="Sentiment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="positive">😊 Positive</SelectItem>
              <SelectItem value="neutral">😐 Neutral</SelectItem>
              <SelectItem value="negative">😞 Negative</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.sort} onValueChange={(v) => setFilter("sort", v as any)}>
            <SelectTrigger className="w-40 h-10 rounded-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="highest_rated">Highest Rated</SelectItem>
              <SelectItem value="lowest_rated">Lowest Rated</SelectItem>
              <SelectItem value="most_helpful">Most Helpful</SelectItem>
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-gray-500 text-xs"
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-white border animate-pulse p-5">
                <div className="flex gap-3 mb-3">
                  <div className="h-9 w-9 rounded-full bg-gray-200" />
                  <div className="h-5 w-32 bg-gray-200 rounded" />
                </div>
                <div className="h-4 w-3/4 bg-gray-100 rounded mb-2" />
                <div className="h-3 w-full bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <h3 className="font-bold text-red-800 mb-2">Failed to load reviews</h3>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="rounded-full gap-2 border-red-300"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && count === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <Star className="h-12 w-12 text-pink-200 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-800 mb-2">No reviews yet</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
              Share your experience and help others decide whether to attend.
            </p>
            {currentUserId && (
              <Button
                onClick={() => setFormOpen(true)}
                className="rounded-full gap-2 bg-pink-600 hover:bg-pink-700 font-bold"
              >
                <Plus className="h-4 w-4" /> Write First Review
              </Button>
            )}
          </div>
        )}

        {/* Reviews list */}
        {!isLoading && !isError && count > 0 && (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {feedbackList.map((fb) => (
                <FeedbackCard key={fb.id} feedback={fb} currentUserId={currentUserId} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Feedback form */}
      {currentUserId && (
        <FeedbackForm
          eventId={eventId}
          eventTitle={eventTitle}
          userId={currentUserId}
          userName={currentUserName}
          userAvatar={currentUserAvatar}
        />
      )}
    </div>
  );
}
