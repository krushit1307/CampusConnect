import { useState } from "react";
import { useLiveQA } from "@/hooks/useLiveQA";
import { toast } from "sonner";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Play from "lucide-react/dist/esm/icons/play";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Send from "lucide-react/dist/esm/icons/send";
import Radio from "lucide-react/dist/esm/icons/radio";
import ArrowUp from "lucide-react/dist/esm/icons/arrow-up";

type LiveQAProps = {
  eventId: string;
  userId: string | undefined;
  isOrganizer: boolean;
};

export default function LiveQA({ eventId, userId, isOrganizer }: LiveQAProps) {
  const { questions, spotlightedQuestion, submitQuestion, markAnswering, toggleUpvote } = useLiveQA(
    eventId,
    userId,
  );
  const [newQuestionText, setNewQuestionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast.error("Please sign in to ask a question.");
      return;
    }
    const text = newQuestionText.trim();
    if (!text) return;

    setIsSubmitting(true);
    try {
      await submitQuestion(text);
      setNewQuestionText("");
      toast.success("Question submitted successfully!");
    } catch (err) {
      toast.error((err as Error).message || "Failed to submit question.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (
    id: string,
    newStatus: "queued" | "answering_now" | "answered",
  ) => {
    try {
      await markAnswering(id, newStatus);
      toast.success(`Question marked as ${newStatus.replace("_", " ")}`);
    } catch (err) {
      toast.error((err as Error).message || "Failed to update question status.");
    }
  };

  const queuedQuestions = questions.filter((q) => q.status === "queued");
  const answeredQuestions = questions.filter((q) => q.status === "answered");

  return (
    <div className="space-y-6">
      {/* Spotlighted/Answering Now Question */}
      {spotlightedQuestion && (
        <div className="neu-border bg-lime p-5 text-black flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 flex-grow">
            <span className="inline-flex items-center gap-1.5 bg-black text-cream px-2 py-0.5 font-mono text-[10px] font-bold uppercase animate-pulse">
              <Radio size={12} className="text-red-500 animate-pulse" /> Answering Live
            </span>
            <h4 className="text-lg font-bold font-sans">"{spotlightedQuestion.question}"</h4>
            <p className="font-mono text-[10px] text-gray-700 flex items-center gap-2">
              <span>Asked by: {spotlightedQuestion.profiles?.full_name || "Anonymous"}</span>
              <span className="font-bold">• {spotlightedQuestion.upvotes_count || 0} upvotes</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleUpvote(spotlightedQuestion.id)}
              className={`p-2 transition-all neu-border ${
                spotlightedQuestion.has_upvoted
                  ? "bg-black text-lime"
                  : "bg-cream text-black hover:bg-black hover:text-cream"
              } flex items-center gap-1 font-mono text-xs font-bold uppercase`}
            >
              <ArrowUp size={14} className={spotlightedQuestion.has_upvoted ? "stroke-[3px]" : ""} />
              {spotlightedQuestion.has_upvoted ? "Upvoted" : "Upvote"}
            </button>
            {isOrganizer && (
              <button
                onClick={() => handleStatusChange(spotlightedQuestion.id, "answered")}
                className="neu-border bg-black text-cream px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-cream hover:text-black transition-colors"
              >
                Done Answering
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ask a Question Input */}
      {userId && (
        <form onSubmit={handleSubmit} className="neu-border bg-white p-4 flex gap-2">
          <input
            type="text"
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            placeholder="Ask a question live..."
            disabled={isSubmitting}
            className="flex-grow border-0 border-b-2 border-black bg-transparent py-1 px-2 font-mono text-sm outline-none focus:bg-lime/10"
          />
          <button
            type="submit"
            disabled={isSubmitting || !newQuestionText.trim()}
            className="neu-border bg-black text-cream px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-lime hover:text-black disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            <Send size={14} /> Send
          </button>
        </form>
      )}

      {/* Questions list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Queue */}
        <div className="neu-border bg-cream p-4 space-y-4">
          <h4 className="font-mono text-xs font-bold uppercase border-b border-black pb-2 flex items-center gap-1.5">
            <MessageSquare size={14} /> Queued Questions ({queuedQuestions.length})
          </h4>
          {queuedQuestions.length === 0 ? (
            <p className="font-mono text-xs text-gray-500 italic">No questions in the queue.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {queuedQuestions.map((q) => (
                <div key={q.id} className="neu-border bg-white p-3 flex items-start gap-3 justify-between">
                  <div className="space-y-2 flex-grow min-w-0">
                    <p className="font-sans text-sm font-medium break-words">"{q.question}"</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-gray-500">
                        by {q.profiles?.full_name || "Anonymous"}
                      </span>
                      {isOrganizer && (
                        <div className="flex gap-1.5 ml-2">
                          <button
                            onClick={() => handleStatusChange(q.id, "answering_now")}
                            className="neu-border bg-lime text-black p-1 hover:bg-black hover:text-lime transition-colors"
                            title="Answer Live"
                          >
                            <Play size={12} />
                          </button>
                          <button
                            onClick={() => handleStatusChange(q.id, "answered")}
                            className="neu-border bg-black text-cream p-1 hover:bg-cream hover:text-black transition-colors"
                            title="Mark Answered"
                          >
                            <CheckCircle size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Upvote Button Column */}
                  <div className="flex flex-col items-center gap-0.5 min-w-[40px] pt-1">
                    <button
                      onClick={() => toggleUpvote(q.id)}
                      className={`p-1.5 transition-all rounded ${
                        q.has_upvoted
                          ? "text-black bg-lime border-2 border-black"
                          : "text-gray-400 hover:text-black hover:bg-gray-100 border border-transparent"
                      }`}
                      aria-label={q.has_upvoted ? "Remove upvote" : "Upvote question"}
                    >
                      <ArrowUp size={14} className={q.has_upvoted ? "stroke-[3px]" : ""} />
                    </button>
                    <span className="font-mono text-xs font-bold text-black">
                      {q.upvotes_count || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Answered */}
        <div className="neu-border bg-gray-50 p-4 space-y-4">
          <h4 className="font-mono text-xs font-bold uppercase border-b border-black pb-2 flex items-center gap-1.5">
            <CheckCircle size={14} /> Answered ({answeredQuestions.length})
          </h4>
          {answeredQuestions.length === 0 ? (
            <p className="font-mono text-xs text-gray-500 italic">No answered questions yet.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {answeredQuestions.map((q) => (
                <div key={q.id} className="neu-border bg-white p-3 space-y-1 opacity-70">
                  <p className="font-sans text-sm line-through">"{q.question}"</p>
                  <p className="font-mono text-[10px] text-gray-400">
                    Asked by {q.profiles?.full_name || "Anonymous"} • {q.upvotes_count || 0} upvotes
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
