import { describe, it, expect } from "vitest";
import {
  buildSponsorRoiSummary,
  getReceiptAuditStatus,
  SponsorLedgerItem,
} from "./sponsorRoiBreakdown";

describe("Build Interactive Event ROI Breakdown for Sponsors Suite (#4408)", () => {
  const sampleTransactions: SponsorLedgerItem[] = [
    {
      transactionId: "tx_1",
      vendorName: "Domino's Pizza",
      category: "Catering",
      amount: 400.0,
      transactionDateIso: "2026-08-20T14:00:00Z",
      receiptOcrUrl: "https://storage.campusconnect.edu/ocr/rec_400.png",
      isVerified: true,
    },
    {
      transactionId: "tx_2",
      vendorName: "AWS Hosting",
      category: "Infrastructure",
      amount: 600.0,
      transactionDateIso: "2026-08-21T10:00:00Z",
      receiptOcrUrl: "https://storage.campusconnect.edu/ocr/rec_600.png",
      isVerified: true,
    },
  ];

  it("aggregates totals, category breakdowns, and produces Sankey graph structures accurately", () => {
    const summary = buildSponsorRoiSummary("spons_acme", "Acme Corp", 1200.0, sampleTransactions);

    expect(summary.totalSponsoredAmount).toBe(1200.0);
    expect(summary.totalSpentAmount).toBe(1000.0);
    expect(summary.remainingBalance).toBe(200.0);

    expect(summary.allocationBreakdown["Catering"]).toBe(400.0);
    expect(summary.allocationBreakdown["Infrastructure"]).toBe(600.0);

    // Nodes: Acme Corp (0), Catering (1), Infrastructure (2), Unallocated Balance (3)
    expect(summary.sankeyData.nodes.length).toBe(4);
    expect(summary.sankeyData.links.length).toBe(3);
  });

  it("returns verified audit badge when receipt OCR URL is present", () => {
    const verifiedTx = sampleTransactions[0];
    const status = getReceiptAuditStatus(verifiedTx);

    expect(status.isAudited).toBe(true);
    expect(status.badgeLabel).toBe("Verified OCR Receipt");
    expect(status.badgeCss).toContain("bg-green-100");
  });

  it("flags missing receipt URLs as pending audit status", () => {
    const unverifiedTx: SponsorLedgerItem = {
      ...sampleTransactions[0],
      receiptOcrUrl: null,
      isVerified: false,
    };
    const status = getReceiptAuditStatus(unverifiedTx);

    expect(status.isAudited).toBe(false);
    expect(status.badgeLabel).toBe("Pending Receipt");
    expect(status.badgeCss).toContain("bg-yellow-100");
  });
});
