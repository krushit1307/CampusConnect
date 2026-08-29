import React, { useState } from "react";
import { Lock, FileText, CheckCircle2, AlertTriangle, ArrowRight, Star, X } from "lucide-react";
import { saveEventPostMortem, type PendingPostMortemEvent } from "@/services/eventPostMortemService";
import { toast } from "sonner";

export interface PostMortemGatingModalProps {
  pendingEvents: PendingPostMortemEvent[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PostMortemGatingModal: React.FC<PostMortemGatingModalProps> = ({
  pendingEvents,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedEventIndex, setSelectedEventIndex] = useState(0);
  const [whatWentWell, setWhatWentWell] = useState("");
  const [whatFailed, setWhatFailed] = useState("");
  const [adviceForNextYear, setAdviceForNextYear] = useState("");
  const [logisticsScore, setLogisticsScore] = useState(4);
  const [budgetAccuracyScore, setBudgetAccuracyScore] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !pendingEvents || pendingEvents.length === 0) {
    return null;
  }

  const currentEvent = pendingEvents[selectedEventIndex];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatWentWell.trim() || !whatFailed.trim() || !adviceForNextYear.trim()) {
      toast.error("Please answer all retrospective questions.");
      return;
    }

    setIsSubmitting(true);
    const res = await saveEventPostMortem({
      event_id: currentEvent.event_id,
      club_id: currentEvent.club_id,
      what_went_well: whatWentWell.trim(),
      what_failed: whatFailed.trim(),
      advice_for_next_year: adviceForNextYear.trim(),
      logistics_score: logisticsScore,
      budget_accuracy_score: budgetAccuracyScore,
    });

    setIsSubmitting(false);

    if (res.success) {
      toast.success(`Post-mortem saved for "${currentEvent.title}"!`);
      if (selectedEventIndex < pendingEvents.length - 1) {
        setSelectedEventIndex((idx) => idx + 1);
        setWhatWentWell("");
        setWhatFailed("");
        setAdviceForNextYear("");
      } else {
        onSuccess();
        onClose();
      }
    } else {
      toast.error(res.error || "Failed to save retrospective.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000]">
        <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-red-500 text-white">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-black uppercase text-black">
                Event Creation Locked: Pending Post-Mortem
              </h2>
              <p className="font-mono text-xs text-black/60">
                Retrospective required for: <strong>{currentEvent.title}</strong> ({selectedEventIndex + 1} of {pendingEvents.length})
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4 border-2 border-amber-600 bg-amber-50 p-3 font-mono text-xs text-amber-900">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
            Institutional Memory Policy:
          </p>
          <p className="mt-1">
            24 hours have passed since &quot;{currentEvent.title}&quot;. To prevent repeating logistical mistakes in future years, complete this 5-question retrospective to unlock event creation.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
          {/* Question 1 */}
          <div>
            <label className="block font-bold uppercase text-black mb-1">
              1. What went exceptionally well? (Praise & Highlights)
            </label>
            <textarea
              required
              rows={2}
              value={whatWentWell}
              onChange={(e) => setWhatWentWell(e.target.value)}
              placeholder="e.g. Turnout was high, speaker was engaging, check-in QR scanner was fast."
              className="w-full border-2 border-black p-2 font-mono text-xs outline-none focus:bg-neutral-50"
            />
          </div>

          {/* Question 2 */}
          <div>
            <label className="block font-bold uppercase text-black mb-1">
              2. What failed or caused logistical friction? (Bottlenecks)
            </label>
            <textarea
              required
              rows={2}
              value={whatFailed}
              onChange={(e) => setWhatFailed(e.target.value)}
              placeholder="e.g. 50 pizzas wasn't enough, room audio echo, registration queue delayed start."
              className="w-full border-2 border-black p-2 font-mono text-xs outline-none focus:bg-neutral-50"
            />
          </div>

          {/* Question 3 */}
          <div>
            <label className="block font-bold uppercase text-black mb-1">
              3. Crucial Advice for Next Year&apos;s Organizer Board
            </label>
            <textarea
              required
              rows={2}
              value={adviceForNextYear}
              onChange={(e) => setAdviceForNextYear(e.target.value)}
              placeholder="e.g. Order 75 pizzas instead of 50, test microphone 1 hour before, book Room 204."
              className="w-full border-2 border-black p-2 font-mono text-xs outline-none focus:bg-neutral-50"
            />
          </div>

          {/* Scores (Questions 4 & 5) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-black/20 pt-3">
            <div>
              <label className="block font-bold uppercase text-black mb-1">
                4. Logistics Execution Score (1-5)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setLogisticsScore(score)}
                    className={`h-8 flex-1 border-2 border-black font-mono text-xs font-black ${
                      logisticsScore === score ? "bg-black text-white" : "bg-white text-black"
                    }`}
                  >
                    {score}★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold uppercase text-black mb-1">
                5. Budget Accuracy Score (1-5)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setBudgetAccuracyScore(score)}
                    className={`h-8 flex-1 border-2 border-black font-mono text-xs font-black ${
                      budgetAccuracyScore === score ? "bg-black text-white" : "bg-white text-black"
                    }`}
                  >
                    {score}★
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t-2 border-black">
            <button
              type="button"
              onClick={onClose}
              className="border-2 border-black bg-neutral-200 px-4 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:bg-neutral-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="border-2 border-black bg-lime-400 px-5 py-2 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0_0_#000] hover:bg-lime-500 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Save Retrospective & Unlock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
