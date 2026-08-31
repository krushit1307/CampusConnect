import {
  CandidateProfile,
  LeadScoreResult,
  LeadScoringMetrics,
  LeadTier,
  ScannedSponsorLead,
  ScoringVectorBreakdown,
  SponsorScoringCriteria,
} from "@/types/sponsorLeadScoring";

// ─── Default Sponsor Criteria & Mock Leads ─────────────────────────────────

export const DEFAULT_SPONSOR_CRITERIA: SponsorScoringCriteria = {
  sponsorId: "spn-google-01",
  sponsorName: "Google University Relations & Engineering",
  targetMajors: [
    "Computer Science",
    "Software Engineering",
    "Data Science",
    "Electrical Engineering",
  ],
  targetGradYears: [2026, 2027],
  requiredSkills: ["Python", "React", "TypeScript", "AWS", "Machine Learning", "System Design"],
  minGpa: 3.4,
  preferredGoals: ["full_time", "summer_internship"],
  weights: {
    academicWeight: 0.25,
    engagementWeight: 0.30,
    skillWeight: 0.25,
    intentWeight: 0.20,
  },
};

export const MOCK_SCANNED_LEADS: ScannedSponsorLead[] = [
  {
    leadId: "lead-101",
    eventId: "evt-tech-fair-2026",
    sponsorId: "spn-google-01",
    candidate: {
      id: "user-cs-99",
      name: "Aarav Mehta",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      email: "aarav.m@campus.edu",
      major: "Computer Science",
      graduationYear: 2026,
      degreeLevel: "Bachelor's",
      gpa: 3.85,
      skills: ["Python", "React", "TypeScript", "AWS", "Machine Learning", "Docker"],
      seekingGoal: "full_time",
      githubUrl: "https://github.com/aaravm",
      linkedinUrl: "https://linkedin.com/in/aaravm",
      verifiedCertificatesCount: 4,
      hackathonWinsCount: 2,
    },
    interaction: {
      boothVisitDurationSeconds: 420, // 7 mins
      interactedWithDemo: true,
      submittedResume: true,
      completedCodeChallenge: true,
      visitCount: 2,
      recruiterRatingOverride: 5,
      recruiterNotes: "Top tier engineer candidate! Solved graph challenge in 3 mins.",
      scannedAt: new Date(Date.now() - 15 * 60 * 1000),
    },
  },
  {
    leadId: "lead-102",
    eventId: "evt-tech-fair-2026",
    sponsorId: "spn-google-01",
    candidate: {
      id: "user-ds-88",
      name: "Sophia Chen",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      email: "sophia.chen@campus.edu",
      major: "Data Science",
      graduationYear: 2027,
      degreeLevel: "Master's",
      gpa: 3.92,
      skills: ["Python", "Machine Learning", "PyTorch", "SQL", "TypeScript"],
      seekingGoal: "summer_internship",
      githubUrl: "https://github.com/sophiac",
      verifiedCertificatesCount: 2,
      hackathonWinsCount: 1,
    },
    interaction: {
      boothVisitDurationSeconds: 300, // 5 mins
      interactedWithDemo: true,
      submittedResume: true,
      completedCodeChallenge: false,
      visitCount: 1,
      recruiterRatingOverride: 4,
      recruiterNotes: "Strong ML research background. Interested in AI Internship.",
      scannedAt: new Date(Date.now() - 40 * 60 * 1000),
    },
  },
  {
    leadId: "lead-103",
    eventId: "evt-tech-fair-2026",
    sponsorId: "spn-google-01",
    candidate: {
      id: "user-ee-77",
      name: "Marcus Brody",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      email: "m.brody@campus.edu",
      major: "Electrical Engineering",
      graduationYear: 2026,
      degreeLevel: "Bachelor's",
      gpa: 3.25,
      skills: ["Python", "C++", "System Design"],
      seekingGoal: "full_time",
      verifiedCertificatesCount: 1,
      hackathonWinsCount: 0,
    },
    interaction: {
      boothVisitDurationSeconds: 120, // 2 mins
      interactedWithDemo: false,
      submittedResume: true,
      completedCodeChallenge: false,
      visitCount: 1,
      scannedAt: new Date(Date.now() - 90 * 60 * 1000),
    },
  },
  {
    leadId: "lead-104",
    eventId: "evt-tech-fair-2026",
    sponsorId: "spn-google-01",
    candidate: {
      id: "user-biz-55",
      name: "Chloe Bennett",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      email: "c.bennett@campus.edu",
      major: "Business Administration",
      graduationYear: 2028,
      degreeLevel: "Bachelor's",
      gpa: 3.10,
      skills: ["Excel", "PowerPoint", "Public Speaking"],
      seekingGoal: "general_networking",
      verifiedCertificatesCount: 0,
      hackathonWinsCount: 0,
    },
    interaction: {
      boothVisitDurationSeconds: 45,
      interactedWithDemo: false,
      submittedResume: false,
      completedCodeChallenge: false,
      visitCount: 1,
      scannedAt: new Date(Date.now() - 120 * 60 * 1000),
    },
  },
];

