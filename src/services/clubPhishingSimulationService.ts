import { createClient } from "@/lib/supabase/client";
import {
  OfficerSimulationResult,
  PhishingSecuritySummary,
  PhishingSimulationCampaign,
  PhishingSimulationStatus,
  PhishingTemplate,
} from "@/types/clubPhishingSimulation";

const supabase = createClient();

export const DEFAULT_PHISHING_TEMPLATES: PhishingTemplate[] = [
  {
    id: "tpl-grant-wire",
    category: "URGENT_GRANT_WIRE",
    subject: "[URGENT] Final Notice: Student Government Grant Wire Confirmation Needed",
    senderName: "Campus Financial Office",
    senderEmail: "finance-verify@campus-finance-portal-auth.com",
    bodyPreview:
      "Your club grant of $2,500 will be forfeited if not verified within 2 hours. Click here to confirm bank deposit details.",
    difficultyRating: "BEGINNER",
    redFlags: [
      "External non-campus domain (campus-finance-portal-auth.com)",
      "Artificially tight deadline (2 hours urgency pressure)",
      "Unsolicited request for bank account login details",
    ],
  },
  {
    id: "tpl-sponsor-approval",
    category: "FACULTY_SPONSOR_APPROVAL",
    subject: "Action Required: Faculty Advisor Form 99-B Signature Pending",
    senderName: "Prof. Arthur Pendelton (Faculty Advisor)",
    senderEmail: "a.pendelton@campus-edu-portal.net",
    bodyPreview:
      "Please log into the portal using your credentials to approve our semester event budget before the Student Affairs deadline.",
    difficultyRating: "INTERMEDIATE",
    redFlags: [
      "Domain spoofing (campus-edu-portal.net instead of campus.edu)",
      "Generic link redirecting to credential input page",
    ],
  },
  {
    id: "tpl-venue-contract",
    category: "EVENT_VENUE_CONTRACT",
    subject: "Invoice #8841: Campus Auditorium Sound System Reservation Fee",
    senderName: "Campus Facilities Billing",
    senderEmail: "billing@campus-facilities-dept.org",
    bodyPreview:
      "Your upcoming event room booking is attached. Re-authenticate your account to download the PDF invoice.",
    difficultyRating: "ADVANCED",
    redFlags: [
      "Unexpected attachment requiring web login to view",
      "Slight domain variation (.org instead of official .edu)",
    ],
  },
];

const SAMPLE_OFFICERS: Array<{
  userId: string;
  name: string;
  email: string;
  role: "President" | "Treasurer" | "Secretary" | "Vice President";
  clubId: string;
  clubName: string;
}> = [
  {
    userId: "off-101",
    name: "Alex Morgan",
    email: "a.morgan@campus.edu",
    role: "President",
    clubId: "club-robotics",
    clubName: "Campus Robotics Society",
  },
  {
    userId: "off-102",
    name: "Samantha Chen",
    email: "s.chen@campus.edu",
    role: "Treasurer",
    clubId: "club-robotics",
    clubName: "Campus Robotics Society",
  },
  {
    userId: "off-103",
    name: "David Miller",
    email: "d.miller@campus.edu",
    role: "Treasurer",
    clubId: "club-finance",
    clubName: "Student Investment Fund",
  },
  {
    userId: "off-104",
    name: "Jessica Taylor",
    email: "j.taylor@campus.edu",
    role: "President",
    clubId: "club-finance",
    clubName: "Student Investment Fund",
  },
];

