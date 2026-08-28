import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronUp,
  MessageCircle,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  Send,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  Ban,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useSuggestionDetail,
  useSuggestionComments,
  useToggleVote,
  useAddComment,
  useDeleteComment,
  useUpdateSuggestionStatus,
  useDeleteSuggestion,
} from "@/hooks/useSuggestions";
import { useSuggestionStore } from "@/store/useSuggestionStore";
import { CATEGORY_META, STATUS_META } from "@/types/suggestions";
import type { EventSuggestion, SuggestionComment, SuggestionStatus } from "@/types/suggestions";
import { formatDate, cn } from "@/lib/utils";

interface SuggestionDetailProps {
  suggestionId: string | null;
  currentUserId: string | null;
  currentUserName: string;
  currentUserAvatar: string | null;
  isAdmin: boolean;
  onClose: () => void;
}

export function SuggestionDetail({
  suggestionId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isAdmin,
  onClose,
}: SuggestionDetailProps) {
  const { data: suggestion, isLoading: suggestionLoading } = useSuggestionDetail(suggestionId);
  const { data: comments = [], isLoading: commentsLoading } = useSuggestionComments(suggestionId);
  const toggleVote = useToggleVote();
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const updateStatus = useUpdateSuggestionStatus();
  const deleteSuggestion = useDeleteSuggestion();
  const { pendingVoteIds } = useSuggestionStore();

  const [newComment, setNewComment] = useState("");
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  if (!suggestionId) return null;

  const handleVote = () => {
    if (!currentUserId || !suggestion) return;
    toggleVote.mutate({
      suggestionId: suggestion.id,
      userId: currentUserId,
      hasVoted: suggestion.has_user_voted,
    });
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !newComment.trim() || !suggestion) return;
    addComment.mutate({
      suggestionId: suggestion.id,
      content: newComment.trim(),
      authorId: currentUserId,
      authorName: currentUserName,
      authorAvatar: currentUserAvatar,
    });
    setNewComment("");
  };

  const handleStatusChange = (status: SuggestionStatus) => {
    if (!suggestion) return;
    updateStatus.mutate({ suggestionId: suggestion.id, payload: { status } });
  };

  const handleDelete = () => {
    if (!suggestion) return;
    if (window.confirm("Are you sure you want to delete this suggestion?")) {
      deleteSuggestion.mutate(suggestion.id);
      onClose();
    }
  };

  const isLoading = suggestionLoading || !suggestion;

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
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              {suggestion && (
                <Badge
                  variant="secondary"
                  className={cn("text-xs", CATEGORY_META[suggestion.category].bgClass)}
                >
                  {CATEGORY_META[suggestion.category].icon}{" "}
                  {CATEGORY_META[suggestion.category].label}
                </Badge>
              )}
              {suggestion && (
                <Badge
                  variant="outline"
                  className={cn("text-xs", STATUS_META[suggestion.status].bgClass)}
                >
                  <span
                    className={cn(
                      "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
                      STATUS_META[suggestion.status].dotClass,
                    )}
                  />
                  {STATUS_META[suggestion.status].label}
                </Badge>
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
          <ScrollArea className="flex-1 px-5 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-5">
                {/* Title */}
                <h2 className="text-xl font-black text-gray-900 leading-tight">
                  {suggestion.title}
                </h2>

                {/* Author */}
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 overflow-hidden">
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
                  <div>
                    <span className="text-sm font-semibold text-gray-800">
                      {suggestion.suggested_by_name}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      {formatDate(suggestion.created_at)}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {suggestion.description}
                </p>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3">
                  {suggestion.proposed_date && (
                    <DetailItem
                      icon={Calendar}
                      label="Proposed Date"
                      value={formatDate(suggestion.proposed_date).split(" at ")[0]}
                    />
                  )}
                  {suggestion.proposed_location && (
                    <DetailItem
                      icon={MapPin}
                      label="Location"
                      value={suggestion.proposed_location}
                    />
                  )}
                  {suggestion.estimated_budget != null && suggestion.estimated_budget > 0 && (
                    <DetailItem
                      icon={DollarSign}
                      label="Est. Budget"
                      value={`$${suggestion.estimated_budget.toLocaleString()}`}
                    />
                  )}
                  {suggestion.expected_attendees != null && suggestion.expected_attendees > 0 && (
                    <DetailItem
                      icon={Users}
                      label="Expected"
                      value={`~${suggestion.expected_attendees} people`}
                    />
                  )}
                </div>

                {/* Admin notes */}
                {suggestion.admin_notes && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs font-bold text-amber-700 mb-1">Admin Notes</p>
                    <p className="text-sm text-amber-800">{suggestion.admin_notes}</p>
                  </div>
                )}

                {/* Admin controls */}
                {isAdmin && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Admin Actions
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={suggestion.status === "under_review" ? "default" : "outline"}
                        onClick={() => handleStatusChange("under_review")}
                        className="rounded-full text-xs gap-1"
                      >
                        <Eye className="h-3 w-3" /> Review
                      </Button>
                      <Button
                        size="sm"
                        variant={suggestion.status === "approved" ? "default" : "outline"}
                        onClick={() => handleStatusChange("approved")}
                        className="rounded-full text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant={suggestion.status === "rejected" ? "default" : "outline"}
                        onClick={() => handleStatusChange("rejected")}
                        className="rounded-full text-xs gap-1 text-red-700 border-red-300 hover:bg-red-50"
                      >
                        <Ban className="h-3 w-3" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        variant={suggestion.status === "implemented" ? "default" : "outline"}
                        onClick={() => handleStatusChange("implemented")}
                        className="rounded-full text-xs gap-1 text-purple-700 border-purple-300 hover:bg-purple-50"
                      >
                        <RotateCcw className="h-3 w-3" /> Implemented
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDelete}
                      disabled={deleteSuggestion.isPending}
                      className="rounded-full text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" /> Delete Suggestion
                    </Button>
                  </div>
                )}

                {/* Vote + Comments section */}
                <div className="border-t border-gray-200 pt-4">
                  {/* Vote button */}
                  <div className="flex items-center gap-4 mb-5">
                    <Button
                      onClick={handleVote}
                      disabled={!currentUserId || pendingVoteIds.has(suggestion.id)}
                      className={cn(
                        "rounded-full gap-2 font-bold",
                        suggestion.has_user_voted
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                          : "bg-white border-2 border-gray-300 text-gray-700 hover:border-indigo-400",
                      )}
                    >
                      <ChevronUp className="h-5 w-5" />
                      {suggestion.vote_count} votes
                    </Button>
                    <span className="text-sm text-gray-500">
                      {suggestion.has_user_voted
                        ? "You voted for this!"
                        : currentUserId
                          ? "Cast your vote"
                          : "Log in to vote"}
                    </span>
                  </div>

                  {/* Comments */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Comments ({comments.length})
                    </h4>

                    {commentsLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
                        ))}
                      </div>
                    ) : comments.length === 0 ? (
                      <p className="text-sm text-gray-400 italic py-4">
                        No comments yet. Be the first to share your thoughts!
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {comments.map((comment) => (
                          <CommentItem
                            key={comment.id}
                            comment={comment}
                            currentUserId={currentUserId}
                            onDelete={() =>
                              deleteComment.mutate({
                                commentId: comment.id,
                                suggestionId: suggestion.id,
                              })
                            }
                          />
                        ))}
                        <div ref={commentsEndRef} />
                      </div>
                    )}

                    {/* Add comment form */}
                    {currentUserId && (
                      <form onSubmit={handleCommentSubmit} className="flex gap-2 mt-3">
                        <Input
                          ref={textareaRef}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="flex-1 rounded-full text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleCommentSubmit(e);
                            }
                          }}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!newComment.trim() || addComment.isPending}
                          className="rounded-full h-9 w-9 p-0 bg-indigo-600 hover:bg-indigo-700"
                        >
                          {addComment.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {label}
        </span>
      </div>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  onDelete,
}: {
  comment: SuggestionComment;
  currentUserId: string | null;
  onDelete: () => void;
}) {
  const isAuthor = currentUserId === comment.author_id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative rounded-lg bg-gray-50 border border-gray-100 p-3"
    >
      <div className="flex items-start gap-2.5">
        <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 overflow-hidden shrink-0">
          {comment.author_avatar ? (
            <img src={comment.author_avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            comment.author_name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-800">{comment.author_name}</span>
            <span className="text-[10px] text-gray-400 font-mono">
              {formatDate(comment.created_at).split(" at ")[0]}
            </span>
          </div>
          <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{comment.content}</p>
        </div>
        {isAuthor && (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
            aria-label="Delete comment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
