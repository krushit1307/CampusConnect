import { describe, it, expect } from "vitest";
import {
  mapToForm990Line,
  generateAuditSealHash,
  generateTaxExemptAuditReport,
  exportTaxExemptAuditCsv,
  exportTaxExemptAuditJson,
  getMockTaxExemptAuditData,
} from "../taxExemptAuditService";

describe("Automated Tax-Exempt Audit Trail Generator Service", () => {
  describe("mapToForm990Line", () => {
    it("maps revenue categories to correct IRS Form 990-EZ schedule lines", () => {
      expect(mapToForm990Line("Corporate Sponsorship", "REVENUE").lineCode).toBe("Line 1");
      expect(mapToForm990Line("Membership Dues", "REVENUE").lineCode).toBe("Line 3");
      expect(mapToForm990Line("Event Ticket Sales", "REVENUE").lineCode).toBe("Line 2");
    });

    it("maps expense categories to correct IRS Form 990-EZ schedule lines", () => {
      expect(mapToForm990Line("Student Scholarship Grant", "EXPENSE").lineCode).toBe("Line 10");
      expect(mapToForm990Line("Speaker Honorarium Fee", "EXPENSE").lineCode).toBe("Line 13");
      expect(mapToForm990Line("Event Catering & Audio/Visual", "EXPENSE").lineCode).toBe("Line 16");
    });
  });

  describe("generateAuditSealHash", () => {
    it("computes a deterministic SHA-256 seal string for audit verification", () => {
      const seal = generateAuditSealHash("club-100-12-3456789-2500-1200");
      expect(seal).toContain("sha256-seal-");
      expect(seal).toContain("-990ez-verified");
    });
  });

  describe("generateTaxExemptAuditReport", () => {
    it("builds a complete Form 990 compliant report payload with gross receipts & SHA-256 digital seal", () => {
      const transactions = [
        { id: "tx-1", date: "2026-03-01", amount: 2000, type: "INCOME" as const, category: "Grants", description: "Corporate Grant" },
        { id: "tx-2", date: "2026-04-01", amount: -500, type: "EXPENSE" as const, category: "Speaker Honorarium", description: "Guest Speaker Fee" },
      ];

      const report = generateTaxExemptAuditReport(
        "club-test-1",
        "Test Robotics Club",
        "Sarah Treasurer",
        transactions
      );

      expect(report.clubName).toBe("Test Robotics Club");
      expect(report.taxInfo.einNumber).toBe("12-3456789");
      expect(report.summary.totalRevenue).toBe(2000);
      expect(report.summary.totalExpenses).toBe(500);
      expect(report.summary.netSurplusDeficit).toBe(1500);
      expect(report.revenueLines.length).toBe(1);
      expect(report.expenseLines.length).toBe(1);
      expect(report.digitalSeal.sha256Hash).toBeDefined();
    });
  });

  describe("export Formats", () => {
    it("generates CSV export string containing IRS headers and transaction rows", () => {
      const report = getMockTaxExemptAuditData("club-csv-test");
      const csv = exportTaxExemptAuditCsv(report);

      expect(csv).toContain("IRS Form 990-N/EZ Tax-Exempt Compliance Audit Report");
      expect(csv).toContain("Gross Receipts");
      expect(csv).toContain("Transaction ID");
      expect(csv).toContain("Line 1");
    });

    it("generates valid JSON audit manifest", () => {
      const report = getMockTaxExemptAuditData("club-json-test");
      const json = exportTaxExemptAuditJson(report);
      const parsed = JSON.parse(json);

      expect(parsed.clubName).toBeDefined();
      expect(parsed.digitalSeal.sha256Hash).toBeDefined();
    });
  });
});
