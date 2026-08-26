import { describe, it, expect } from "vitest";
import {
  filterPublicAudienceQuestions,
  filterModeratorPendingQuestions,
  processQuestionModeration,
  LiveQuestionItem,
} from "./presenterQaModeration";

describe("Real-Time Presenter Q&A Moderation Dashboard Suite (#3876)", () => {
  const sampleQuestions: LiveQuestionItem[] = [
    {
      id: "q1",
      eventId: "evt_keynote",
      userId: "usr_alice",
      questionText: "What is the timeline for the new features?",
      status: "approved",
      upvotesCount: 12,
      createdAt: "2026-08-21T10:00:00Z",
    },
    {
      id: "q2",
      eventId: "evt_keynote",
      userId: "usr_troll",
      questionText: "Inappropriate spam question",
      status: "pending",
      upvotesCount: 0,
      createdAt: "2026-08-21T10:05:00Z",
    },
    {
      id: "q3",
      eventId: "evt_keynote",
      userId: "usr_bob",
      questionText: "Can we get access to the slides later?",
      status: "approved",
      upvotesCount: 25,
      createdAt: "2026-08-21T10:02:00Z",
    },
  ];

  it("filters public audience feed to only display approved questions sorted by upvotes", () => {
    const publicFeed = filterPublicAudienceQuestions(sampleQuestions);

    expect(publicFeed.length).toBe(2);
    expect(publicFeed.some((q) => q.status === "pending")).toBe(false);
    expect(publicFeed[0].id).toBe("q3"); // Most upvoted first
  });

  it("filters moderator feed to only display pending questions in chronological order", () => {
    const pendingFeed = filterModeratorPendingQuestions(sampleQuestions);

    expect(pendingFeed.length).toBe(1);
    expect(pendingFeed[0].id).toBe("q2");
  });

  it("approves pending questions and flags them for public WebSocket broadcast", () => {
    const pendingQuestion = sampleQuestions[1];
    const result = processQuestionModeration(pendingQuestion, "APPROVE");

    expect(result.updatedQuestion.status).toBe("approved");
    expect(result.shouldBroadcastToPublic).toBe(true);
    expect(result.actionTaken).toBe("APPROVED");
  });

  it("rejects abusive pending questions without public broadcast", () => {
    const pendingQuestion = sampleQuestions[1];
    const result = processQuestionModeration(pendingQuestion, "REJECT");

    expect(result.updatedQuestion.status).toBe("rejected");
    expect(result.shouldBroadcastToPublic).toBe(false);
    expect(result.actionTaken).toBe("REJECTED");
  });
});
