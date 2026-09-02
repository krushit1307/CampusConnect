import {
  BackgroundCheckVectorResults,
  ComplianceRiskFlag,
  LeadershipBackgroundCheckRecord,
  ScreeningStatus,
} from "@/types/clubLeadershipBackgroundCheck";

// ─── Default Sample Background Check Records ──────────────────────────────

const SAMPLE_RECORDS: LeadershipBackgroundCheckRecord[] = [
  {
    id: "LBC-101",
    transitionId: "trans-1",
    clubId: "club-robotics",
    clubName: "Campus Robotics Society",
    candidateId: "user-nom-01",
    candidateName: "Jordan Vance",
    candidateEmail: "j.vance@campus.edu",
    roleTitle: "Club President",
    status: "cleared",
    riskFlags: [],
    initiatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    vectors: {
      academic: {
        gpa: 3.65,
        minGpaRequired: 2.5,
        isAcademicProbation: false,
        creditHoursEnrolled: 15,
        minCreditsRequired: 12,
        passed: true,
      },
      judicial: {
        hasActiveDisciplinaryAction: false,
        hasHazingViolations: false,
        hasHonorCodeSuspension: false,
        recordsCount: 0,
        passed: true,
      },
      financial: {
        outstandingDebtCents: 0,
        unpaidDuesCents: 0,
        hasFinancialHold: false,
        passed: true,
      },
      safetyTraining: {
        hasCompletedTitleIX: true,
        hasCompletedHazingPrevention: true,
        hasCompletedFinancialLeadership: true,
        completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        passed: true,
      },
    },
  },
  {
    id: "LBC-102",
    transitionId: "trans-2",
    clubId: "club-finance",
    clubName: "Student Investment Fund",
    candidateId: "user-nom-02",
    candidateName: "Taylor Blake",
    candidateEmail: "t.blake@campus.edu",
    roleTitle: "Treasurer",
    status: "flagged_for_review",
    riskFlags: ["missing_safety_training", "financial_hold"],
    initiatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    vectors: {
      academic: {
        gpa: 3.10,
        minGpaRequired: 2.5,
        isAcademicProbation: false,
        creditHoursEnrolled: 14,
        minCreditsRequired: 12,
        passed: true,
      },
      judicial: {
        hasActiveDisciplinaryAction: false,
        hasHazingViolations: false,
        hasHonorCodeSuspension: false,
        recordsCount: 0,
        passed: true,
      },
      financial: {
        outstandingDebtCents: 15000, // $150 unpaid dues hold
        unpaidDuesCents: 15000,
        hasFinancialHold: true,
        passed: false,
      },
      safetyTraining: {
        hasCompletedTitleIX: true,
        hasCompletedHazingPrevention: false, // missing hazing training
        hasCompletedFinancialLeadership: true,
        passed: false,
      },
    },
  },
];

class ClubLeadershipBackgroundCheckService {
  private records: LeadershipBackgroundCheckRecord[] = [...SAMPLE_RECORDS];

  public getAllRecords(): LeadershipBackgroundCheckRecord[] {
    return [...this.records];
  }

  public getCheckByTransitionId(
    transitionId: string,
  ): LeadershipBackgroundCheckRecord | undefined {
    let found = this.records.find((r) => r.transitionId === transitionId);
    if (!found) {
      // Auto-generate realistic check record if querying unknown transitionId
      found = this.initiateBackgroundCheck({
        transitionId,
        clubId: "club-general",
        clubName: "Campus Student Organization",
        candidateId: `user-${transitionId}`,
        candidateName: "Nominated Officer Candidate",
        candidateEmail: "candidate@campus.edu",
        roleTitle: "Club Officer",
      });
      this.runAutomatedScreening(found.id);
    }
    return found;
  }

