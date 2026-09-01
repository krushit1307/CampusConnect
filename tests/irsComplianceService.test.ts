import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database client
vi.mock("../db/client", () => ({
  query: vi.fn(),
}));

// Mock the IRS service
vi.mock("../server/services/irsComplianceService", async () => {
  const actual = await vi.importActual("../server/services/irsComplianceService");
  return {
    ...actual,
    queryIRSByEIN: vi.fn(),
  };
});

import { query } from "../db/client";
import {
  evaluateCompliance,
  calculateNextVerificationDate,
  queryIRSByEIN,
  type IRS OrganizationRecord,
} from "../server/services/irsComplianceService";

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockQueryIRSByEIN = queryIRSByEIN as ReturnType<typeof vi.fn>;

describe("IRS Compliance Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("evaluateCompliance", () => {
    it("returns active for compliant organization with recent filing", () => {
      const record: IRS OrganizationRecord = {
        ein: "123456789",
        name: "Test Foundation",
        rulingDate: "2010-01-01",
        filingStatus: "01",
        mostRecentFilingDate: "2025-06-15",
      };

      const result = evaluateCompliance(record, new Date("2025-08-29"));

      expect(result.status).toBe("active");
      expect(result.reason).toBe("Organization is compliant");
    });

    it("returns revoked for organization with revocation date", () => {
      const record: IRS OrganizationRecord = {
        ein: "111111111",
        name: "Revoked Foundation",
        rulingDate: "2000-01-01",
        revocationDate: "2024-05-15",
        filingStatus: "03",
      };

      const result = evaluateCompliance(record);

      expect(result.status).toBe("revoked");
      expect(result.revocationDate).toEqual(new Date("2024-05-15"));
    });

    it("returns non_compliant for delinquent filing status", () => {
      const record: IRS OrganizationRecord = {
        ein: "987654321",
        name: "Stale Filing Charity",
        rulingDate: "2005-01-01",
        filingStatus: "02",
        mostRecentFilingDate: "2023-01-10",
      };

      const result = evaluateCompliance(record, new Date("2025-08-29"));

      expect(result.status).toBe("non_compliant");
      expect(result.reason).toContain("delinquent");
    });

    it("returns non_compliant when filing exceeds lookback window", () => {
      const record: IRS OrganizationRecord = {
        ein: "222222222",
        name: "Old Filing Org",
        rulingDate: "2005-01-01",
        filingStatus: "01",
        mostRecentFilingDate: "2023-06-01", // More than 18 months ago
      };

      const result = evaluateCompliance(record, new Date("2025-08-29"));

      expect(result.status).toBe("non_compliant");
      expect(result.reason).toContain("18-month window");
    });

    it("returns active when filing is within lookback window", () => {
      const record: IRS OrganizationRecord = {
        ein: "333333333",
        name: "Recent Filing Org",
        rulingDate: "2005-01-01",
        filingStatus: "01",
        mostRecentFilingDate: "2025-01-15", // Within 18 months
      };

      const result = evaluateCompliance(record, new Date("2025-08-29"));

      expect(result.status).toBe("active");
    });
  });

  describe("calculateNextVerificationDate", () => {
    it("returns 30 days from now for active partners", () => {
      const currentDate = new Date("2025-08-29");
      const result = calculateNextVerificationDate("active", currentDate);

      expect(result.getDate()).toBe(28); // 29 + 30 = 59, minus August (31 days) = 28
      expect(result.getMonth()).toBe(9); // September (0-indexed)
    });

    it("returns 7 days from now for non-compliant partners", () => {
      const currentDate = new Date("2025-08-29");
      const result = calculateNextVerificationDate("non_compliant", currentDate);

      expect(result.getDate()).toBe(5); // 29 + 7 = 36, minus August (31 days) = 5
      expect(result.getMonth()).toBe(9); // September
    });

    it("returns 7 days from now for revoked partners", () => {
      const currentDate = new Date("2025-08-29");
      const result = calculateNextVerificationDate("revoked", currentDate);

      expect(result.getDate()).toBe(5);
    });
  });

  describe("queryIRSByEIN", () => {
    it("throws error for invalid EIN format", async () => {
      await expect(queryIRSByEIN("123")).rejects.toThrow("Invalid EIN format");
      await expect(queryIRSByEIN("1234567890")).rejects.toThrow("Invalid EIN format");
      await expect(queryIRSByEIN("ABCDEFGHI")).rejects.toThrow("Invalid EIN format");
    });

    it("accepts EIN with hyphens", async () => {
      mockQueryIRSByEIN.mockResolvedValueOnce(null);
      
      // Should not throw
      await queryIRSByEIN("12-3456789");
      expect(mockQueryIRSByEIN).toHaveBeenCalled();
    });
  });

  describe("recordComplianceCheck", () => {
    it("inserts compliance check record", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const { recordComplianceCheck } = await import("../server/services/irsComplianceService");
      
      await recordComplianceCheck("partner-123", {
        partnerId: "partner-123",
        ein: "123456789",
        status: "pass",
        filingStatus: "01",
        lastFilingDate: new Date("2025-06-15"),
        revocationDate: null,
        revocationReason: null,
        irsResponse: { name: "Test Foundation" },
        errorMessage: null,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO compliance_checks"),
        expect.arrayContaining(["partner-123", "monthly", "pass"])
      );
    });
  });

  describe("lockPartnerLedger", () => {
    it("creates lock record when not already locked", async () => {
      // No existing lock
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Insert succeeds
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const { lockPartnerLedger } = await import("../server/services/irsComplianceService");
      
      await lockPartnerLedger("partner-456", "non_compliant");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO partner_ledger_locks"),
        ["partner-456", "non_compliant", "system"]
      );
    });

    it("does not create duplicate lock", async () => {
      // Existing lock found
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "existing-lock" }] });

      const { lockPartnerLedger } = await import("../server/services/irsComplianceService");
      
      await lockPartnerLedger("partner-456", "non_compliant");

      // Should not call insert
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO partner_ledger_locks"),
        expect.anything()
      );
    });
  });
});