export class ClubPhishingSimulationService {
  private results: OfficerSimulationResult[] = [];
  private campaigns: PhishingSimulationCampaign[] = [];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData(): void {
    const now = new Date();
    const campaignId = "cmp-fall-2026";

    this.campaigns = [
      {
        id: campaignId,
        title: "Fall 2026 Executive Security Awareness Simulation",
        targetAcademicTerm: "Fall 2026",
        totalOfficersTargeted: 4,
        reportedCount: 2,
        clickedCount: 1,
        credentialsSubmittedCount: 1,
        retrainingRequiredCount: 1,
        status: "ACTIVE",
        createdAt: new Date(now.getTime() - 86400000 * 5).toISOString(),
      },
    ];

    this.results = [
      {
        id: "sim-res-1",
        campaignId,
        clubId: "club-robotics",
        clubName: "Campus Robotics Society",
        officerUserId: "off-101",
        officerName: "Alex Morgan",
        officerEmail: "a.morgan@campus.edu",
        officerRole: "President",
        templateId: "tpl-grant-wire",
        scenarioTitle: "Urgent Campus Grant Transfer Request",
        status: "PASSED_REPORTED",
        deliveredAt: new Date(now.getTime() - 86400000 * 4).toISOString(),
        openedAt: new Date(now.getTime() - 86400000 * 3.9).toISOString(),
        reportedAt: new Date(now.getTime() - 86400000 * 3.8).toISOString(),
        isBudgetAuthorizationGated: false,
      },
      {
        id: "sim-res-2",
        campaignId,
        clubId: "club-robotics",
        clubName: "Campus Robotics Society",
        officerUserId: "off-102",
        officerName: "Samantha Chen",
        officerEmail: "s.chen@campus.edu",
        officerRole: "Treasurer",
        templateId: "tpl-grant-wire",
        scenarioTitle: "Urgent Campus Grant Transfer Request",
        status: "PASSED_REPORTED",
        deliveredAt: new Date(now.getTime() - 86400000 * 4).toISOString(),
        openedAt: new Date(now.getTime() - 86400000 * 3.5).toISOString(),
        reportedAt: new Date(now.getTime() - 86400000 * 3.2).toISOString(),
        isBudgetAuthorizationGated: false,
      },
      {
        id: "sim-res-3",
        campaignId,
        clubId: "club-finance",
        clubName: "Student Investment Fund",
        officerUserId: "off-103",
        officerName: "David Miller",
        officerEmail: "d.miller@campus.edu",
        officerRole: "Treasurer",
        templateId: "tpl-sponsor-approval",
        scenarioTitle: "Faculty Sponsor Form Approval",
        status: "FAILED_CREDENTIALS",
        deliveredAt: new Date(now.getTime() - 86400000 * 4).toISOString(),
        openedAt: new Date(now.getTime() - 86400000 * 2.0).toISOString(),
        clickedAt: new Date(now.getTime() - 86400000 * 1.9).toISOString(),
        submittedCredentialsAt: new Date(now.getTime() - 86400000 * 1.8).toISOString(),
        isBudgetAuthorizationGated: true,
      },
      {
        id: "sim-res-4",
        campaignId,
        clubId: "club-finance",
        clubName: "Student Investment Fund",
        officerUserId: "off-104",
        officerName: "Jessica Taylor",
        officerEmail: "j.taylor@campus.edu",
        officerRole: "President",
        templateId: "tpl-venue-contract",
        scenarioTitle: "Auditorium Reservation Fee Invoice",
        status: "FAILED_CLICKED",
        deliveredAt: new Date(now.getTime() - 86400000 * 4).toISOString(),
        openedAt: new Date(now.getTime() - 86400000 * 1.5).toISOString(),
        clickedAt: new Date(now.getTime() - 86400000 * 1.4).toISOString(),
        isBudgetAuthorizationGated: true,
      },
    ];
  }

  /**
   * Generates a new simulated security awareness campaign for club leadership.
   */
  public generateCampaign(title: string, targetAcademicTerm = "Fall 2026"): PhishingSimulationCampaign {
    const campaignId = `cmp-${Date.now()}`;
    const now = new Date().toISOString();

    const newCampaign: PhishingSimulationCampaign = {
      id: campaignId,
      title,
      targetAcademicTerm,
      totalOfficersTargeted: SAMPLE_OFFICERS.length,
      reportedCount: 0,
      clickedCount: 0,
      credentialsSubmittedCount: 0,
      retrainingRequiredCount: 0,
      status: "ACTIVE",
      createdAt: now,
    };

    SAMPLE_OFFICERS.forEach((officer, i) => {
      const template = DEFAULT_PHISHING_TEMPLATES[i % DEFAULT_PHISHING_TEMPLATES.length];
      this.results.push({
        id: `sim-res-${Date.now()}-${i}`,
        campaignId,
        clubId: officer.clubId,
        clubName: officer.clubName,
        officerUserId: officer.userId,
        officerName: officer.name,
        officerEmail: officer.email,
        officerRole: officer.role,
        templateId: template.id,
        scenarioTitle: template.subject,
        status: "DELIVERED",
        deliveredAt: now,
        isBudgetAuthorizationGated: false,
      });
    });

    this.campaigns.unshift(newCampaign);
    return newCampaign;
  }

