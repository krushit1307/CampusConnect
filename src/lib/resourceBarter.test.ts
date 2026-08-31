import { describe, expect, it } from "vitest";

import { formatBarterAmount, parseBarterAmount } from "./resourceBarter";

describe("resource barter helpers", () => {
  it("floors points and keeps them integer-valued", () => {
    expect(parseBarterAmount("500.9", "points")).toEqual({
      amountPoints: 500,
      amountCents: null,
    });
  });

  it("normalizes ledger offers into cents", () => {
    expect(parseBarterAmount("10.005", "ledger")).toEqual({
      amountPoints: null,
      amountCents: 1001,
    });
  });

  it("rejects non-positive and non-finite offers", () => {
    expect(parseBarterAmount("0", "points")).toBeNull();
    expect(parseBarterAmount("-4", "ledger")).toBeNull();
    expect(parseBarterAmount("not-a-number", "points")).toBeNull();
  });

  it("formats points and cents for offer summaries", () => {
    expect(formatBarterAmount("points", 500, null)).toBe("500 points");
    expect(formatBarterAmount("ledger", null, 1000)).toBe("$10.00");
  });
});
