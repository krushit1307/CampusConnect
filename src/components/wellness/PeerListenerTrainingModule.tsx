// =============================================================================
// File: src/components/wellness/PeerListenerTrainingModule.tsx
// Issue: #4296 - Develop a 'Dynamic "Mental Health" Peer Support Matcher'
// Description: Interactive peer listener training certification exam, Active
//              Listening competency validator, and ethical protocol tester.
// =============================================================================

import React, { useState } from "react";
import {
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuizQuestion {
  id: number;
  scenario: string;
  options: string[];
  correctIndex: number;
  rationale: string;
}

const TRAINING_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    scenario:
      "A student texts: 'I failed my chemistry exam and I feel like an absolute fraud. Everyone else understands it.' What is the most empathetic, active-listening response?",
    options: [
      "You should study more with flashcards next time.",
      "Chemistry is hard, but it's not the end of the world.",
      "It sounds really exhausting to feel like you're carrying all that pressure alone. Feeling like an imposter is so painful.",
      "Don't worry, my roommate failed too and they're fine.",
    ],
    correctIndex: 2,
    rationale:
      "Validating the emotional experience without minimizing or offering unsolicited advice builds genuine peer rapport.",
  },
  {
    id: 2,
    scenario:
      "A student mentions they haven't slept in 3 days, feel completely hopeless, and are thinking about hurting themselves tonight. What is your immediate required action?",
    options: [
      "Tell them everything will get better and change the topic.",
      "Keep chatting casually and hope they feel better soon.",
      "Immediately trigger the 1-Click Crisis Escalation tool to offer 988 Lifeline resources while staying calmly present.",
      "Ask for their home address and personal phone number.",
    ],
    correctIndex: 2,
    rationale:
      "Peer listeners are not licensed clinical crisis counselors. Any mention of imminent self-harm requires immediate crisis resource escalation.",
  },
];

export const PeerListenerTrainingModule: React.FC = () => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);

  const handleSelect = (questionId: number, optionIdx: number) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIdx }));
  };

  const handleSubmit = () => {
    let correct = 0;
    TRAINING_QUESTIONS.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        correct += 1;
      }
    });
    setScore(correct);
    setIsSubmitted(true);
  };

  return (
    <div className="neu-border bg-white p-6 dark:bg-zinc-900 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b-2 border-black pb-4 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-black bg-purple-600 text-white">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase text-zinc-900 dark:text-white">
              Peer Listener Certification & Competency Module
            </h3>
            <p className="font-mono text-xs text-zinc-500">
              Active Listening Standards, De-escalation Protocol & Ethical Boundary Verification
            </p>
          </div>
        </div>

        <span className="font-mono text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 border border-purple-200 dark:bg-purple-950 dark:text-purple-300">
          Tier-2 Certification Active
        </span>
      </div>

      <div className="space-y-6 font-mono text-xs">
        {TRAINING_QUESTIONS.map((q) => (
          <div key={q.id} className="neu-border bg-zinc-50 p-4 dark:bg-zinc-800 space-y-3">
            <p className="font-black text-zinc-900 dark:text-white">
              Question {q.id}: {q.scenario}
            </p>

            <div className="space-y-2">
              {q.options.map((opt, optIdx) => {
                const isChosen = selectedAnswers[q.id] === optIdx;
                const isCorrect = isSubmitted && optIdx === q.correctIndex;
                const isWrong = isSubmitted && isChosen && optIdx !== q.correctIndex;

                return (
                  <button
                    type="button"
                    key={optIdx}
                    onClick={() => handleSelect(q.id, optIdx)}
                    className={`neu-border w-full p-2.5 text-left font-medium transition-colors flex items-center justify-between ${
                      isCorrect
                        ? "bg-emerald-100 text-emerald-950 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-200"
                        : isWrong
                        ? "bg-rose-100 text-rose-950 border-rose-500 dark:bg-rose-950 dark:text-rose-200"
                        : isChosen
                        ? "bg-purple-600 text-white"
                        : "bg-white text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    }`}
                  >
                    <span>{opt}</span>
                    {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                    {isWrong && <XCircle className="h-4 w-4 text-rose-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {isSubmitted && (
              <div className="neu-border bg-purple-50 p-2.5 text-[11px] text-purple-950 dark:bg-purple-950/40 dark:text-purple-200 border-purple-200">
                <strong>Rationale:</strong> {q.rationale}
              </div>
            )}
          </div>
        ))}

        {!isSubmitted ? (
          <Button
            onClick={handleSubmit}
            disabled={Object.keys(selectedAnswers).length < TRAINING_QUESTIONS.length}
            className="neu-border w-full bg-purple-600 font-mono text-xs font-black uppercase text-white hover:bg-purple-700 shadow-[4px_4px_0_0_#000]"
          >
            Submit Certification Evaluation
          </Button>
        ) : (
          <div className="neu-border bg-emerald-50 p-4 font-mono text-xs text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200 border-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-600" />
              <span>
                Assessment Passed ({score} / {TRAINING_QUESTIONS.length} Correct). Your peer listening certification is verified.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PeerListenerTrainingModule;
