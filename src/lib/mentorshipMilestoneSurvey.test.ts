import { describe, it, expect } from "vitest";
import {
  isMilestoneSurveyTriggerable,
  buildMilestoneSurveyNotification,
  aggregateMentorRating,
  formatMentorshipRatingDisplay,
  MentorshipRelationship,
} from "./mentorshipMilestoneSurvey";

describe("Implement Automated Mentorship Milestones Survey Suite (#4416)", () => {
  const activeRelationship: MentorshipRelationship = {
    id: "rel_101",
    mentorId: "usr_alex_mentor",
    mentorName: "Alex Rivera",
    menteeId: "usr_student",
    menteeEmail: "student@university.edu",
    completedMeetingsCount: 5,
  };

  it("triggers milestone survey notification when completed_meetings_count == 5", () => {
    expect(isMilestoneSurveyTriggerable(activeRelationship)).toBe(true);

    const notif = buildMilestoneSurveyNotification(activeRelationship);
    expect(notif).not.toBeNull();
    expect(notif?.title).toBe("Mentorship Milestone Reached!");
    expect(notif?.body).toContain("You've completed 5 sessions with Alex Rivera!");
    expect(notif?.body).toContain("Please rate your mentorship experience (1-5 stars).");
  });

  it("does not trigger survey if meeting threshold of 5 is not reached", () => {
    const incomplete = { ...activeRelationship, completedMeetingsCount: 3 };
    expect(isMilestoneSurveyTriggerable(incomplete)).toBe(false);
    expect(buildMilestoneSurveyNotification(incomplete)).toBeNull();
  });

  it("aggregates rating and suppresses mentor from matchmaking pool if average drops below 3.0 stars", () => {
    // Single rating of 2.0 (total 1 review -> still active until 2 reviews)
    const singleRating = aggregateMentorRating("usr_alex_mentor", [], 2.0);
    expect(singleRating.averageRating).toBe(2.0);
    expect(singleRating.isMatchmakingActive).toBe(true);

    // Second rating of 2.0 (average 2.0 -> suppressed from matchmaking)
    const lowRating = aggregateMentorRating("usr_alex_mentor", [2.0], 2.0);
    expect(lowRating.averageRating).toBe(2.0);
    expect(lowRating.isMatchmakingActive).toBe(false);

    // High ratings (average 4.8 -> active)
    const highRating = aggregateMentorRating("usr_alex_mentor", [5.0, 5.0, 4.0], 5.0);
    expect(highRating.averageRating).toBe(4.75);
    expect(highRating.isMatchmakingActive).toBe(true);
  });

  it("formats Alumni profile rating display strings", () => {
    const stats = {
      mentorId: "m1",
      averageRating: 4.9,
      totalReviews: 8,
      isMatchmakingActive: true,
    };
    expect(formatMentorshipRatingDisplay(stats)).toBe(
      "⭐ 4.9/5 Average Mentorship Rating (8 reviews)",
    );
  });
});
