import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp,
  MessageCircle,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  MoreHorizontal,
  Trash2,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useToggleVote } from "@/hooks/useSuggestions";
import { useSuggestionStore } from "@/store/useSuggestionStore";
import { CATEGORY_META, STATUS_META } from "@/types/suggestions";
import type { EventSuggestion } from "@/types/suggestions";

interface SuggestionCardProps {
  suggestion: EventSuggestion;
  currentUserId: string | null;
  isAdmin: boolean;
  onSelect: (suggestion: EventSuggestion) => void;
}

export function SuggestionCard({
  suggestion,
  currentUserId,
  isAdmin,
  onSelect,
}: SuggestionCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const toggleVote = useToggleVote();
  const { pendingVoteIds } = useSuggestionStore();
  const isPending = pendingVoteIds.has(suggestion.id);
  const categoryMeta = CATEGORY_META[suggestion.category];
  const statusMeta = STATUS_META[suggestion.status];

  const handleVoteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId) return;
    toggleVote.mutate({
      suggestionId: suggestion.id,
      userId: currentUserId,
      hasVoted: suggestion.has_user_voted,
    });
  };

  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(suggestion.created_at).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, [suggestion.created_at]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative rounded-xl border-2 bg-white p-5 shadow-sm transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-0.5",
        isHovered ? "border-indigo-300" : "border-gray-200",
        "cursor-pointer",
      )}
      onClick={() => onSelect(suggestion)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(suggestion);
        }
      }}
      aria-label={`Suggestion: ${suggestion.title}`}
    >
      {/* Top row: category badge + status + timestamp */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn("text-xs font-semibold", categoryMeta.bgClass)}>
            <span className="mr-1">{categoryMeta.icon}</span>
            {categoryMeta.label}
          </Badge>
          {suggestion.status !== "open" && (
            <Badge variant="outline" className={cn("text-xs", statusMeta.bgClass)}>
              <span
                className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full", statusMeta.dotClass)}
              />
              {statusMeta.label}
            </Badge>
          )}
        </div>
        <span className="text-xs text-gray-400 font-mono">{timeAgo}</span>
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-700 transition-colors line-clamp-2 mb-2">
        {suggestion.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-600 line-clamp-3 mb-4 leading-relaxed">
        {suggestion.description}
      </p>

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-500">
        {suggestion.proposed_date && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(suggestion.proposed_date).split(" at ")[0]}
          </span>
        )}
        {suggestion.proposed_location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {suggestion.proposed_location}
          </span>
        )}
        {suggestion.estimated_budget != null && suggestion.estimated_budget > 0 && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" />${suggestion.estimated_budget.toLocaleString()}
          </span>
        )}
        {suggestion.expected_attendees != null && suggestion.expected_attendees > 0 && (
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />~{suggestion.expected_attendees}
          </span>
        )}
        {suggestion.club_name && (
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {suggestion.club_name}
          </span>
        )}
      </div>

      {/* Footer: Author + Vote + Comments */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        {/* Author */}
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 overflow-hidden">
            {suggestion.suggested_by_avatar ? (
              <img
                src={suggestion.suggested_by_avatar}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              suggestion.suggested_by_name.charAt(0).toUpperCase()
            )}
          </div>
          <span className="text-xs text-gray-600 font-medium truncate max-w-[120px]">
            {suggestion.suggested_by_name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Comments count */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                  <MessageCircle className="h-4 w-4" />
                  {suggestion.comment_count}
                </span>
              </TooltipTrigger>
              <TooltipContent>Comments</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Vote button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!currentUserId || isPending}
                  onClick={handleVoteClick}
                  className={cn(
                    "h-8 gap-1.5 rounded-full border-2 font-bold transition-all duration-200",
                    suggestion.has_user_voted
                      ? "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700"
                      : "border-gray-300 text-gray-700 hover:border-indigo-400 hover:text-indigo-600",
                  )}
                >
                  <ChevronUp
                    className={cn(
                      "h-4 w-4 transition-transform",
                      suggestion.has_user_voted && "scale-110",
                    )}
                  />
                  <span className="tabular-nums">{suggestion.vote_count}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {suggestion.has_user_voted ? "Remove vote" : "Upvote this idea"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Admin quick actions (visible on hover) */}
      {isAdmin && (
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-3 right-3 flex gap-1"
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-indigo-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(suggestion);
                }}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.article>
  );
}