  public initiateBackgroundCheck(data: {
    transitionId: string;
    clubId: string;
    clubName: string;
    candidateId: string;
    candidateName: string;
    candidateEmail: string;
    roleTitle: string;
  }): LeadershipBackgroundCheckRecord {
    const id = `LBC-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();

    const record: LeadershipBackgroundCheckRecord = {
      id,
      transitionId: data.transitionId,
      clubId: data.clubId,
      clubName: data.clubName,
      candidateId: data.candidateId,
      candidateName: data.candidateName,
      candidateEmail: data.candidateEmail,
      roleTitle: data.roleTitle,
      status: "pending",
      riskFlags: [],
      initiatedAt: now,
      vectors: {
        academic: {
          gpa: 3.2,
          minGpaRequired: 2.5,
          isAcademicProbation: false,
          creditHoursEnrolled: 14,
          minCreditsRequired: 12,
          passed: true,
        },
        judicial: {
          hasActiveDisciplinaryAction: false,
          hasHazingViolations: false,
          hasHonorCodeSuspension: false,
          recordsCount: 0,
          passed: true,
        },
        financial: {
          outstandingDebtCents: 0,
          unpaidDuesCents: 0,
          hasFinancialHold: false,
          passed: true,
        },
        safetyTraining: {
          hasCompletedTitleIX: true,
          hasCompletedHazingPrevention: true,
          hasCompletedFinancialLeadership: true,
          completedAt: now,
          passed: true,
        },
      },
    };

    this.records.unshift(record);
    return record;
  }

  public runAutomatedScreening(
    checkId: string,
    overrideVectors?: Partial<BackgroundCheckVectorResults>,
  ): LeadershipBackgroundCheckRecord | undefined {
    const record = this.records.find((r) => r.id === checkId);
    if (!record) return undefined;

    record.status = "in_screening";

    if (overrideVectors) {
      record.vectors = { ...record.vectors, ...overrideVectors };
    }

    const riskFlags: ComplianceRiskFlag[] = [];
    const v = record.vectors;

    // Academic vector evaluation
    if (v.academic.gpa < v.academic.minGpaRequired) {
      riskFlags.push("low_gpa");
      v.academic.passed = false;
    }
    if (v.academic.isAcademicProbation) {
      riskFlags.push("academic_probation");
      v.academic.passed = false;
    }
    if (v.academic.creditHoursEnrolled < v.academic.minCreditsRequired) {
      riskFlags.push("part_time_enrollment");
      v.academic.passed = false;
    }

    // Judicial conduct vector evaluation
    if (
      v.judicial.hasActiveDisciplinaryAction ||
      v.judicial.hasHazingViolations ||
      v.judicial.hasHonorCodeSuspension
    ) {
      riskFlags.push("disciplinary_record");
      v.judicial.passed = false;
    }

    // Financial clearance evaluation
    if (v.financial.hasFinancialHold || v.financial.outstandingDebtCents > 0) {
      riskFlags.push("financial_hold");
      v.financial.passed = false;
    }

    // Safety training evaluation
    if (
      !v.safetyTraining.hasCompletedTitleIX ||
      !v.safetyTraining.hasCompletedHazingPrevention
    ) {
      riskFlags.push("missing_safety_training");
      v.safetyTraining.passed = false;
    }

    record.riskFlags = riskFlags;
    record.completedAt = new Date();

    if (riskFlags.length === 0) {
      record.status = "cleared";
    } else {
      record.status = "flagged_for_review";
    }

    return record;
  }

  public manualAdvisorOverride(
    checkId: string,
    advisorName: string,
    decision: "cleared" | "rejected",
    notes: string,
  ): LeadershipBackgroundCheckRecord | undefined {
    const record = this.records.find((r) => r.id === checkId);
    if (!record) return undefined;

    record.status = decision;
    record.advisorOverride = {
      advisorName,
      overrideDecision: decision,
      notes,
      overriddenAt: new Date(),
    };

    return record;
  }

  public isCandidateClearedForLeadership(transitionId: string): boolean {
    const check = this.getCheckByTransitionId(transitionId);
    if (!check) return false;
    return check.status === "cleared";
  }

  public resetToSample() {
    this.records = [...SAMPLE_RECORDS];
  }
}

export const clubLeadershipBackgroundCheckService = new ClubLeadershipBackgroundCheckService();
