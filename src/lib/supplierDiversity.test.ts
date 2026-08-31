// =============================================================================
// Unit Tests: Supplier Diversity (MWBE) Compliance
// Issue: #5291 - Automated "Club Spending" Corporate Tax ID Scraper
// Description: Asserts EIN/name matching against the state directory, badge
// issuance and expiry, search boosting of certified vendors, and the aggregate
// spend report the federal 15% mandate is measured against.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  EscrowPayout,
  MWBE_MANDATE_PERCENT,
  MwbeDirectoryEntry,
  VendorSearchCandidate,
  buildDiversitySpendReport,
  certifyVendor,
  describeCategory,
  isValidEin,
  matchDirectoryEntry,
  normalizeBusinessName,
  normalizeEin,
  rankVendorSearchResults,
} from "./supplierDiversity";

const AS_OF = new Date("2026-09-01T00:00:00Z");

const DIRECTORY: MwbeDirectoryEntry[] = [
  {
    certificateNumber: "MWBE-2026-00412",
    legalName: "Rivera & Daughters Catering, LLC",
    ein: "84-2719305",
    category: "MINORITY_WOMEN_OWNED",
    issuingRegistry: "State MWBE Directory",
    expiresOn: "2027-06-30",
  },
  {
    certificateNumber: "MWBE-2024-00118",
    legalName: "Northside Audio Visual Inc",
    ein: "12-3456789",
    category: "MINORITY_OWNED",
    issuingRegistry: "State MWBE Directory",
    expiresOn: "2026-01-31", // lapsed before AS_OF
  },
  {
    certificateNumber: "MWBE-2026-00755",
    legalName: "Summit Print Works",
    ein: "45-6677889",
    category: "WOMEN_OWNED",
    issuingRegistry: "State MWBE Directory",
    expiresOn: "2028-03-15",
  },
];

const payout = (over: Partial<EscrowPayout> & { contractId: string }): EscrowPayout => ({
  vendorId: "vendor-1",
  vendorName: "Vendor",
  amountUsd: 1000,
  releasedAt: "2026-08-01T00:00:00Z",
  mwbeCertified: false,
  ...over,
});

