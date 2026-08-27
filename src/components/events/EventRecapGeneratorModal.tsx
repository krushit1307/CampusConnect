import React, { useState } from "react";
import {
  Sparkles,
  Wand2,
  FileText,
  Send,
  X,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
} from "lucide-react";
import {
  generateEventRecap,
  publishRecapToClubFeed,
  type RecapTone,
} from "../../lib/eventRecapGenerator";
import { createClient } from "../../lib/supabase/client";

export interface EventRecapGeneratorModalProps {
  eventId: string;
  clubId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function EventRecapGeneratorModal({
  eventId,
  clubId,
  isOpen,
  onClose,
}: EventRecapGeneratorModalProps) {
  const [tone, setTone] = useState<RecapTone>("hype");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [recapTitle, setRecapTitle] = useState("");
  const [markdownContent, setMarkdownContent] = useState("");
  const [heroPhotos, setHeroPhotos] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setFeedback(null);

    const res = await generateEventRecap(eventId, tone);

    if (res.success && res.recapMarkdown) {
      setRecapTitle(`Recap: ${res.eventTitle || "Event Highlights"}`);
      setMarkdownContent(res.recapMarkdown);
      setHeroPhotos(res.heroPhotos || []);
      setFeedback({
        type: "success",
        text: `AI compiled the recap using ${res.attendanceCount || 0} attendee insights!`,
      });
    } else if (res.isDataScarcity) {
      setFeedback({
        type: "warning",
        text:
          res.error ||
          "Data Scarcity: Event has too few verified attendees to generate an authentic recap.",
      });
    } else {
      setFeedback({
        type: "error",
        text: res.error || "Failed to generate recap.",
      });
    }

    setIsGenerating(false);
  };

  const handlePublish = async () => {
    if (!markdownContent.trim()) return;

    setIsPublishing(true);
    setFeedback(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const targetClubId = clubId || "default-club";
      const res = await publishRecapToClubFeed(
        targetClubId,
        recapTitle || "Event Recap",
        markdownContent,
        heroPhotos,
        user?.id,
      );

      if (res.success) {
        setFeedback({
          type: "success",
          text: "Recap article successfully published to your club's news feed!",
        });
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setFeedback({ type: "error", text: res.message });
      }
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                AI Event Recap Generator
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Compile attendance, Q&A, poll results, and top photos into a post-event article.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Controls Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Recap Tone:
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as RecapTone)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="hype">🎉 Hype & Energetic</option>
                <option value="professional">🎓 Professional & Academic</option>
                <option value="casual">☕ Casual & Community</option>
              </select>
            </div>

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerate}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-purple-500 disabled:opacity-50"
            >
              <Wand2 className="h-4 w-4" />
              {isGenerating ? "Synthesizing Recap..." : "Generate AI Recap"}
            </button>
          </div>

          {feedback && (
            <div
              role="alert"
              className={`flex items-start gap-2.5 rounded-xl p-4 text-xs font-medium ${
                feedback.type === "success"
                  ? "bg-green-50 text-green-800 dark:bg-green-950/50 dark:text-green-300"
                  : feedback.type === "warning"
                    ? "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                    : "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300"
              }`}
            >
              {feedback.type === "warning" ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              ) : feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
              ) : null}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Editor Draft Area */}
          {markdownContent ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Article Title
                </label>
                <input
                  type="text"
                  value={recapTitle}
                  onChange={(e) => setRecapTitle(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Markdown Content (Editable)
                </label>
                <textarea
                  rows={10}
                  value={markdownContent}
                  onChange={(e) => setMarkdownContent(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 font-mono text-xs leading-relaxed shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Top Photo Selection Preview */}
              {heroPhotos.length > 0 && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    <ImageIcon className="h-3.5 w-3.5" /> Embedded Hero Photos ({heroPhotos.length})
                  </label>
                  <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
                    {heroPhotos.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Hero photo ${i + 1}`}
                        className="h-20 w-28 rounded-lg object-cover shadow-sm border border-slate-200 dark:border-slate-700"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800">
              <FileText className="h-10 w-10 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                No draft generated yet.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Select your preferred tone above and click "Generate AI Recap" to synthesize
                post-event data.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!markdownContent.trim() || isPublishing}
            onClick={handlePublish}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            {isPublishing ? "Publishing to Feed..." : "Publish to Club Feed"}
          </button>
        </div>
      </div>
    </div>
  );
}
