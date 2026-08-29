import { describe, expect, it } from "vitest";

import { isEligibleForInactivePurge, purgeSummaryMessage } from "./inactiveAccountPurge";

const now = new Date("2026-08-26T00:00:00.000Z");

describe("inactive account purge policy", () => {
  it("selects a student whose last sign-in is older than four years", () => {
    expect(
      isEligibleForInactivePurge(
        {
          lastSignInAt: "2022-08-25T23:59:59.000Z",
          createdAt: "2020-01-01T00:00:00.000Z",
          role: "student",
        },
        now,
      ),
    ).toBe(true);
  });

  it("falls back to account creation when last sign-in is null", () => {
    expect(
      isEligibleForInactivePurge(
        { lastSignInAt: null, createdAt: "2022-08-25T23:59:59.000Z", role: "user" },
        now,
      ),
    ).toBe(true);
  });

  it("never selects alumni or mentor roles", () => {
    expect(
      isEligibleForInactivePurge(
        {
          lastSignInAt: "2020-01-01T00:00:00.000Z",
          createdAt: "2020-01-01T00:00:00.000Z",
          role: "alumni",
        },
        now,
      ),
    ).toBe(false);
    expect(
      isEligibleForInactivePurge(
        {
          lastSignInAt: "2020-01-01T00:00:00.000Z",
          createdAt: "2020-01-01T00:00:00.000Z",
          role: "mentor",
        },
        now,
      ),
    ).toBe(false);
  });

  it("rejects thresholds shorter than the required four years", () => {
    expect(
      isEligibleForInactivePurge(
        {
          lastSignInAt: "2020-01-01T00:00:00.000Z",
          createdAt: "2020-01-01T00:00:00.000Z",
          role: "student",
        },
        now,
        3,
      ),
    ).toBe(false);
  });

  it("describes dry-run and completed summaries", () => {
    expect(purgeSummaryMessage({ dry_run: true, examined: 1, anonymized: 0, failed: 0 })).toContain(
      "Dry run identified 1 inactive account.",
    );
    expect(
      purgeSummaryMessage({ dry_run: false, examined: 2, anonymized: 2, failed: 0 }),
    ).toContain("Anonymized 2 inactive accounts");
  });
});