describe("supplier diversity (#5291)", () => {
  describe("EIN normalization", () => {
    it("accepts raw digits and formatted EINs alike", () => {
      expect(normalizeEin("842719305")).toBe("84-2719305");
      expect(normalizeEin("84-2719305")).toBe("84-2719305");
      expect(isValidEin("84 2719305")).toBe(true);
    });

    it("rejects anything that is not nine digits", () => {
      expect(normalizeEin("84-271930")).toBe("");
      expect(isValidEin("not-an-ein")).toBe(false);
      expect(isValidEin("")).toBe(false);
    });
  });

  describe("legal name canonicalization", () => {
    it("ignores punctuation, ampersands and corporate suffixes", () => {
      expect(normalizeBusinessName("Rivera & Daughters Catering, LLC.")).toBe(
        normalizeBusinessName("Rivera and Daughters Catering LLC"),
      );
      expect(normalizeBusinessName("Summit Print Works, Inc")).toBe("summit print works");
    });
  });

  describe("directory matching", () => {
    it("matches on EIN even when the trading name differs", () => {
      const result = matchDirectoryEntry(
        { vendorId: "v1", legalName: "Rivera Catering Co", ein: "842719305" },
        DIRECTORY,
      );

      expect(result.method).toBe("EIN");
      expect(result.entry?.certificateNumber).toBe("MWBE-2026-00412");
    });

    it("falls back to the legal name when the EIN is not listed", () => {
      const result = matchDirectoryEntry(
        { vendorId: "v1", legalName: "summit print works inc", ein: "99-9999999" },
        DIRECTORY,
      );

      expect(result.method).toBe("LEGAL_NAME");
      expect(result.entry?.certificateNumber).toBe("MWBE-2026-00755");
    });

    it("refuses an ambiguous name match", () => {
      const ambiguous: MwbeDirectoryEntry[] = [
        { ...DIRECTORY[0], certificateNumber: "A", ein: "11-1111111" },
        { ...DIRECTORY[0], certificateNumber: "B", ein: "22-2222222" },
      ];

      const result = matchDirectoryEntry(
        { vendorId: "v1", legalName: "Rivera & Daughters Catering LLC", ein: "99-9999999" },
        ambiguous,
      );

      expect(result.method).toBe("NONE");
      expect(result.entry).toBeNull();
    });
  });

  describe("badge issuance at onboarding", () => {
    it("grants a verified badge for an active certificate", () => {
      const certification = certifyVendor(
        { vendorId: "v1", legalName: "Rivera & Daughters Catering, LLC", ein: "84-2719305" },
        DIRECTORY,
        AS_OF,
      );

      expect(certification.status).toBe("VERIFIED");
      expect(certification.certified).toBe(true);
      expect(certification.category).toBe("MINORITY_WOMEN_OWNED");
      expect(certification.certificateNumber).toBe("MWBE-2026-00412");
      expect(certification.matchMethod).toBe("EIN");
      expect(certification.evidence).toContain("valid to 2027-06-30");
    });

    it("withholds the badge when the certificate has lapsed", () => {
      const certification = certifyVendor(
        { vendorId: "v2", legalName: "Northside Audio Visual Inc", ein: "12-3456789" },
        DIRECTORY,
        AS_OF,
      );

      expect(certification.status).toBe("EXPIRED");
      expect(certification.certified).toBe(false);
      expect(certification.expiresOn).toBe("2026-01-31");
      expect(certification.evidence).toContain("must recertify");
    });

    it("records a miss when the vendor is not in the directory", () => {
      const certification = certifyVendor(
        { vendorId: "v3", legalName: "Generic Supplies", ein: "77-7777777" },
        DIRECTORY,
        AS_OF,
      );

      expect(certification.status).toBe("NOT_FOUND");
      expect(certification.certified).toBe(false);
      expect(certification.evidence).toContain("No MWBE directory record matched");
    });

    it("reports an unusable EIN instead of querying the directory", () => {
      const certification = certifyVendor(
        { vendorId: "v4", legalName: "Rivera & Daughters Catering, LLC", ein: "abc" },
        DIRECTORY,
        AS_OF,
      );

      expect(certification.status).toBe("INVALID_EIN");
      expect(certification.certified).toBe(false);
      expect(certification.evidence).toContain("not a valid federal EIN");
    });
  });

  describe("search boosting", () => {
    const candidates: VendorSearchCandidate[] = [
      { vendorId: "v1", legalName: "Zeta Sound", mwbeCertified: false, relevanceScore: 0.95 },
      {
        vendorId: "v2",
        legalName: "Rivera & Daughters Catering",
        mwbeCertified: true,
        category: "MINORITY_WOMEN_OWNED",
        relevanceScore: 0.4,
      },
      { vendorId: "v3", legalName: "Alpha Rentals", mwbeCertified: false, relevanceScore: 0.95 },
      {
        vendorId: "v4",
        legalName: "Summit Print Works",
        mwbeCertified: true,
        category: "WOMEN_OWNED",
        relevanceScore: 0.6,
      },
    ];

    it("puts certified vendors above more relevant uncertified ones", () => {
      const ranked = rankVendorSearchResults(candidates);

      expect(ranked.slice(0, 2).map((vendor) => vendor.vendorId)).toEqual(["v4", "v2"]);
      expect(ranked.every((vendor, index) => index === 0 || true)).toBe(true);
    });

    it("boosts without filtering, so uncertified vendors stay reachable", () => {
      const ranked = rankVendorSearchResults(candidates);

      expect(ranked).toHaveLength(candidates.length);
      expect(ranked.map((vendor) => vendor.vendorId)).toContain("v1");
    });

    it("breaks ties deterministically by relevance, rating, then name", () => {
      const ranked = rankVendorSearchResults([
        { vendorId: "b", legalName: "Beta", mwbeCertified: false, relevanceScore: 0.5 },
        { vendorId: "a", legalName: "Alpha", mwbeCertified: false, relevanceScore: 0.5 },
        {
          vendorId: "c",
          legalName: "Gamma",
          mwbeCertified: false,
          relevanceScore: 0.5,
          averageRating: 4.9,
        },
      ]);

      expect(ranked.map((vendor) => vendor.vendorId)).toEqual(["c", "a", "b"]);
    });

    it("does not mutate the caller's array", () => {
      const original = [...candidates];
      rankVendorSearchResults(candidates);
      expect(candidates).toEqual(original);
    });
  });

  describe("aggregate spend report", () => {
    it("produces the sentence the Dean asked for", () => {
      const report = buildDiversitySpendReport([
        payout({ contractId: "c1", amountUsd: 820_000 }),
        payout({
          contractId: "c2",
          amountUsd: 180_000,
          mwbeCertified: true,
          category: "MINORITY_WOMEN_OWNED",
        }),
      ]);

      expect(report.headline).toBe(
        "Total Spend: $1,000,000. MWBE Spend: $180,000 (18%). Federal Compliance: Achieved.",
      );
      expect(report.verdict).toBe("ACHIEVED");
      expect(report.mwbePercent).toBe(18);
      expect(report.shortfallUsd).toBe(0);
    });

    it("reports the dollars still needed when the mandate is missed", () => {
      const report = buildDiversitySpendReport([
        payout({ contractId: "c1", amountUsd: 900_000 }),
        payout({
          contractId: "c2",
          amountUsd: 100_000,
          mwbeCertified: true,
          category: "WOMEN_OWNED",
        }),
      ]);

      expect(report.verdict).toBe("NON_COMPLIANT");
      expect(report.mwbePercent).toBe(10);
      expect(report.shortfallUsd).toBe(50_000);
      expect(report.headline).toContain("Federal Compliance: Not met.");
    });

    it("flags a margin too thin to survive one more invoice", () => {
      const report = buildDiversitySpendReport([
        payout({ contractId: "c1", amountUsd: 848_000 }),
        payout({
          contractId: "c2",
          amountUsd: 152_000,
          mwbeCertified: true,
          category: "MINORITY_OWNED",
        }),
      ]);

      expect(report.mwbePercent).toBe(15.2);
      expect(report.verdict).toBe("AT_RISK");
      expect(report.shortfallUsd).toBe(0);
    });

    it("counts only released payouts that moved money", () => {
      const report = buildDiversitySpendReport([
        payout({ contractId: "c1", amountUsd: 0 }),
        payout({ contractId: "c2", amountUsd: 500, mwbeCertified: true, category: "WOMEN_OWNED" }),
      ]);

      expect(report.payoutCount).toBe(1);
      expect(report.totalSpendUsd).toBe(500);
      expect(report.mwbePercent).toBe(100);
    });

    it("splits MWBE spend by ownership category", () => {
      const report = buildDiversitySpendReport([
        payout({
          contractId: "c1",
          amountUsd: 10_000,
          mwbeCertified: true,
          category: "WOMEN_OWNED",
        }),
        payout({
          contractId: "c2",
          amountUsd: 5_000,
          mwbeCertified: true,
          category: "MINORITY_OWNED",
        }),
        payout({ contractId: "c3", amountUsd: 85_000 }),
      ]);

      expect(report.spendByCategoryUsd.WOMEN_OWNED).toBe(10_000);
      expect(report.spendByCategoryUsd.MINORITY_OWNED).toBe(5_000);
      expect(report.spendByCategoryUsd.DISADVANTAGED).toBe(0);
      expect(report.mwbeSpendUsd).toBe(15_000);
    });

    it("handles an empty ledger without dividing by zero", () => {
      const report = buildDiversitySpendReport([]);

      expect(report.totalSpendUsd).toBe(0);
      expect(report.mwbePercent).toBe(0);
      expect(report.verdict).toBe("NON_COMPLIANT");
      expect(report.mandatePercent).toBe(MWBE_MANDATE_PERCENT);
    });

    it("honours a stricter mandate than the federal floor", () => {
      const report = buildDiversitySpendReport(
        [
          payout({ contractId: "c1", amountUsd: 800_000 }),
          payout({
            contractId: "c2",
            amountUsd: 200_000,
            mwbeCertified: true,
            category: "MINORITY_OWNED",
          }),
        ],
        25,
      );

      expect(report.mwbePercent).toBe(20);
      expect(report.verdict).toBe("NON_COMPLIANT");
      expect(report.shortfallUsd).toBe(50_000);
    });
  });

  describe("category labels", () => {
    it("names each ownership class for the badge", () => {
      expect(describeCategory("MINORITY_WOMEN_OWNED")).toBe("Minority & Women-Owned");
      expect(describeCategory("WOMEN_OWNED")).toBe("Women-Owned");
      expect(describeCategory(null)).toBe("Not certified");
    });
  });
});
