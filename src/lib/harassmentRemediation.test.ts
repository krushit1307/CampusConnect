import { describe, it, expect } from "vitest";
import {
  getRemediationQuizQuestions,
  evaluateRemediationQuiz,
  QuizSubmission,
} from "./harassmentRemediation";

describe("Implement Automated Profanity/Harassment Remediation Suite (#4483)", () => {
  it("returns tailored 5-question quiz for specific violation categories", () => {
    const hateQuestions = getRemediationQuizQuestions("Hate Speech");
    expect(hateQuestions.length).toBe(5);
    expect(hateQuestions[0].questionText).toContain("hate speech");

    const profanityQuestions = getRemediationQuizQuestions("Profanity");
    expect(profanityQuestions.length).toBe(5);
    expect(profanityQuestions[0].questionText).toContain("profane language");
  });

  it("requires 100% score to pass and rejects submissions scoring < 100%", () => {
    const imperfectSubmission: QuizSubmission = {
      userId: "usr_remediating",
      category: "Harassment",
      answers: { 1: 0, 2: 1, 3: 1, 4: 2, 5: 0 }, // Q5 wrong option selected
    };

    const evalResult = evaluateRemediationQuiz(imperfectSubmission, 0);

    expect(evalResult.isPassed).toBe(false);
    expect(evalResult.scorePercentage).toBe(80.0);
    expect(evalResult.newModerationStatus).toBe("remediation_required");
    expect(evalResult.message).toContain("A 100% score is required");
  });

  it("restores account with 1 active strike when 100% score is achieved on first offense", () => {
    const perfectSubmission: QuizSubmission = {
      userId: "usr_remediating",
      category: "Harassment",
      answers: { 1: 0, 2: 1, 3: 1, 4: 2, 5: 1 }, // All 5 correct
    };

    const evalResult = evaluateRemediationQuiz(perfectSubmission, 0);

    expect(evalResult.isPassed).toBe(true);
    expect(evalResult.scorePercentage).toBe(100.0);
    expect(evalResult.activeStrikesApplied).toBe(1);
    expect(evalResult.newModerationStatus).toBe("active");
    expect(evalResult.message).toContain("Remediation successful!");
  });

  it("permanently bans account if user already has an active strike upon repeating violation", () => {
    const perfectSubmission: QuizSubmission = {
      userId: "usr_repeat_offender",
      category: "Hate Speech",
      answers: { 1: 1, 2: 2, 3: 1, 4: 1, 5: 0 }, // All 5 correct
    };

    const evalResult = evaluateRemediationQuiz(perfectSubmission, 1); // 1 prior strike

    expect(evalResult.isPassed).toBe(true);
    expect(evalResult.newModerationStatus).toBe("permanently_banned");
    expect(evalResult.message).toContain("permanently banned");
  });
});