class SponsorLeadScoringService {
  private leads: ScannedSponsorLead[] = [...MOCK_SCANNED_LEADS];
  private criteria: SponsorScoringCriteria = { ...DEFAULT_SPONSOR_CRITERIA };

  // ─── Individual Scoring Vector Calculators ──────────────────────────────

  /**
   * 1. Academic Fit Vector (0-100)
   */
  public calculateAcademicFit(
    candidate: CandidateProfile,
    criteria: SponsorScoringCriteria,
  ): number {
    let score = 0;

    // Major match (40 pts max)
    if (criteria.targetMajors.some((m) => m.toLowerCase() === candidate.major.toLowerCase())) {
      score += 40;
    } else if (candidate.major.toLowerCase().includes("engineering") || candidate.major.toLowerCase().includes("tech")) {
      score += 20;
    }

    // Graduation year match (30 pts max)
    if (criteria.targetGradYears.includes(candidate.graduationYear)) {
      score += 30;
    } else if (Math.abs(candidate.graduationYear - criteria.targetGradYears[0]) <= 1) {
      score += 15;
    }

    // GPA score (20 pts max)
    if (candidate.gpa >= criteria.minGpa) {
      score += 20;
    } else if (candidate.gpa >= criteria.minGpa - 0.2) {
      score += 10;
    }

    // Degree level boost (10 pts max)
    if (candidate.degreeLevel === "Master's" || candidate.degreeLevel === "Ph.D.") {
      score += 10;
    } else if (candidate.degreeLevel === "Bachelor's") {
      score += 8;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 2. Engagement Depth Vector (0-100)
   */
  public calculateEngagementDepth(interaction: ScannedSponsorLead["interaction"]): number {
    let score = 0;

    // Duration score (35 pts max)
    if (interaction.boothVisitDurationSeconds >= 300) {
      score += 35; // 5+ minutes
    } else if (interaction.boothVisitDurationSeconds >= 180) {
      score += 25; // 3-5 minutes
    } else if (interaction.boothVisitDurationSeconds >= 60) {
      score += 15; // 1-3 minutes
    } else {
      score += 5;
    }

    // Interactive Demo (20 pts)
    if (interaction.interactedWithDemo) score += 20;

    // Submitted Resume (25 pts)
    if (interaction.submittedResume) score += 25;

    // Completed Code / Tech Challenge (20 pts)
    if (interaction.completedCodeChallenge) score += 20;

    // Repeat visit bonus (10 pts bonus)
    if (interaction.visitCount > 1) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 3. Skill & Portfolio Vector (0-100)
   */
  public calculateSkillMatch(
    candidate: CandidateProfile,
    criteria: SponsorScoringCriteria,
  ): { score: number; matchedSkills: string[]; missingSkills: string[] } {
    if (criteria.requiredSkills.length === 0) {
      return { score: 70, matchedSkills: [], missingSkills: [] };
    }

    const candidateSkillsLower = candidate.skills.map((s) => s.toLowerCase());
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    criteria.requiredSkills.forEach((reqSkill) => {
      if (candidateSkillsLower.includes(reqSkill.toLowerCase())) {
        matchedSkills.push(reqSkill);
      } else {
        missingSkills.push(reqSkill);
      }
    });

    const matchRatio = matchedSkills.length / criteria.requiredSkills.length;
    let baseScore = Math.round(matchRatio * 75); // max 75 pts from skill overlap

    // Verified certificates & hackathon wins bonus (25 pts max)
    const certBonus = Math.min(15, candidate.verifiedCertificatesCount * 5);
    const hackathonBonus = Math.min(10, candidate.hackathonWinsCount * 5);

    const score = Math.min(100, Math.max(0, baseScore + certBonus + hackathonBonus));

    return { score, matchedSkills, missingSkills };
  }

  /**
   * 4. Recruitment Intent Vector (0-100)
   */
  public calculateRecruitmentIntent(
    candidate: CandidateProfile,
    interaction: ScannedSponsorLead["interaction"],
    criteria: SponsorScoringCriteria,
  ): number {
    let score = 0;

    // Goal alignment (50 pts max)
    if (criteria.preferredGoals.includes(candidate.seekingGoal)) {
      score += 50;
    } else if (candidate.seekingGoal !== "general_networking") {
      score += 25;
    } else {
      score += 10;
    }

    // Recruiter manual rating override boost (50 pts max)
    if (interaction.recruiterRatingOverride) {
      score += interaction.recruiterRatingOverride * 10;
    } else {
      score += 25; // default baseline neutral
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Master Lead Score Algorithm
   */
  public calculateLeadScore(
    lead: ScannedSponsorLead,
    criteria: SponsorScoringCriteria = this.criteria,
  ): LeadScoreResult {
    const academicFitScore = this.calculateAcademicFit(lead.candidate, criteria);
    const engagementDepthScore = this.calculateEngagementDepth(lead.interaction);
    const { score: skillMatchScore, matchedSkills, missingSkills } = this.calculateSkillMatch(
      lead.candidate,
      criteria,
    );
    const recruitmentIntentScore = this.calculateRecruitmentIntent(
      lead.candidate,
      lead.interaction,
      criteria,
    );

    const w = criteria.weights;
    // Normalize weights to sum to 1
    const totalWeight = w.academicWeight + w.engagementWeight + w.skillWeight + w.intentWeight;
    const normAcademic = w.academicWeight / totalWeight;
    const normEngagement = w.engagementWeight / totalWeight;
    const normSkill = w.skillWeight / totalWeight;
    const normIntent = w.intentWeight / totalWeight;

    const rawOverallScore =
      academicFitScore * normAcademic +
      engagementDepthScore * normEngagement +
      skillMatchScore * normSkill +
      recruitmentIntentScore * normIntent;

    const overallScore = Math.round(rawOverallScore);

    // Tier Classification Boundaries
    let tier: LeadTier = "low_match";
    if (overallScore >= 80) tier = "hot";
    else if (overallScore >= 60) tier = "warm";
    else if (overallScore >= 40) tier = "cool";
    else tier = "low_match";

    // Dynamic Recommendation Reason
    let recommendationReason = "";
    if (tier === "hot") {
      recommendationReason = `Top Candidate! Matches ${matchedSkills.length}/${criteria.requiredSkills.length} required skills. High engagement (${Math.round(lead.interaction.boothVisitDurationSeconds / 60)}m at booth). Invite for immediate interview!`;
    } else if (tier === "warm") {
      recommendationReason = `Strong Prospect. Solid academic background (${lead.candidate.major}, GPA ${lead.candidate.gpa}). Follow up with engineering team.`;
    } else if (tier === "cool") {
      recommendationReason = `Pipeline Candidate. Graduating in ${lead.candidate.graduationYear}. Add to email nurture list for future positions.`;
    } else {
      recommendationReason = `Low Match. Does not align with immediate criteria (${criteria.targetMajors.join(", ")}).`;
    }

    return {
      leadId: lead.leadId,
      candidateName: lead.candidate.name,
      overallScore,
      tier,
      vectors: {
        academicFitScore,
        engagementDepthScore,
        skillMatchScore,
        recruitmentIntentScore,
      },
      matchedSkills,
      missingSkills,
      recommendationReason,
      calculatedAt: new Date(),
    };
  }

  // ─── Query & Management Methods ────────────────────────────────────────

  public getCriteria(): SponsorScoringCriteria {
    return { ...this.criteria };
  }

  public updateCriteria(newCriteria: Partial<SponsorScoringCriteria>): SponsorScoringCriteria {
    this.criteria = { ...this.criteria, ...newCriteria };
    return { ...this.criteria };
  }

  public getAllLeadsWithScores(): { lead: ScannedSponsorLead; result: LeadScoreResult }[] {
    return this.leads
      .map((lead) => ({
        lead,
        result: this.calculateLeadScore(lead, this.criteria),
      }))
      .sort((a, b) => b.result.overallScore - a.result.overallScore);
  }

  public updateRecruiterNotes(
    leadId: string,
    ratingOverride?: number,
    notes?: string,
  ): LeadScoreResult | undefined {
    const lead = this.leads.find((l) => l.leadId === leadId);
    if (!lead) return undefined;

    if (ratingOverride !== undefined) {
      lead.interaction.recruiterRatingOverride = ratingOverride;
    }
    if (notes !== undefined) {
      lead.interaction.recruiterNotes = notes;
    }

    return this.calculateLeadScore(lead, this.criteria);
  }

  public getScoringMetrics(): LeadScoringMetrics {
    const scored = this.getAllLeadsWithScores();
    const totalLeadsScanned = scored.length;

    const hotLeadsCount = scored.filter((s) => s.result.tier === "hot").length;
    const warmLeadsCount = scored.filter((s) => s.result.tier === "warm").length;
    const coolLeadsCount = scored.filter((s) => s.result.tier === "cool").length;
    const lowMatchLeadsCount = scored.filter((s) => s.result.tier === "low_match").length;

    const totalScoreSum = scored.reduce((acc, s) => acc + s.result.overallScore, 0);
    const avgOverallScore = totalLeadsScanned > 0 ? Math.round(totalScoreSum / totalLeadsScanned) : 0;

    return {
      totalLeadsScanned,
      hotLeadsCount,
      warmLeadsCount,
      coolLeadsCount,
      lowMatchLeadsCount,
      avgOverallScore,
    };
  }

  public resetToSample() {
    this.leads = [...MOCK_SCANNED_LEADS];
    this.criteria = { ...DEFAULT_SPONSOR_CRITERIA };
  }
}

export const sponsorLeadScoringService = new SponsorLeadScoringService();