  /**
   * Records an officer's action during a simulated security awareness email.
   */
  public recordOfficerAction(
    resultId: string,
    action: "OPEN" | "REPORT" | "CLICK" | "SUBMIT_CREDENTIALS",
  ): OfficerSimulationResult {
    const result = this.results.find((r) => r.id === resultId);
    if (!result) throw new Error("Simulation record not found");

    const now = new Date().toISOString();

    if (action === "OPEN") {
      result.openedAt = now;
    } else if (action === "REPORT") {
      result.reportedAt = now;
      result.status = "PASSED_REPORTED";
      result.isBudgetAuthorizationGated = false;
    } else if (action === "CLICK") {
      result.clickedAt = now;
      result.status = "FAILED_CLICKED";
      result.isBudgetAuthorizationGated = true;
    } else if (action === "SUBMIT_CREDENTIALS") {
      result.submittedCredentialsAt = now;
      result.status = "FAILED_CREDENTIALS";
      result.isBudgetAuthorizationGated = true;
    }

    return result;
  }

  /**
   * Marks mandatory security retraining module completed for an officer.
   */
  public completeOfficerRetraining(resultId: string): OfficerSimulationResult {
    const result = this.results.find((r) => r.id === resultId);
    if (!result) throw new Error("Simulation record not found");

    result.status = "COMPLIANT_CLEARED";
    result.retrainingCompletedAt = new Date().toISOString();
    result.isBudgetAuthorizationGated = false;

    return result;
  }

  /**
   * Evaluates security compliance and risk grade for a club.
   */
  public getClubSecuritySummary(clubId: string): PhishingSecuritySummary {
    const clubResults = this.results.filter((r) => r.clubId === clubId);
    const clubName = clubResults[0]?.clubName || "Student Club";

    const total = clubResults.length;
    if (total === 0) {
      return {
        clubId,
        clubName,
        totalLeadershipOfficers: 0,
        compliantCount: 0,
        gatedCount: 0,
        passRatePercentage: 100,
        overallRiskGrade: "A_EXCELLENT",
        activeRetrainingMandates: 0,
      };
    }

    const compliantCount = clubResults.filter(
      (r) => r.status === "PASSED_REPORTED" || r.status === "COMPLIANT_CLEARED",
    ).length;

    const gatedCount = clubResults.filter((r) => r.isBudgetAuthorizationGated).length;
    const retrainingMandates = clubResults.filter(
      (r) => r.status === "FAILED_CREDENTIALS" || r.status === "FAILED_CLICKED",
    ).length;

    const passRate = Math.round((compliantCount / total) * 100);

    let riskGrade: "A_EXCELLENT" | "B_GOOD" | "C_NEEDS_IMPROVEMENT" | "D_HIGH_RISK" = "A_EXCELLENT";
    if (passRate >= 90) riskGrade = "A_EXCELLENT";
    else if (passRate >= 75) riskGrade = "B_GOOD";
    else if (passRate >= 50) riskGrade = "C_NEEDS_IMPROVEMENT";
    else riskGrade = "D_HIGH_RISK";

    return {
      clubId,
      clubName,
      totalLeadershipOfficers: total,
      compliantCount,
      gatedCount,
      passRatePercentage: passRate,
      overallRiskGrade: riskGrade,
      activeRetrainingMandates: retrainingMandates,
    };
  }

  public getAllResults(): OfficerSimulationResult[] {
    return [...this.results];
  }

  public getAllCampaigns(): PhishingSimulationCampaign[] {
    return [...this.campaigns];
  }

  public isOfficerAuthorizedForBudget(officerUserId: string): boolean {
    const officerResult = this.results.find((r) => r.officerUserId === officerUserId);
    if (!officerResult) return true; // default authorized if no test failed
    return !officerResult.isBudgetAuthorizationGated;
  }

  public resetToSampleData(): void {
    this.seedInitialData();
  }
}

export const clubPhishingSimulationService = new ClubPhishingSimulationService();
