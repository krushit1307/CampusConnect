import { describe, it, expect, beforeEach } from "vitest";
import { sponsorLeadScoringService, DEFAULT_SPONSOR_CRITERIA, MOCK_SCANNED_LEADS } from "../sponsorLeadScoringService";
import { CandidateProfile, ScannedSponsorLead } from "@/types/sponsorLeadScoring";

describe("sponsorLeadScoringService", () => {
  beforeEach(() => {
    sponsorLeadScoringService.resetToSample();
  });

  it("calculates Academic Fit score correctly based on major, grad year, and GPA", () => {
    const candidate: CandidateProfile = {
      id: "c-1",
      name: "Test Candidate",
      avatar: "",
      email: "test@campus.edu",
      major: "Computer Science", // Matches criteria
      graduationYear: 2026, // Matches criteria
      degreeLevel: "Bachelor's",
      gpa: 3.8, // > 3.4 minGpa
      skills: ["Python"],
      seekingGoal: "full_time",
      verifiedCertificatesCount: 0,
      hackathonWinsCount: 0,
    };

    const score = sponsorLeadScoringService.calculateAcademicFit(candidate, DEFAULT_SPONSOR_CRITERIA);
    // Major match (40) + Grad Year (30) + GPA (20) + Degree (8) = 98
    expect(score).toBeGreaterThanOrEqual(95);
  });

  it("calculates Engagement Depth score based on visit duration and interactions", () => {
    const interaction: ScannedSponsorLead["interaction"] = {
      boothVisitDurationSeconds: 400, // >300s (35 pts)
      interactedWithDemo: true, // +20
      submittedResume: true, // +25
      completedCodeChallenge: true, // +20
      visitCount: 2, // +10 bonus
      scannedAt: new Date(),
    };

    const score = sponsorLeadScoringService.calculateEngagementDepth(interaction);
    expect(score).toBe(100); // capped at 100
  });

  it("calculates Skill Match score and identifies matched vs missing skills", () => {
    const candidate: CandidateProfile = {
      id: "c-2",
      name: "Skill Match Candidate",
      avatar: "",
      email: "skill@campus.edu",
      major: "Computer Science",
      graduationYear: 2026,
      degreeLevel: "Bachelor's",
      gpa: 3.5,
      skills: ["Python", "React", "TypeScript"], // 3 out of 6 required skills
      seekingGoal: "full_time",
      verifiedCertificatesCount: 2, // +10 bonus
      hackathonWinsCount: 1, // +5 bonus
    };

    const { score, matchedSkills, missingSkills } = sponsorLeadScoringService.calculateSkillMatch(
      candidate,
      DEFAULT_SPONSOR_CRITERIA,
    );

    expect(matchedSkills).toContain("Python");
    expect(matchedSkills).toContain("React");
    expect(matchedSkills).toContain("TypeScript");
    expect(missingSkills).toContain("AWS");
    expect(score).toBeGreaterThan(40);
  });

  it("calculates overall lead score and assigns Hot tier for top candidates", () => {
    const lead = MOCK_SCANNED_LEADS[0]; // Aarav Mehta
    const result = sponsorLeadScoringService.calculateLeadScore(lead, DEFAULT_SPONSOR_CRITERIA);

    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(result.tier).toBe("hot");
    expect(result.recommendationReason).toContain("Top Candidate");
  });

  it("re-calculates lead scores dynamically when criteria weights or skills are updated", () => {
    const initialLeads = sponsorLeadScoringService.getAllLeadsWithScores();
    const initialTopScore = initialLeads[0].result.overallScore;

    // Update criteria to require Business major and Excel skills
    sponsorLeadScoringService.updateCriteria({
      targetMajors: ["Business Administration"],
      requiredSkills: ["Excel", "PowerPoint"],
    });

    const reScoredLeads = sponsorLeadScoringService.getAllLeadsWithScores();
    const newTopCandidate = reScoredLeads[0];

    expect(newTopCandidate.lead.candidate.major).toBe("Business Administration");
    expect(newTopCandidate.result.matchedSkills).toContain("Excel");
  });

  it("calculates aggregated lead scoring metrics", () => {
    const metrics = sponsorLeadScoringService.getScoringMetrics();
    expect(metrics.totalLeadsScanned).toBe(4);
    expect(metrics.hotLeadsCount).toBeGreaterThanOrEqual(1);
    expect(metrics.avgOverallScore).toBeGreaterThan(0);
  });
});
