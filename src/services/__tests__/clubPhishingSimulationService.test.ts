import { describe, it, expect, beforeEach } from "vitest";
import { ClubPhishingSimulationService } from "../clubPhishingSimulationService";

describe("ClubPhishingSimulationService", () => {
  let service: ClubPhishingSimulationService;

  beforeEach(() => {
    service = new ClubPhishingSimulationService();
    service.resetToSampleData();
  });

  describe("generateCampaign", () => {
    it("should generate a new simulation campaign targeting officers", () => {
      const campaign = service.generateCampaign("Spring 2027 Security Awareness Campaign");
      expect(campaign.id).toBeDefined();
      expect(campaign.title).toBe("Spring 2027 Security Awareness Campaign");
      expect(campaign.status).toBe("ACTIVE");
      expect(campaign.totalOfficersTargeted).toBeGreaterThan(0);
    });
  });

  describe("recordOfficerAction", () => {
    it("should record REPORT action and mark status PASSED_REPORTED with budget un-gated", () => {
      const results = service.getAllResults();
      const target = results[0];

      const updated = service.recordOfficerAction(target.id, "REPORT");

      expect(updated.status).toBe("PASSED_REPORTED");
      expect(updated.reportedAt).toBeDefined();
      expect(updated.isBudgetAuthorizationGated).toBe(false);
    });

    it("should record CLICK action and mark status FAILED_CLICKED with budget gated", () => {
      const results = service.getAllResults();
      const target = results[0];

      const updated = service.recordOfficerAction(target.id, "CLICK");

      expect(updated.status).toBe("FAILED_CLICKED");
      expect(updated.clickedAt).toBeDefined();
      expect(updated.isBudgetAuthorizationGated).toBe(true);
    });

    it("should record SUBMIT_CREDENTIALS and mark status FAILED_CREDENTIALS with budget gated", () => {
      const results = service.getAllResults();
      const target = results[0];

      const updated = service.recordOfficerAction(target.id, "SUBMIT_CREDENTIALS");

      expect(updated.status).toBe("FAILED_CREDENTIALS");
      expect(updated.submittedCredentialsAt).toBeDefined();
      expect(updated.isBudgetAuthorizationGated).toBe(true);
    });
  });

  describe("completeOfficerRetraining", () => {
    it("should mark retraining complete and un-gate budget authorization", () => {
      const results = service.getAllResults();
      const gatedResult = results.find((r) => r.isBudgetAuthorizationGated);

      expect(gatedResult).toBeDefined();
      if (gatedResult) {
        const updated = service.completeOfficerRetraining(gatedResult.id);

        expect(updated.status).toBe("COMPLIANT_CLEARED");
        expect(updated.retrainingCompletedAt).toBeDefined();
        expect(updated.isBudgetAuthorizationGated).toBe(false);
      }
    });
  });

  describe("getClubSecuritySummary", () => {
    it("should aggregate pass rate %, risk grade, and retraining mandates", () => {
      const roboticsSummary = service.getClubSecuritySummary("club-robotics");

      expect(roboticsSummary.clubId).toBe("club-robotics");
      expect(roboticsSummary.totalLeadershipOfficers).toBe(2);
      expect(roboticsSummary.passRatePercentage).toBe(100);
      expect(roboticsSummary.overallRiskGrade).toBe("A_EXCELLENT");
    });
  });

  describe("isOfficerAuthorizedForBudget", () => {
    it("should return false if officer has a gated simulation failure", () => {
      const results = service.getAllResults();
      const gated = results.find((r) => r.isBudgetAuthorizationGated);

      if (gated) {
        expect(service.isOfficerAuthorizedForBudget(gated.officerUserId)).toBe(false);
      }
    });
  });
});
