export type ViolationCategory = "Hate Speech" | "Harassment" | "Spam" | "Profanity";

export interface QuizQuestion {
  id: number;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
}

export interface QuizSubmission {
  userId: string;
  category: ViolationCategory;
  answers: Record<number, number>; // Question ID -> Selected option index
}

export interface QuizEvaluationResult {
  scorePercentage: number;
  isPassed: boolean;
  activeStrikesApplied: number;
  newModerationStatus: "active" | "remediation_required" | "permanently_banned";
  message: string;
}

export const CATEGORY_QUIZ_BANKS: Record<ViolationCategory, QuizQuestion[]> = {
  "Hate Speech": [
    {
      id: 1,
      questionText: "Is targeted hate speech permitted in public event chats?",
      options: ["Yes", "No, never", "Only if joking"],
      correctOptionIndex: 1,
    },
    {
      id: 2,
      questionText: "What happens upon a second verified policy violation?",
      options: ["Warning", "1-day timeout", "Permanent account ban"],
      correctOptionIndex: 2,
    },
    {
      id: 3,
      questionText: "How should you handle offensive content posted by others?",
      options: ["Reply angrily", "Report to moderators", "Ignore completely"],
      correctOptionIndex: 1,
    },
    {
      id: 4,
      questionText: "Are anonymous hate comments protected on CampusConnect?",
      options: ["Yes", "No, accounts are tied to verified identity", "Only for clubs"],
      correctOptionIndex: 1,
    },
    {
      id: 5,
      questionText: "What is the primary goal of the Community Guidelines?",
      options: ["Ensure safe inclusive spaces", "Restrict free speech", "Increase ad revenue"],
      correctOptionIndex: 0,
    },
  ],
  Harassment: [
    {
      id: 1,
      questionText: "Is repeated unwanted messaging considered harassment?",
      options: ["Yes", "No", "Depends on platform"],
      correctOptionIndex: 0,
    },
    {
      id: 2,
      questionText: "What should you do if an event attendee asks you to stop contacting them?",
      options: [
        "Continue messaging",
        "Respect their boundary immediately",
        "Create a fake account",
      ],
      correctOptionIndex: 1,
    },
    {
      id: 3,
      questionText: "Does posting private contact information of others violate policy?",
      options: ["No", "Yes, strictly prohibited", "Only if phone numbers"],
      correctOptionIndex: 1,
    },
    {
      id: 4,
      questionText: "What score is required to pass this remediation quiz?",
      options: ["70%", "80%", "100%"],
      correctOptionIndex: 2,
    },
    {
      id: 5,
      questionText: "How many strikes result in a permanent ban after remediation?",
      options: ["1 strike", "2 strikes", "5 strikes"],
      correctOptionIndex: 1,
    },
  ],
  Spam: [
    {
      id: 1,
      questionText: "Is posting repetitive promo links in event chats allowed?",
      options: ["Yes", "No", "Only for sponsors"],
      correctOptionIndex: 1,
    },
    {
      id: 2,
      questionText: "Are automated bots permitted to claim event tickets?",
      options: ["Yes", "No, strictly banned", "Only for club leaders"],
      correctOptionIndex: 1,
    },
    {
      id: 3,
      questionText: "What is the purpose of event chat channels?",
      options: ["Commercial spamming", "Genuine attendee coordination", "Data scraping"],
      correctOptionIndex: 1,
    },
    {
      id: 4,
      questionText: "What happens if you fail a remediation quiz attempt?",
      options: ["Permanent ban", "You can retry until scoring 100%", "Account deleted"],
      correctOptionIndex: 1,
    },
    {
      id: 5,
      questionText: "Why is ticket hoarding prohibited?",
      options: ["It prevents genuine student participation", "It uses bandwidth", "No reason"],
      correctOptionIndex: 0,
    },
  ],
  Profanity: [
    {
      id: 1,
      questionText: "Is profane language allowed in family-friendly event titles?",
      options: ["Yes", "No", "Only in acronyms"],
      correctOptionIndex: 1,
    },
    {
      id: 2,
      questionText: "How are explicit music requests handled in public events?",
      options: ["Filtered by soundtrack blacklist", "Allowed always", "Encouraged"],
      correctOptionIndex: 0,
    },
    {
      id: 3,
      questionText: "What constitutes constructive event feedback?",
      options: ["Profane rants", "Actionable polite critique", "Spam ratings"],
      correctOptionIndex: 1,
    },
    {
      id: 4,
      questionText: "Where can you review full Community Guidelines?",
      options: ["Platform Footer / Guidelines", "Nowhere", "On Wikipedia"],
      correctOptionIndex: 0,
    },
    {
      id: 5,
      questionText: "What score unlocks account restoration?",
      options: ["80%", "90%", "100%"],
      correctOptionIndex: 2,
    },
  ],
};

/**
 * Returns dynamic 5-question remediation quiz tailored to the user's specific policy violation.
 */
export function getRemediationQuizQuestions(category: ViolationCategory): QuizQuestion[] {
  return CATEGORY_QUIZ_BANKS[category] || CATEGORY_QUIZ_BANKS["Harassment"];
}

/**
 * Evaluates quiz submission. Requires 100% score to pass and restore account.
 */
export function evaluateRemediationQuiz(
  submission: QuizSubmission,
  existingStrikes = 0,
): QuizEvaluationResult {
  const questions = getRemediationQuizQuestions(submission.category);
  let correctCount = 0;

  for (const q of questions) {
    if (submission.answers[q.id] === q.correctOptionIndex) {
      correctCount++;
    }
  }

  const scorePercentage = Number(((correctCount / questions.length) * 100).toFixed(2));
  const isPassed = scorePercentage === 100.0;

  if (!isPassed) {
    return {
      scorePercentage,
      isPassed: false,
      activeStrikesApplied: existingStrikes,
      newModerationStatus: "remediation_required",
      message: `Quiz Score: ${scorePercentage}%. A 100% score is required to restore account access. Please review guidelines and try again.`,
    };
  }

  if (existingStrikes >= 1) {
    return {
      scorePercentage: 100.0,
      isPassed: true,
      activeStrikesApplied: existingStrikes + 1,
      newModerationStatus: "permanently_banned",
      message: "Second violation confirmed. Your account has been permanently banned.",
    };
  }

  return {
    scorePercentage: 100.0,
    isPassed: true,
    activeStrikesApplied: 1,
    newModerationStatus: "active",
    message: "Remediation successful! Account restored with 1 active strike recorded.",
  };
}
