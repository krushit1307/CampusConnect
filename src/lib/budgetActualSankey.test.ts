import { describe, expect, it } from "vitest";
import { buildBudgetActualSankeyData } from "./budgetActualSankey";

describe("buildBudgetActualSankeyData", () => {
  it("matches actual spending to approved budget buckets and records a positive variance", () => {
    const result = buildBudgetActualSankeyData(
      [{ id: "food", description: "Food", amount: 200 }],
      [{ id: "dominos", description: "Food catering", vendor: "Domino's", amount: 600 }],
    );

    expect(result.totals).toMatchObject({
      approved: 200,
      actual: 600,
      variance: 400,
      overrun: 400,
    });
    expect(result.links).toContainEqual(
      expect.objectContaining({
        source: "overrun-dominos",
        target: "actual-dominos",
        value: 400,
        overrun: true,
        variance: 400,
      }),
    );
  });

  it("creates an unspent flow when actual spending is below budget", () => {
    const result = buildBudgetActualSankeyData(
      [{ id: "speaker", description: "Speaker", amount: 500 }],
      [{ id: "speaker-expense", description: "Speaker rental", amount: 100 }],
    );

    expect(result.totals).toMatchObject({
      approved: 500,
      actual: 100,
      variance: -400,
      unspent: 400,
      overrun: 0,
    });
    expect(result.links).toContainEqual(
      expect.objectContaining({ source: "budget-speaker", target: "unspent-speaker", value: 400 }),
    );
  });

  it("keeps unmatched actual expenses visible as red unallocated flows", () => {
    const result = buildBudgetActualSankeyData(
      [{ id: "food", description: "Food", amount: 200 }],
      [{ id: "decor", description: "Decorations", amount: 75 }],
    );

    expect(result.links).toContainEqual(
      expect.objectContaining({
        source: "unallocated-decor",
        target: "actual-decor",
        value: 75,
        overrun: true,
      }),
    );
    expect(result.totals.overrun).toBe(75);
  });
});
