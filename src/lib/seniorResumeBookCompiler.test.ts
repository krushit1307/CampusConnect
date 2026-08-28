import { describe, it, expect } from "vitest";
import {
  filterGraduatingSeniors,
  compileResumeBookDocument,
  generateSponsorDispatchPayload,
  GraduatingSeniorProfile,
} from "./seniorResumeBookCompiler";

describe("Senior Resume Book Compiler Utility (#4288)", () => {
  const mockSeniors: GraduatingSeniorProfile[] = [
    {
      userId: "u-1",
      fullName: "Alice Vance",
      handle: "alice_v",
      major: "Computer Science",
      graduationYear: 2026,
      gpa: 3.92,
      githubUrl: "https://github.com/alicev",
      linkedinUrl: "https://linkedin.com/in/alicev",
      bio: "Focusing on distributed systems and AI infrastructure.",
      skills: ["Distributed Systems", "Rust", "Go"],
      email: "alice@campus.edu",
    },
    {
      userId: "u-2",
      fullName: "Bob Chen",
      handle: "bob_c",
      major: "Data Science",
      graduationYear: 2026,
      gpa: 3.85,
      githubUrl: "https://github.com/bobc",
      linkedinUrl: "https://linkedin.com/in/bobc",
      bio: "Passionate about machine learning and NLP.",
      skills: ["Python", "PyTorch", "NLP"],
      email: "bob@campus.edu",
    },
    {
      userId: "u-3",
      fullName: "Charlie Junior",
      handle: "charlie_j",
      major: "Computer Science",
      graduationYear: 2027, // Junior (not graduating 2026)
    },
  ];

  it("filters active members matching target graduation year", () => {
    const graduating2026 = filterGraduatingSeniors(mockSeniors, 2026);
    expect(graduating2026).toHaveLength(2);
    expect(graduating2026.map((s) => s.fullName)).toContain("Alice Vance");
    expect(graduating2026.map((s) => s.fullName)).not.toContain("Charlie Junior");
  });

  it("compiles multi-page document HTML with cover page and senior profiles", () => {
    const result = compileResumeBookDocument("Computer Science Society", 2026, mockSeniors);

    expect(result.totalSeniors).toBe(2);
    expect(result.documentHtml).toContain("Computer Science Society");
    expect(result.documentHtml).toContain("Class of 2026 Graduating Senior Resume Book");
    expect(result.documentHtml).toContain("Alice Vance");
    expect(result.documentHtml).toContain("GPA: 3.92");
    expect(result.documentHtml).toContain("https://github.com/alicev");
  });

  it("generates automated email dispatch payload for corporate sponsors", () => {
    const result = compileResumeBookDocument("Computer Science Society", 2026, mockSeniors);
    const payload = generateSponsorDispatchPayload("Computer Science Society", result, ["recruiting@google.com"]);

    expect(payload.subject).toContain("Computer Science Society Class of 2026");
    expect(payload.emailBody).toContain("2 verified graduating seniors");
    expect(payload.sponsorEmails).toContain("recruiting@google.com");
  });
});
