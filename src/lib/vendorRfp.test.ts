import { describe, it, expect } from "vitest";
import {
  calculateBidSavings,
  rankBidsByValue,
  formatRfpCategoryLabel,
  RfpBid,
} from "./vendorRfp";

describe("Vendor RFP Procurement Utility (#3559)", () => {
  const sampleBids: RfpBid[] = [
    {
      id: "bid-1",
      rfp_id: "rfp-1",
      vendor_name: "TacoCorp Catering",
      vendor_email: "orders@tacocorp.com",
      quoted_price: 1800,
      status: "pending",
    },
    {
      id: "bid-2",
      rfp_id: "rfp-1",
      vendor_name: "Gourmet Banquet LLC",
      vendor_email: "sales@gourmetbanquet.com",
      quoted_price: 2400,
      status: "pending",
    },
    {
      id: "bid-3",
      rfp_id: "rfp-1",
      vendor_name: "Campus Burrito Express",
      vendor_email: "catering@burritoexpress.com",
      quoted_price: 1500,
      status: "pending",
    },
  ];

  it("calculates budget savings amount and percentage", () => {
    // Budget: $2,000, Quote: $1,500 -> Savings: $500 (25.0%)
    const savings = calculateBidSavings(2000, 1500);

    expect(savings.isUnderBudget).toBe(true);
    expect(savings.savingsAmount).toBe(500);
    expect(savings.savingsPercent).toBe(25.0);
  });

  it("identifies over-budget quotes", () => {
    // Budget: $2,000, Quote: $2,400 -> Over budget by -$400
    const savings = calculateBidSavings(2000, 2400);

    expect(savings.isUnderBudget).toBe(false);
    expect(savings.savingsAmount).toBe(-400);
    expect(savings.savingsPercent).toBe(-20.0);
  });

  it("ranks bids by lowest quoted price for best value", () => {
    const ranked = rankBidsByValue(sampleBids);

    expect(ranked[0].vendor_name).toBe("Campus Burrito Express"); // $1500
    expect(ranked[1].vendor_name).toBe("TacoCorp Catering"); // $1800
    expect(ranked[2].vendor_name).toBe("Gourmet Banquet LLC"); // $2400
  });

  it("formats human-readable category labels", () => {
    expect(formatRfpCategoryLabel("catering")).toBe("Catering & Banquet Food");
    expect(formatRfpCategoryLabel("dj_audio")).toBe("DJ, Lighting & Audio");
  });
});
