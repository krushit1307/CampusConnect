import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

interface AdminQuizProps {
  clubId: string;
  onPass: () => void;
}

const QUIZ_QUESTIONS = [
  {
    question:
      "What is the maximum amount a club can spend without prior approval from the Student Union?",
    options: ["$100", "$500", "$1,000", "$5,000"],
    correctIndex: 1,
  },
  {
    question: "Who is legally responsible for any unapproved contracts signed by a club leader?",
    options: [
      "The University",
      "The Student Union",
      "The individual who signed the contract",
      "The club members equally",
    ],
    correctIndex: 2,
  },
  {
    question: "How long must financial records (receipts, invoices) be retained by the club?",
    options: ["1 semester", "1 year", "3 years", "7 years"],
    correctIndex: 3,
  },
  {
    question: "Can a club use university funds to purchase alcohol for a general meeting?",
    options: [
      "Yes, if members are 21+",
      "Yes, if it's off-campus",
      "No, under no circumstances",
      "Only with advisor approval",
    ],
    correctIndex: 2,
  },
  {
    question: "What is the deadline for submitting the annual club budget request?",
    options: [
      "First week of Fall semester",
      "April 15th of the prior academic year",
      "January 1st",
      "End of Spring semester",
    ],
    correctIndex: 1,
  },
  {
    question: "If a club receives a cash donation at an event, what must be done with the funds?",
    options: [
      "Deposited into the club's off-campus bank account",
      "Deposited into the University Club Ledger within 1 business day",
      "Kept in a lockbox for future events",
      "Distributed among club officers",
    ],
    correctIndex: 1,
  },
  {
    question: "Which of the following requires a formal vendor agreement?",
    options: [
      "Ordering $50 of pizza from a local shop",
      "Hiring a DJ for $200",
      "Buying supplies from a grocery store",
      "Printing flyers at the library",
    ],
    correctIndex: 1,
  },
  {
    question: "What happens if a club overdraws its ledger balance?",
    options: [
      "The university automatically covers the difference",
      "The club is frozen and officers face disciplinary action",
      "The debt rolls over to the next year",
      "Nothing, it's just a warning",
    ],
    correctIndex: 1,
  },
  {
    question: "True or False: Club officers can use club funds to pay themselves a salary.",
    options: ["True", "False"],
    correctIndex: 1,
  },
  {
    question:
      "If an officer suspects financial mismanagement by another leader, who should they contact first?",
    options: [
      "Post about it on the club's social media",
      "The University Student Activities Office",
      "Confront the leader privately and do nothing else",
      "The campus newspaper",
    ],
    correctIndex: 1,
  },
];

export function AdminQuiz({ clubId, onPass }: AdminQuizProps) {
  const supabase = createClient();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const handleSelect = (optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion]: optionIndex }));
  };

  const handleNext = () => {
    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    let correct = 0;
    QUIZ_QUESTIONS.forEach((q, idx) => {
      if (answers[idx] === q.correctIndex) {
        correct++;
      }
    });

    const calculatedScore = (correct / QUIZ_QUESTIONS.length) * 100;
    setScore(calculatedScore);

    if (calculatedScore === 100) {
      setIsSubmitting(true);
      try {
        const { error } = await supabase.rpc("pass_admin_quiz", { club_id_param: clubId });
        if (error) throw error;
        toast.success("Quiz passed! Administrator access unlocked.");
        onPass();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to update role.");
        setIsSubmitting(false);
      }
    } else {
      toast.error(`You scored ${calculatedScore}%. 100% is required to pass.`);
    }
  };

  const handleRetake = () => {
    setScore(null);
    setAnswers({});
    setCurrentQuestion(0);
    setIsSubmitting(false);
  };

  if (score !== null && score < 100) {
    return (
      <div className="neu-border bg-white p-8 max-w-2xl mx-auto mt-12 text-center space-y-6">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
        <h2 className="font-display text-3xl font-bold text-black uppercase">Quiz Failed</h2>
        <p className="font-mono text-lg text-gray-700">
          You scored <span className="font-bold text-red-600">{score}%</span>. You must score
          exactly 100% to unlock administrative privileges.
        </p>
        <button
          onClick={handleRetake}
          className="neu-border neu-press bg-black text-white px-6 py-3 font-mono font-bold uppercase hover:-translate-y-1 transition-transform flex items-center justify-center gap-2 mx-auto w-full sm:w-auto"
        >
          <RefreshCw size={18} /> Retake Quiz
        </button>
      </div>
    );
  }

  if (isSubmitting) {
    return (
      <div className="neu-border bg-white p-8 max-w-2xl mx-auto mt-12 text-center space-y-6">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto animate-pulse" />
        <h2 className="font-display text-3xl font-bold text-black uppercase">Quiz Passed!</h2>
        <p className="font-mono text-gray-700">Unlocking your administrative dashboard...</p>
      </div>
    );
  }

  const q = QUIZ_QUESTIONS[currentQuestion];
  const isAnswered = answers[currentQuestion] !== undefined;

  return (
    <div className="neu-border bg-white p-8 max-w-2xl mx-auto mt-12">
      <div className="mb-8 border-b-2 border-black pb-4">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-black">
          Mandatory Pre-Flight Training
        </h2>
        <p className="font-mono text-sm text-gray-600 mt-2">
          University Financial Compliance &amp; Leadership Policy
        </p>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center font-mono text-xs font-bold text-gray-500 mb-2 uppercase">
          <span>
            Question {currentQuestion + 1} of {QUIZ_QUESTIONS.length}
          </span>
          <span>100% Required to Pass</span>
        </div>
        <div className="w-full bg-gray-200 h-2 neu-border overflow-hidden rounded-none">
          <div
            className="bg-lime h-full transition-all duration-300 border-r-2 border-black"
            style={{ width: `${(currentQuestion / QUIZ_QUESTIONS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="font-mono text-lg font-bold text-black">{q.question}</h3>
        <div className="space-y-3">
          {q.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              className={`w-full text-left p-4 font-mono text-sm border-2 transition-all ${
                answers[currentQuestion] === idx
                  ? "border-black bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-1"
                  : "border-black bg-white text-black hover:bg-gray-50"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 pt-4 border-t-2 border-black flex justify-between items-center">
        <button
          onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
          disabled={currentQuestion === 0}
          className="font-mono text-sm font-bold uppercase text-gray-500 hover:text-black disabled:opacity-30 transition-colors"
        >
          &larr; Previous
        </button>
        <button
          onClick={handleNext}
          disabled={!isAnswered}
          className="neu-border neu-press bg-lime text-black px-6 py-2 font-mono text-sm font-bold uppercase hover:-translate-y-1 transition-transform disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {currentQuestion === QUIZ_QUESTIONS.length - 1 ? "Submit Quiz" : "Next \u2192"}
        </button>
      </div>
    </div>
  );
}
