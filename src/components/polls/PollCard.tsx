import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Users, Lock, Globe, Vote, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { POLL_TYPE_META, POLL_STATUS_META, POLL_TARGET_META } from "@/types/polls";
import type { Poll } from "@/types/polls";

interface PollCardProps {
  poll: Poll;
  onSelect: (poll: Poll) => void;
}

export function PollCard({ poll, onSelect }: PollCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const statusMeta = POLL_STATUS_META[poll.status];
  const typeMeta = POLL_TYPE_META[poll.poll_type];
  const targetMeta = POLL_TARGET_META[poll.target];

  const topOption = useMemo(() => {
    if (!poll.options.length) return null;
    return [...poll.options].sort((a, b) => b.vote_count - a.vote_count)[0];
  }, [poll.options]);

  const leadingPct =
    poll.total_votes > 0 && topOption
      ? Math.round((topOption.vote_count / poll.total_votes) * 100)
      : 0;

  const timeLeft = useMemo(() => {
    if (!poll.expires_at) return null;
    const diff = new Date(poll.expires_at).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 24) return `${hours}h left`;
    return `${Math.floor(hours / 24)}d left`;
  }, [poll.expires_at]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(poll)}
      className={cn(
        "rounded-xl border-2 bg-white p-5 cursor-pointer transition-all duration-200",
        isHovered ? "border-indigo-300 shadow-lg" : "border-gray-200 shadow-sm",
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect(poll);
      }}
    >
      {/* Badges row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Badge variant="secondary" className={cn("text-[10px] font-bold", statusMeta.bgClass)}>
          <span
            className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full", statusMeta.dotClass)}
          />
          {statusMeta.label}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {typeMeta.icon} {typeMeta.label}
        </Badge>
        <Badge variant="outline" className={cn("text-[10px]", targetMeta.bgClass)}>
          {targetMeta.label}
        </Badge>
        {poll.is_anonymous && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <Lock className="h-2.5 w-2.5" />
            Anonymous
          </Badge>
        )}
      </div>

      {/* Question */}
      <h3 className="text-base font-bold text-gray-900 line-clamp-2 mb-3 group-hover:text-indigo-700">
        {poll.question}
      </h3>

      {/* Leading option preview */}
      {topOption && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="font-medium truncate max-w-[70%]">Leading: {topOption.text}</span>
            <span className="font-mono tabular-nums">{leadingPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${leadingPct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full bg-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Footer meta */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Vote className="h-3.5 w-3.5" />
            {poll.total_votes} votes
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {poll.options.length} options
          </span>
        </div>
        <div className="flex items-center gap-2">
          {timeLeft && (
            <span
              className={cn("flex items-center gap-1", timeLeft === "Expired" && "text-red-400")}
            >
              <Clock className="h-3.5 w-3.5" />
              {timeLeft}
            </span>
          )}
          <ChevronRight
            className={cn("h-4 w-4 transition-transform", isHovered && "translate-x-0.5")}
          />
        </div>
      </div>
    </motion.article>
  );
}
