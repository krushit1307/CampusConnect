import React, { useState } from "react";
import { Sparkles, RefreshCw, ThumbsUp, Wrench, AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getExistingFeedbackSummary,
  generateFeedbackSummary,
  type EventFeedbackSummary,
} from "@/services/eventFeedbackSummaryService";

export interface EventFeedbackLlmSummaryCardProps {
  eventId: string;
  responseCount?: number;
}

export const EventFeedbackLlmSummaryCard: React.FC<EventFeedbackLlmSummaryCardProps> = ({
  eventId,
  responseCount = 0,
}) => {
  const queryClient = useQueryClient();
  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const { data: summary, isLoading } = useQuery<EventFeedbackSummary | null>({
    queryKey: ["event_feedback_llm_summary", eventId],
    queryFn: () => getExistingFeedbackSummary(eventId),
    enabled: !!eventId,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateFeedbackSummary(eventId),
    onSuccess: (res) => {
      if (res.success && res.summary) {
        queryClient.setQueryData(["event_feedback_llm_summary", eventId], res.summary);
        setFeedbackNotice({
          type: "success",
          text: `Synthesized executive summary from ${res.summary.review_count} student reviews!`,
        });
      } else if (res.isDataScarcity) {
        setFeedbackNotice({
          type: "warning",
          text: res.message || "Insufficient survey responses to generate LLM summary.",
        });
      } else {
        setFeedbackNotice({
          type: "error",
          text: res.error || "Failed to generate LLM summary.",
        });
      }
    },
    onError: (err: any) => {
      setFeedbackNotice({
        type: "error",
        text: err.message || "An unexpected error occurred.",
      });
    },
  });

  return (
    <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-none border-2 border-black bg-purple-200">
            <Sparkles className="h-4 w-4 text-purple-900" />
          </div>
          <div>
            <h3 className="font-display text-lg font-black uppercase tracking-wider text-black">
              Executive AI Feedback Summary
            </h3>
            <p className="font-mono text-xs text-black/60">
              Synthesized actionable insights powered by LLM consultant
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="inline-flex items-center justify-center gap-2 border-2 border-black bg-yellow-300 px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0_0_#000] transition-all hover:bg-yellow-400 hover:shadow-[3px_3px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${generateMutation.isPending ? "animate-spin" : ""}`} />
          {generateMutation.isPending
            ? "Analyzing..."
            : summary
              ? "Re-Generate Summary"
              : "Generate LLM Summary"}
        </button>
      </div>

      {feedbackNotice && (
        <div
          className={`mt-4 flex items-center gap-2 border-2 border-black p-3 font-mono text-xs ${
            feedbackNotice.type === "success"
              ? "bg-green-100 text-green-900"
              : feedbackNotice.type === "warning"
                ? "bg-yellow-100 text-yellow-900"
                : "bg-red-100 text-red-900"
          }`}
        >
          {feedbackNotice.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {feedbackNotice.type === "warning" && <AlertCircle className="h-4 w-4 shrink-0" />}
          {feedbackNotice.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{feedbackNotice.text}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center font-mono text-sm text-black/50">
          Loading feedback summary...
        </div>
      ) : summary ? (
        <div className="mt-5 space-y-6">
          {/* Top 3 Positives & Top 3 Improvements Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Top 3 Done Well */}
            <div className="border-2 border-black bg-emerald-50 p-4 shadow-[2px_2px_0_0_#000]">
              <div className="flex items-center gap-2 border-b border-black/20 pb-2">
                <ThumbsUp className="h-4 w-4 text-emerald-800" />
                <h4 className="font-mono text-xs font-black uppercase text-emerald-950">
                  Top 3 Things Done Well
                </h4>
              </div>
              <ul className="mt-3 space-y-2 font-mono text-xs text-black/80">
                {summary.top_positives && summary.top_positives.length > 0 ? (
                  summary.top_positives.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-mono text-[10px] font-black text-white">
                        {idx + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="italic text-black/50">No key positives identified yet.</li>
                )}
              </ul>
            </div>

            {/* Top 3 Must Improve */}
            <div className="border-2 border-black bg-rose-50 p-4 shadow-[2px_2px_0_0_#000]">
              <div className="flex items-center gap-2 border-b border-black/20 pb-2">
                <Wrench className="h-4 w-4 text-rose-800" />
                <h4 className="font-mono text-xs font-black uppercase text-rose-950">
                  Top 3 Must Improve Next Time
                </h4>
              </div>
              <ul className="mt-3 space-y-2 font-mono text-xs text-black/80">
                {summary.top_improvements && summary.top_improvements.length > 0 ? (
                  summary.top_improvements.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-600 font-mono text-[10px] font-black text-white">
                        {idx + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="italic text-black/50">No improvement items identified yet.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Full Markdown Executive Breakdown */}
          {summary.executive_summary_markdown && (
            <div className="border-2 border-black bg-neutral-50 p-4">
              <div className="flex items-center gap-2 border-b border-black/20 pb-2 mb-3">
                <FileText className="h-4 w-4 text-black" />
                <h4 className="font-mono text-xs font-black uppercase text-black">
                  Full Executive Consultant Report
                </h4>
              </div>
              <div className="prose prose-sm max-w-none font-mono text-xs text-black/90 whitespace-pre-wrap">
                {summary.executive_summary_markdown}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-black/10 pt-3 font-mono text-[11px] text-black/50">
            <span>Based on {summary.review_count} raw survey responses</span>
            {summary.generated_at && (
              <span>Generated {new Date(summary.generated_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 border-2 border-dashed border-black/30 p-6 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-black/30 mb-2" />
          <p className="font-display font-bold text-sm uppercase text-black/70">
            No Executive LLM Summary Generated Yet
          </p>
          <p className="mt-1 font-mono text-xs text-black/50">
            {responseCount > 0
              ? `${responseCount} attendee survey responses available. Click above to generate an executive synthesis.`
              : "Waiting for post-event survey submissions before generating actionable insights."}
          </p>
        </div>
      )}
    </div>
  );
};
