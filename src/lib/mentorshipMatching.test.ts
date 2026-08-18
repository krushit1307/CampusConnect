import { describe, it, expect } from "vitest";
import { calculateCompatibilityScore } from "./mentorshipMatching";

describe("Mentorship Matching Algorithm (#2803)", () => {
  it("awards 50 points for exact major match", () => {
    const res = calculateCompatibilityScore("Computer Science", [], "Computer Science", []);
    expect(res.score).toBe(50);
    expect(res.isMajorMatch).toBe(true);
  });

  it("awards 10 points per shared interest", () => {
    const res = calculateCompatibilityScore(
      "Electrical Engineering",
      ["Robotics", "Embedded Systems", "IoT"],
      "Mechanical Engineering",
      ["Robotics", "IoT", "3D Printing"],
    );
    // 0 pts for major + 20 pts for 2 shared interests (Robotics, IoT)
    expect(res.score).toBe(20);
    expect(res.sharedInterests).toEqual(["Robotics", "IoT"]);
    expect(res.isMajorMatch).toBe(false);
  });

  it("combines major match and shared interests accurately", () => {
    const res = calculateCompatibilityScore(
      "Computer Science",
      ["AI", "Web Development", "Cybersecurity"],
      "Computer Science",
      ["AI", "Cybersecurity", "Gaming"],
    );
    // 50 (major) + 20 (2 shared interests) = 70 pts
    expect(res.score).toBe(70);
    expect(res.sharedInterests).toEqual(["AI", "Cybersecurity"]);
    expect(res.isMajorMatch).toBe(true);
  });

  it("handles case-insensitivity and extra whitespace in major and interests", () => {
    const res = calculateCompatibilityScore(
      "  Data Science ",
      [" Python ", " Machine Learning "],
      "data science",
      ["python", "cloud"],
    );
    expect(res.score).toBe(60); // 50 (major) + 10 (python)
    expect(res.isMajorMatch).toBe(true);
  });
});
