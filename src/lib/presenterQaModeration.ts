export type QuestionModerationStatus = "pending" | "approved" | "rejected";

export interface LiveQuestionItem {
  id: string;
  eventId: string;
  userId: string;
  questionText: string;
  status: QuestionModerationStatus;
  upvotesCount: number;
  createdAt: string;
}

export interface ModerationActionResult {
  updatedQuestion: LiveQuestionItem;
  shouldBroadcastToPublic: boolean;
  actionTaken: "APPROVED" | "REJECTED";
}

/**
 * Filters live questions for the public audience view (only 'approved' questions).
 */
export function filterPublicAudienceQuestions(questions: LiveQuestionItem[]): LiveQuestionItem[] {
  return questions
    .filter((q) => q.status === "approved")
    .sort((a, b) => b.upvotesCount - a.upvotesCount);
}

/**
 * Filters pending questions for the Moderator Review Dashboard.
 */
export function filterModeratorPendingQuestions(questions: LiveQuestionItem[]): LiveQuestionItem[] {
  return questions
    .filter((q) => q.status === "pending")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Processes moderator action (Approve vs Reject) on a pending question.
 */
export function processQuestionModeration(
  question: LiveQuestionItem,
  action: "APPROVE" | "REJECT",
): ModerationActionResult {
  if (action === "APPROVE") {
    return {
      updatedQuestion: {
        ...question,
        status: "approved",
      },
      shouldBroadcastToPublic: true,
      actionTaken: "APPROVED",
    };
  }

  return {
    updatedQuestion: {
      ...question,
      status: "rejected",
    },
    shouldBroadcastToPublic: false,
    actionTaken: "REJECTED",
  };
}
