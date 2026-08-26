/**
 * Club Succession Planning Health Score Service
 *
 * Provides automated continuity monitoring, executive board graduation analysis,
 * leadership pipeline tracking, and succession risk alerting for the Student Union (#4138).
 */

export interface ExecutiveMember {
  userId: string;
  name: string;
  role:
    | "President"
    | "Vice President"
    | "Treasurer"
    | "Secretary"
    | "Committee Lead"
    | "Officer-in-Training";
  expectedGraduationYear: number;
  isGraduatingThisYear: boolean;
}

export type SuccessionRiskLevel = "HEALTHY" | "MODERATE_RISK" | "CRITICAL_SUCCESSION_RISK";

export interface SuccessionHealthReport {
  clubId: string;
  clubName: string;
  currentAcademicYear: number;
  totalExecutives: number;
  graduatingExecutivesCount: number;
  graduatingRatioPercentage: number; // e.g. 80.0
  underclassmenInPipeline: number;
  healthScore: number; // 0 - 100
  riskLevel: SuccessionRiskLevel;
  warningNotice: string | null;
  flaggedToStudentUnion: boolean;
  recommendedActionPlan: string[];
  executives: ExecutiveMember[];
}

export interface SuccessorNomination {
  id: string;
  clubId: string;
  nomineeUserId: string;
  nomineeName: string;
  targetRole: string;
  expectedGraduationYear: number;
  nominatedByUserId: string;
  status: "PROPOSED" | "ACCEPTED" | "SHADOWING" | "CONFIRMED";
  createdAt: string;
}

export class ClubSuccessionHealthService {
  private static nominations = new Map<string, SuccessorNomination>();

  /**
   * Evaluates succession health for a club based on executive board graduation timeline
   */
  static evaluateSuccessionHealth(params: {
    clubId: string;
    clubName: string;
    currentAcademicYear?: number;
    executives: ExecutiveMember[];
    underclassmenPipelineCount?: number;
  }): SuccessionHealthReport {
    const currentAcademicYear = params.currentAcademicYear || new Date().getFullYear();
    const executives = params.executives.map((exec) => ({
      ...exec,
      isGraduatingThisYear: exec.expectedGraduationYear <= currentAcademicYear,
    }));

    const totalExecutives = executives.length;
    const graduatingCount = executives.filter((e) => e.isGraduatingThisYear).length;
    const graduatingRatio =
      totalExecutives > 0 ? Number(((graduatingCount / totalExecutives) * 100).toFixed(1)) : 0;

    // Count underclassmen (graduating in > currentAcademicYear + 1)
    const pipelineCount =
      params.underclassmenPipelineCount !== undefined
        ? params.underclassmenPipelineCount
        : executives.filter(
            (e) =>
              (e.role === "Committee Lead" ||
                e.role === "Officer-in-Training" ||
                e.role === "Vice President") &&
              e.expectedGraduationYear > currentAcademicYear + 1,
          ).length;

    let riskLevel: SuccessionRiskLevel = "HEALTHY";
    let healthScore = 100;
    let warningNotice: string | null = null;
    let flaggedToStudentUnion = false;
    const recommendedActionPlan: string[] = [];

    // Core Heuristic: If > 75% graduating and 0 underclassmen in pipeline -> CRITICAL
    if (graduatingRatio > 75.0 && pipelineCount === 0) {
      riskLevel = "CRITICAL_SUCCESSION_RISK";
      healthScore = Math.max(15, Math.round(100 - graduatingRatio - 15));
      warningNotice =
        "⚠ Succession Risk: Over 75% of your leadership team is graduating with 0 underclassmen in the pipeline. Please promote underclassmen to leadership tracks immediately to ensure club survival.";
      flaggedToStudentUnion = true;

      recommendedActionPlan.push("Host an Underclassmen Leadership Info Session within 14 days.");
      recommendedActionPlan.push(
        "Appoint at least 2 Freshmen/Sophomores as 'Officers-in-Training'.",
      );
      recommendedActionPlan.push(
        "Schedule formal Google Drive & financial account handover session.",
      );
      recommendedActionPlan.push("Submit formal transition documentation to the Student Union.");
    } else if (graduatingRatio >= 50.0 || pipelineCount === 0) {
      riskLevel = "MODERATE_RISK";
      healthScore = Math.max(45, Math.round(100 - graduatingRatio / 1.5));
      warningNotice =
        "Notice: Moderate succession risk detected. Consider recruiting younger members into deputy officer positions.";

      recommendedActionPlan.push("Recruit deputy committee chairs for the upcoming semester.");
      recommendedActionPlan.push("Begin shadowing program for key operational roles.");
    } else {
      riskLevel = "HEALTHY";
      healthScore = Math.min(100, Math.max(85, 100 - Math.round(graduatingRatio / 2)));
      recommendedActionPlan.push("Maintain regular officer mentorship sessions.");
    }

    return {
      clubId: params.clubId,
      clubName: params.clubName,
      currentAcademicYear,
      totalExecutives,
      graduatingExecutivesCount: graduatingCount,
      graduatingRatioPercentage: graduatingRatio,
      underclassmenInPipeline: pipelineCount,
      healthScore,
      riskLevel,
      warningNotice,
      flaggedToStudentUnion,
      recommendedActionPlan,
      executives,
    };
  }

  /**
   * Nominate an underclassman as a successor/officer-in-training
   */
  static nominateSuccessor(params: {
    clubId: string;
    nomineeUserId: string;
    nomineeName: string;
    targetRole: string;
    expectedGraduationYear: number;
    nominatedByUserId: string;
  }): SuccessorNomination {
    const nominationId = `nom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nomination: SuccessorNomination = {
      id: nominationId,
      clubId: params.clubId,
      nomineeUserId: params.nomineeUserId,
      nomineeName: params.nomineeName,
      targetRole: params.targetRole,
      expectedGraduationYear: params.expectedGraduationYear,
      nominatedByUserId: params.nominatedByUserId,
      status: "PROPOSED",
      createdAt: new Date().toISOString(),
    };

    this.nominations.set(nominationId, nomination);
    return nomination;
  }

  /**
   * Get active nominations for a club
   */
  static getNominationsForClub(clubId: string): SuccessorNomination[] {
    return Array.from(this.nominations.values()).filter((n) => n.clubId === clubId);
  }

  /**
   * Advance nomination status (e.g. to SHADOWING or CONFIRMED)
   */
  static updateNominationStatus(
    nominationId: string,
    status: "ACCEPTED" | "SHADOWING" | "CONFIRMED",
  ): SuccessorNomination {
    const nomination = this.nominations.get(nominationId);
    if (!nomination) throw new Error("Nomination not found");
    nomination.status = status;
    return nomination;
  }

  /**
   * Reset state for tests
   */
  static resetState(): void {
    this.nominations.clear();
  }
}
