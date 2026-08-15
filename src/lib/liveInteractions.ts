export interface LiveQuestion {
  id: string;
  eventId: string;
  authorName: string;
  questionText: string;
  upvotes: number;
  isAnswered: boolean;
  isApproved: boolean;
  userHasUpvoted?: boolean;
}

export interface LivePoll {
  id: string;
  eventId: string;
  prompt: string;
  options: string[];
  isActive: boolean;
}

export interface PollTallyResult {
  option: string;
  votes: number;
  percentage: number;
}

/**
 * Sorts Q&A questions by highest upvotes first, placing answered questions at the end.
 */
export function sortLiveQuestions(questions: LiveQuestion[]): LiveQuestion[] {
  return [...questions].sort((a, b) => {
    if (a.isAnswered !== b.isAnswered) {
      return a.isAnswered ? 1 : -1;
    }
    return b.upvotes - a.upvotes;
  });
}

/**
 * Toggles user upvote status for a question, adjusting total score.
 */
export function toggleQuestionUpvote(question: LiveQuestion, hasUpvoted: boolean): LiveQuestion {
  const upvoteDiff = hasUpvoted ? -1 : 1;
  return {
    ...question,
    upvotes: Math.max(0, question.upvotes + upvoteDiff),
    userHasUpvoted: !hasUpvoted,
  };
}

/**
 * Calculates percentage breakdown for live poll responses.
 */
export function calculatePollResults(
  poll: LivePoll,
  responses: number[], // Array of selected option indices e.g. [0, 1, 0, 0]
): PollTallyResult[] {
  const totalVotes = responses.length;

  return poll.options.map((option, index) => {
    const votes = responses.filter((r) => r === index).length;
    const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

    return {
      option,
      votes,
      percentage,
    };
  });
}
