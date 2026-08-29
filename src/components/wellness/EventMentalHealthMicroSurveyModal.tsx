// =============================================================================
// File: src/components/wellness/EventMentalHealthMicroSurveyModal.tsx
// Task: Dynamic Mental Health — Automated Event Micro-Survey Engine
// Description: Attendee-facing micro-survey modal automatically triggered for events
//              tagged 'High Stress' or lasting > 12 hours. Collects stress levels,
//              break compliance, and surfaces immediate crisis support when needed.
// =============================================================================

import { useState } from "react";
import {
  HeartPulse,
  Sparkles,
  Droplets,
  Users,
  ShieldAlert,
  X,
  CheckCircle2,
} from "lucide-react";
import {
  shouldTriggerMentalHealthSurvey,
  submitMicroSurveyResponse,
  type EventSurveyTriggerInput,
} from "@/services/eventMentalHealthSurveyService";
import { CrisisSafetyEscalationDrawer } from "@/components/wellness/CrisisSafetyEscalationDrawer";
import { toast } from "sonner";

export interface EventMentalHealthMicroSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventSurveyTriggerInput;
  userId?: string;
  onSubmitted?: () => void;
}

export function EventMentalHealthMicroSurveyModal({
  isOpen,
  onClose,
  event,
  userId,
  onSubmitted,
}: EventMentalHealthMicroSurveyModalProps) {
  const [stressLevel, setStressLevel] = useState<number>(3);
  const [hasHydratedAndRested, setHasHydratedAndRested] = useState<boolean>(true);
  const [requestsPeerSupport, setRequestsPeerSupport] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showCrisisDrawer, setShowCrisisDrawer] = useState<boolean>(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);

  if (!isOpen || !event || !shouldTriggerMentalHealthSurvey(event)) {
    return null;
  }

  const handleRatingSelect = (level: number) => {
    setStressLevel(level);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await submitMicroSurveyResponse({
        eventId: event.id || "current-event",
        userId,
        stressLevel,
        hasHydratedAndRested,
        requestsPeerSupport,
      });

      setSubmittedSuccess(true);
      toast.success("Wellness pulse check submitted! Remember to stay hydrated.");

      if (result.isCrisisEscalated) {
        setShowCrisisDrawer(true);
      }

      if (onSubmitted) {
        onSubmitted();
      }
    } catch (err) {
      toast.error("Failed to submit micro-survey response.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        data-testid="mental-health-survey-overlay"
      >
        <div
          className="relative w-full max-w-lg border-4 border-black bg-white shadow-[8px_8px_0_0_#000] overflow-hidden"
          data-testid="mental-health-survey-modal"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-4 border-black bg-teal-400 p-4">
            <div className="flex items-center gap-3">
              <div className="border-2 border-black bg-black p-2 text-teal-400">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-lg font-black uppercase tracking-tight text-black">
                  Event Wellness Pulse Check
                </h2>
                <p className="font-mono text-xs font-bold text-black/80">
                  {event.title || "High Intensity Event"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="border-2 border-black bg-white p-1 hover:bg-black hover:text-white cursor-pointer transition-colors"
              aria-label="Close modal"
              data-testid="survey-modal-close-button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {submittedSuccess ? (
              <div
                className="text-center py-6 space-y-4 font-mono"
                data-testid="survey-submitted-success-state"
              >
                <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
                <h3 className="font-display text-xl font-black uppercase text-black">
                  Pulse Check Logged!
                </h3>
                <p className="text-xs text-gray-700 leading-relaxed max-w-xs mx-auto">
                  Thanks for checking in with yourself. Taking regular 5-minute breaks and drinking water keeps focus high!
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="border-2 border-black bg-black text-white font-mono text-xs font-bold uppercase px-4 py-2 hover:bg-zinc-800 cursor-pointer shadow-[2px_2px_0_0_#000]"
                    data-testid="survey-done-button"
                  >
                    Back to Event
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Trigger Info Alert */}
                <div
                  className="border-2 border-black bg-teal-50 p-3 flex items-start gap-2.5 shadow-[2px_2px_0_0_#000]"
                  data-testid="survey-trigger-reason-banner"
                >
                  <Sparkles className="h-4 w-4 text-teal-700 flex-shrink-0 mt-0.5" />
                  <p className="font-mono text-xs text-teal-950 leading-snug">
                    This event is flagged for high intensity or extended duration (&gt;12h). Take 30 seconds to gauge your energy and stress.
                  </p>
                </div>

                {/* Question 1: Stress Level (1-5 Scale) */}
                <div className="space-y-2">
                  <label className="block font-mono text-xs font-black uppercase text-black">
                    1. Current Stress & Exhaustion Level
                  </label>
                  <div className="grid grid-cols-5 gap-1.5" data-testid="stress-level-selector">
                    {[
                      { level: 1, label: "Relaxed", emoji: "😌", color: "bg-emerald-100 hover:bg-emerald-300" },
                      { level: 2, label: "Manageable", emoji: "🙂", color: "bg-green-100 hover:bg-green-300" },
                      { level: 3, label: "Moderate", emoji: "😐", color: "bg-yellow-100 hover:bg-yellow-300" },
                      { level: 4, label: "Stressed", emoji: "😰", color: "bg-orange-100 hover:bg-orange-300" },
                      { level: 5, label: "Burned Out", emoji: "😫", color: "bg-rose-100 hover:bg-rose-300" },
                    ].map((item) => (
                      <button
                        key={item.level}
                        type="button"
                        onClick={() => handleRatingSelect(item.level)}
                        className={`border-2 border-black p-2 flex flex-col items-center gap-1 cursor-pointer transition-all ${
                          stressLevel === item.level
                            ? "bg-black text-white shadow-[2px_2px_0_0_#000] scale-105"
                            : `${item.color} text-black`
                        }`}
                        data-testid={`stress-level-btn-${item.level}`}
                      >
                        <span className="text-xl">{item.emoji}</span>
                        <span className="font-mono text-[9px] font-bold uppercase tracking-tight">
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question 2: Hydration & Rest Check */}
                <div className="space-y-2">
                  <label className="block font-mono text-xs font-black uppercase text-black flex items-center gap-1.5">
                    <Droplets className="h-4 w-4 text-cyan-600" />
                    2. Have you hydrated & taken a break in the last 4h?
                  </label>
                  <div className="grid grid-cols-2 gap-3" data-testid="hydration-rest-selector">
                    <button
                      type="button"
                      onClick={() => setHasHydratedAndRested(true)}
                      className={`border-2 border-black p-2.5 font-mono text-xs font-bold uppercase cursor-pointer transition-colors ${
                        hasHydratedAndRested
                          ? "bg-emerald-400 text-black shadow-[2px_2px_0_0_#000]"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      data-testid="hydration-yes-btn"
                    >
                      Yes, Hydrated & Rested
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasHydratedAndRested(false)}
                      className={`border-2 border-black p-2.5 font-mono text-xs font-bold uppercase cursor-pointer transition-colors ${
                        !hasHydratedAndRested
                          ? "bg-amber-400 text-black shadow-[2px_2px_0_0_#000]"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      data-testid="hydration-no-btn"
                    >
                      No / Need a Break
                    </button>
                  </div>
                </div>

                {/* Question 3: Peer Support Request */}
                <div className="space-y-2">
                  <label className="block font-mono text-xs font-black uppercase text-black flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-purple-600" />
                    3. Would you like to connect with a Peer Listener?
                  </label>
                  <div className="grid grid-cols-2 gap-3" data-testid="peer-support-selector">
                    <button
                      type="button"
                      onClick={() => setRequestsPeerSupport(false)}
                      className={`border-2 border-black p-2.5 font-mono text-xs font-bold uppercase cursor-pointer transition-colors ${
                        !requestsPeerSupport
                          ? "bg-gray-200 text-black shadow-[2px_2px_0_0_#000]"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      data-testid="peer-support-no-btn"
                    >
                      No Thanks, I'm Good
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestsPeerSupport(true)}
                      className={`border-2 border-black p-2.5 font-mono text-xs font-bold uppercase cursor-pointer transition-colors ${
                        requestsPeerSupport
                          ? "bg-purple-400 text-black shadow-[2px_2px_0_0_#000]"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      data-testid="peer-support-yes-btn"
                    >
                      Yes, Connect Me
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="border-2 border-black bg-white hover:bg-gray-100 text-black font-mono text-xs font-bold uppercase px-4 py-2 cursor-pointer shadow-[2px_2px_0_0_#000]"
                  >
                    Skip
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="border-2 border-black bg-teal-400 hover:bg-teal-500 text-black font-mono text-xs font-black uppercase px-5 py-2 cursor-pointer shadow-[2px_2px_0_0_#000] active:translate-y-[1px] disabled:opacity-50"
                    data-testid="submit-survey-button"
                  >
                    {isSubmitting ? "Logging..." : "Submit Pulse Check"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Crisis & Peer Support Escalation Drawer */}
      <CrisisSafetyEscalationDrawer
        isOpen={showCrisisDrawer}
        onClose={() => setShowCrisisDrawer(false)}
        isTriggeredByKeyword={stressLevel >= 5}
      />
    </>
  );
}
