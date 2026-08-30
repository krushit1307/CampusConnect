import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Vote,
  Clock,
  Users,
  Lock,
  Trash2,
  CheckCircle2,
  BarChart3,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePollDetail, useCastVote, useClosePoll, useDeletePoll } from "@/hooks/usePolls";
import { usePollStore } from "@/store/usePollStore";
import { POLL_TYPE_META, POLL_STATUS_META, POLL_TARGET_META } from "@/types/polls";
import type { Poll, PollOption } from "@/types/polls";
import { formatDate, cn } from "@/lib/utils";
import { useState, useCallback } from "react";

interface PollDetailProps {
  pollId: string | null;
  currentUserId: string | null;
  isAdmin: boolean;
  onClose: () => void;
}

export function PollDetail({ pollId, currentUserId, isAdmin, onClose }: PollDetailProps) {
  const { data: poll, isLoading } = usePollDetail(pollId);
  const castVote = useCastVote();
  const closePoll = useClosePoll();
  const deletePoll = useDeletePoll();
  const { pendingVotePollIds } = usePollStore();
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);

  const isPending = poll ? pendingVotePollIds.has(poll.id) : false;
  const hasAlreadyVoted = poll?.user_has_voted ?? false;
  const isClosed = poll?.status === "closed";

  const toggleOption = useCallback(
    (optionId: string) => {
      if (hasAlreadyVoted || isClosed) return;
      if (poll?.poll_type === "single" || poll?.poll_type === "yes_no") {
        setSelectedOptionIds([optionId]);
      } else {
        setSelectedOptionIds((prev) =>
          prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
        );
      }
    },
    [hasAlreadyVoted, isClosed, poll?.poll_type],
  );

  const handleVote = () => {
    if (!currentUserId || !poll || selectedOptionIds.length === 0) return;
    castVote.mutate({ pollId: poll.id, optionIds: selectedOptionIds, userId: currentUserId });
    setSelectedOptionIds([]);
  };

  const handleDelete = () => {
    if (!poll) return;
    if (window.confirm("Delete this poll?")) {
      deletePoll.mutate(poll.id);
      onClose();
    }
  };

  if (!pollId) return null;

  const showResults = hasAlreadyVoted || isClosed;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              {poll && (
                <>
                  <Badge
                    variant="secondary"
                    className={cn("text-xs", POLL_STATUS_META[poll.status].bgClass)}
                  >
                    <span
                      className={cn(
                        "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
                        POLL_STATUS_META[poll.status].dotClass,
                      )}
                    />
                    {POLL_STATUS_META[poll.status].label}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {POLL_TYPE_META[poll.poll_type].icon} {POLL_TYPE_META[poll.poll_type].label}
                  </Badge>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 px-5 py-5">
            {isLoading || !poll ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-5">
                {/* Author */}
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 overflow-hidden">
                    {poll.created_by_avatar ? (
                      <img
                        src={poll.created_by_avatar}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      poll.created_by_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-semibold">{poll.created_by_name}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {formatDate(poll.created_at)}
                    </span>
                  </div>
                </div>

                {/* Question */}
                <h2 className="text-xl font-black text-gray-900 leading-snug">{poll.question}</h2>

                {/* Meta row */}
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Vote className="h-3.5 w-3.5" />
                    {poll.total_votes} total votes
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {poll.options.length} options
                  </span>
                  {poll.is_anonymous && (
                    <span className="flex items-center gap-1">
                      <Lock className="h-3.5 w-3.5" />
                      Anonymous
                    </span>
                  )}
                  {poll.expires_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(poll.expires_at) < new Date()
                        ? "Expired"
                        : `Expires ${formatDate(poll.expires_at).split(" at ")[0]}`}
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", POLL_TARGET_META[poll.target].bgClass)}
                  >
                    {POLL_TARGET_META[poll.target].label}
                  </Badge>
                </div>

                {/* Options / Results */}
                <div className="space-y-2.5">
                  {poll.options.map((opt: PollOption) => {
                    const pct =
                      poll.total_votes > 0
                        ? Math.round((opt.vote_count / poll.total_votes) * 100)
                        : 0;
                    const isSelected = selectedOptionIds.includes(opt.id);
                    const userVotedFor = poll.user_vote_option_ids.includes(opt.id);

                    return (
                      <motion.button
                        key={opt.id}
                        onClick={() => toggleOption(opt.id)}
                        disabled={showResults || isPending}
                        className={cn(
                          "w-full text-left rounded-xl border-2 p-4 transition-all relative overflow-hidden",
                          showResults
                            ? "cursor-default"
                            : isSelected
                              ? "border-indigo-500 bg-indigo-50"
                              : "border-gray-200 hover:border-indigo-300 bg-white",
                        )}
                        whileTap={!showResults ? { scale: 0.98 } : undefined}
                      >
                        {/* Result bar background */}
                        {showResults && (
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className={cn(
                              "absolute inset-y-0 left-0 rounded-r-xl",
                              userVotedFor ? "bg-indigo-200" : "bg-gray-100",
                            )}
                          />
                        )}
                        <div className="relative flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {!showResults && (
                              <div
                                className={cn(
                                  "h-4 w-4 rounded-full border-2",
                                  poll.poll_type === "multiple" ? "rounded-sm" : "",
                                  isSelected
                                    ? "border-indigo-500 bg-indigo-500"
                                    : "border-gray-300",
                                )}
                              >
                                {isSelected && <CheckCircle2 className="h-3 w-3 text-white m-px" />}
                              </div>
                            )}
                            <span className="text-sm font-semibold text-gray-800">{opt.text}</span>
                            {userVotedFor && showResults && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />
                            )}
                          </div>
                          {showResults && (
                            <span className="text-sm font-mono font-bold text-gray-700 tabular-nums">
                              {pct}%
                            </span>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Vote button */}
                {!showResults && currentUserId && (
                  <Button
                    onClick={handleVote}
                    disabled={selectedOptionIds.length === 0 || isPending}
                    className="w-full rounded-full h-11 font-bold bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Vote className="h-4 w-4 mr-2" />
                    )}
                    {selectedOptionIds.length > 0 ? "Cast Vote" : "Select an option"}
                  </Button>
                )}

                {!currentUserId && !showResults && (
                  <p className="text-center text-sm text-gray-400">Log in to vote on this poll.</p>
                )}

                {showResults && (
                  <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-center text-xs text-indigo-700 font-medium">
                    {hasAlreadyVoted
                      ? "Thanks for voting! Results update in real-time."
                      : "This poll is closed. Final results shown above."}
                  </div>
                )}

                {/* Admin actions */}
                {isAdmin && (
                  <div className="flex gap-2 pt-2 border-t border-gray-200">
                    {!isClosed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => closePoll.mutate(poll.id)}
                        className="rounded-full text-xs gap-1.5"
                      >
                        <Lock className="h-3 w-3" /> Close Poll
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDelete}
                      className="rounded-full text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
