import { describe, expect, it } from "vitest";

import { calculateEscrowBalance, normalizeContributionAmount } from "./coSponsorship";

describe("co-sponsorship accounting helpers", () => {
  it("normalizes valid contributions to cents", () => {
    expect(normalizeContributionAmount("2000.129")).toBe(2000.13);
    expect(normalizeContributionAmount("0")).toBeNull();
    expect(normalizeContributionAmount("not-a-number")).toBeNull();
  });

  it("returns the remaining escrow after full refunds", () => {
    expect(
      calculateEscrowBalance([
        { amount: 2000, entry_type: "deposit" },
        { amount: 500, entry_type: "deposit" },
        { amount: -2000, entry_type: "refund" },
        { amount: -500, entry_type: "refund" },
      ]),
    ).toBe(0);
  });
});
