import { describe, expect, it } from "vitest";
import { formatCurrency } from "./eventRoiReport";

describe("event ROI report helpers", () => {
  it("formats cents as USD", () => {
    expect(formatCurrency(800000)).toBe("$8,000.00");
    expect(formatCurrency(0)).toBe("$0.00");
  });
});
