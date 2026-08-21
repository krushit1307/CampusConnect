import { describe, expect, it } from "vitest";
import {
  calculateFundingTotal,
  validateFundingLineItems,
  type FundingLineItemInput,
} from "./fundingWorkflow";

const validItems: FundingLineItemInput[] = [
  { description: "Portable speaker", amount: 425.5, quote_url: "https://example.com/quote" },
  { description: "Cables", amount: 74.5 },
];

describe("funding workflow helpers", () => {
  it("calculates a currency total to two decimal places", () => {
    expect(calculateFundingTotal(validItems)).toBe(500);
  });

  it("rejects empty, blank, and non-positive line items", () => {
    expect(validateFundingLineItems([])).toBe("Add at least one line item.");
    expect(validateFundingLineItems([{ description: "", amount: 10 }])).toContain("description");
    expect(validateFundingLineItems([{ description: "Speaker", amount: 0 }])).toContain("positive");
    expect(validateFundingLineItems(validItems)).toBeNull();
  });
});
