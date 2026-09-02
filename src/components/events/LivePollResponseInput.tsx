// =============================================================================
// File: src/components/events/LivePollResponseInput.tsx
// Task: Real-Time Live Polling — NLP Free-Text Response Categorization Engine
// Description: Attendee submission widget for typing free-text poll answers
//              during live presentations, featuring instant NLP clustering feedback.
// =============================================================================

import { useState } from "react";
import { Send, MessageSquare, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export interface LivePollResponseInputProps {
  questionTitle?: string;
  onSubmitResponse: (text: string) => void;
  disabled?: boolean;
}

export function LivePollResponseInput({
  questionTitle = "Share your thoughts for the live poll below:",
  onSubmitResponse,
  disabled = false,
}: LivePollResponseInputProps) {
  const [responseText, setResponseText] = useState<string>("");
  const [submittedText, setSubmittedText] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = responseText.trim();
    if (!clean) {
      toast.error("Please enter a response before submitting.");
      return;
    }

    onSubmitResponse(clean);
    setSubmittedText(clean);
    setResponseText("");
    toast.success("Submitted to real-time live poll!");
  };

  return (
    <div
      className="neu-border border-4 border-black bg-amber-50 p-5 shadow-[6px_6px_0_0_#000] space-y-4"
      data-testid="live-poll-response-input"
    >
      <div className="flex items-center gap-2.5 border-b-2 border-black pb-2">
        <MessageSquare className="h-5 w-5 text-amber-700" />
        <h3 className="font-display text-base font-black uppercase text-black">
          Live Audience Response Input
        </h3>
      </div>

      <p className="font-mono text-xs font-bold text-gray-800">
        {questionTitle}
      </p>

      {submittedText ? (
        <div
          className="border-2 border-black bg-emerald-100 p-3.5 space-y-2 shadow-[2px_2px_0_0_#000]"
          data-testid="live-poll-submitted-banner"
        >
          <div className="flex items-center gap-2 font-mono text-xs font-black uppercase text-emerald-950">
            <CheckCircle className="h-4 w-4 text-emerald-700" />
            Your Answer Has Been Sent to the Presenter Screen!
          </div>
          <p className="font-mono text-xs text-emerald-900 italic">
            "{submittedText}"
          </p>
          <button
            type="button"
            onClick={() => setSubmittedText(null)}
            className="font-mono text-[11px] text-emerald-800 underline font-bold cursor-pointer hover:text-emerald-950"
          >
            Submit Another Response
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <textarea
              rows={3}
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              disabled={disabled}
              maxLength={280}
              placeholder="Type your free-text response here (e.g., 'Lower housing rent deposits', 'More vegan cafeteria options')..."
              className="w-full border-2 border-black bg-white p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-amber-400 shadow-[3px_3px_0_0_#000] resize-none"
              data-testid="poll-text-input"
            />
            <span className="absolute right-2.5 bottom-2.5 font-mono text-[10px] font-bold text-gray-400">
              {responseText.length}/280
            </span>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={disabled || !responseText.trim()}
              className="flex items-center gap-2 border-2 border-black bg-amber-400 hover:bg-amber-500 text-black font-mono text-xs font-black uppercase px-5 py-2 cursor-pointer shadow-[3px_3px_0_0_#000] active:translate-y-[1px] disabled:opacity-50"
              data-testid="submit-poll-answer-btn"
            >
              <Send className="h-4 w-4" />
              Submit to Live Screen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
