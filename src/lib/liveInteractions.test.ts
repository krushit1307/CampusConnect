import { describe, it, expect } from "vitest";
import {
  sortLiveQuestions,
  toggleQuestionUpvote,
  calculatePollResults,
  LiveQuestion,
  LivePoll,
} from "./liveInteractions";

describe("Live Q&A and Polling Engine Suite (#2667)", () => {
  const sampleQuestions: LiveQuestion[] = [
    {
      id: "q1",
      eventId: "e1",
      authorName: "Alice",
      questionText: "What is the tech stack?",
      upvotes: 5,
      isAnswered: false,
      isApproved: true,
    },
    {
      id: "q2",
      eventId: "e1",
      authorName: "Bob",
      questionText: "Will there be recordings?",
      upvotes: 12,
      isAnswered: false,
      isApproved: true,
    },
    {
      id: "q3",
      eventId: "e1",
      authorName: "Charlie",
      questionText: "Is pizza provided?",
      upvotes: 20,
      isAnswered: true, // Answered -> should sink down
      isApproved: true,
    },
  ];

  it("sorts questions by highest upvote count, moving answered questions to the bottom", () => {
    const sorted = sortLiveQuestions(sampleQuestions);

    expect(sorted[0].id).toBe("q2"); // 12 upvotes, unanswered
    expect(sorted[1].id).toBe("q1"); // 5 upvotes, unanswered
    expect(sorted[2].id).toBe("q3"); // 20 upvotes, but answered
  });

  it("toggles upvote status and updates vote count dynamically", () => {
    const question = sampleQuestions[0]; // upvotes: 5

    // Add upvote
    const upvoted = toggleQuestionUpvote(question, false);
    expect(upvoted.upvotes).toBe(6);
    expect(upvoted.userHasUpvoted).toBe(true);

    // Remove upvote
    const unupvoted = toggleQuestionUpvote(upvoted, true);
    expect(unupvoted.upvotes).toBe(5);
    expect(unupvoted.userHasUpvoted).toBe(false);
  });

  it("calculates accurate poll option vote counts and percentages", () => {
    const poll: LivePoll = {
      id: "p1",
      eventId: "e1",
      prompt: "Which topic do you want next?",
      options: ["React", "AI/ML", "DevOps"],
      isActive: true,
    };

    // 2 votes React (0), 2 votes AI/ML (1), 0 votes DevOps (2) -> Total 4 votes
    const responses = [0, 0, 1, 1];
    const results = calculatePollResults(poll, responses);

    expect(results[0].percentage).toBe(50);
    expect(results[1].percentage).toBe(50);
    expect(results[2].percentage).toBe(0);
  });
});
