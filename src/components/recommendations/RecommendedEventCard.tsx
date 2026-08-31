/**
 * RecommendedEventCard — Single event recommendation card with
 * match score badge, recommendation reasons, and quick-action buttons.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Star,
  Bookmark,
  BookmarkCheck,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  ArrowRight,
} from "lucide-react";
import { ScoredEvent, getCategoryColor, EventCategory } from "@/utils/recommendationEngine";

interface RecommendedEventCardProps {
  scored: ScoredEvent;
  index: number;
  onRsvp?: (eventId: string) => void;
  onBookmark?: (eventId: string) => void;
  onSkip?: (eventId: string) => void;
}

const REASON_ICONS: Record<string, string> = {
  category_match: "🎯",
  tag_match: "🏷️",
  club_match: "🏛️",
  similar_users: "👥",
  trending: "🔥",
  new_for_you: "✨",
  price_match: "💰",
  location_match: "📍",
};

export function RecommendedEventCard({
  scored,
  index,
  onRsvp,
  onBookmark,
  onSkip,
}: RecommendedEventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [rsvpd, setRsvpd] = useState(false);

  const { event, score, reasons, contentScore, collaborativeScore, recencyScore, popularityScore } =
    scored;

  const scorePercent = Math.round(score * 100);
  const color = getCategoryColor(event.category);

  const scoreBadgeColor =
    scorePercent >= 80
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
      : scorePercent >= 60
        ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"
        : scorePercent >= 40
          ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
          : "bg-white/10 text-gray-400 border-white/20";

  const handleBookmark = () => {
    setBookmarked(!bookmarked);
    onBookmark?.(event.id);
  };

  const handleRsvp = () => {
    setRsvpd(!rsvpd);
    onRsvp?.(event.id);
  };

  const handleSkip = () => {
    onSkip?.(event.id);
  };

  const eventDate = new Date(event.event_date);
  const dateStr = eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const timeStr = eventDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const capacityPct = Math.round((event.rsvp_count / event.capacity) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`bg-white/5 backdrop-blur-md border rounded-2xl overflow-hidden transition-all hover:border-white/20 group ${
        rsvpd ? "border-emerald-500/40" : "border-white/10"
      }`}
    >
      {/* Top Bar with Score */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
            style={{
              color,
              borderColor: `${color}40`,
              backgroundColor: `${color}15`,
            }}
          >
            {event.category.toUpperCase()}
          </span>
          {event.is_paid && (
            <span className="px-2 py-0.5 rounded-md text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
              ₹{event.price}
            </span>
          )}
        </div>
        <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${scoreBadgeColor}`}>
          {scorePercent}% match
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-3">
        <h4 className="text-white font-semibold text-sm mb-1 line-clamp-1">{event.title}</h4>
        <p className="text-gray-400 text-xs line-clamp-2 mb-3 leading-relaxed">
          {event.description}
        </p>

        {/* Meta Row */}
        <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-3 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {dateStr}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeStr}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {event.location}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {event.rsvp_count}/{event.capacity}
          </span>
          {event.rating && (
            <span className="flex items-center gap-1 text-amber-400">
              <Star className="w-3 h-3" fill="currentColor" />
              {event.rating}
            </span>
          )}
        </div>

        {/* Capacity Bar */}
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all ${
              capacityPct > 90 ? "bg-rose-500" : capacityPct > 70 ? "bg-amber-500" : "bg-cyan-500"
            }`}
            style={{ width: `${capacityPct}%` }}
          />
        </div>

        {/* Recommendation Reasons */}
        {reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {reasons.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-white/5 text-gray-300 border border-white/10"
              >
                <span>{REASON_ICONS[r.type] || "💡"}</span>
                {r.label}
              </span>
            ))}
          </div>
        )}

        {/* Expand Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-gray-500 hover:text-white flex items-center gap-1 mb-2 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide" : "Show"} scoring breakdown
        </button>

        {/* Scoring Breakdown */}
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="grid grid-cols-2 gap-2 mb-3"
          >
            <ScoreBar label="Content Match" value={contentScore} color="#3b82f6" />
            <ScoreBar label="Social Proof" value={collaborativeScore} color="#a855f7" />
            <ScoreBar label="Trending" value={recencyScore} color="#f59e0b" />
            <ScoreBar label="Popularity" value={popularityScore} color="#10b981" />
          </motion.div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center border-t border-white/5 px-4 py-2.5">
        <button
          onClick={handleSkip}
          className="p-2 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          title="Not interested"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={handleBookmark}
          className={`p-2 rounded-lg transition-all ${
            bookmarked
              ? "text-amber-400 bg-amber-500/10"
              : "text-gray-500 hover:text-amber-400 hover:bg-amber-500/10"
          }`}
          title="Bookmark"
        >
          {bookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </button>
        <div className="flex-1" />
        <button
          onClick={handleRsvp}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            rsvpd
              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
              : "bg-cyan-600 hover:bg-cyan-500 text-white"
          }`}
        >
          {rsvpd ? (
            <>✓ RSVP'd</>
          ) : (
            <>
              RSVP <ArrowRight className="w-3 h-3" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white/5 rounded-lg p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-400">{label}</span>
        <span className="text-[10px] text-white font-medium">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.5 }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}
