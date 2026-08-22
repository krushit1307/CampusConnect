// src/lib/clubPurge.test.ts
// -----------------------------------------------------------------------------
// Unit tests for src/lib/clubPurge.ts (Issue #3682).
// Pure tests — no React, no Supabase.
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  formatPruneSummary,
  formatRelativeRunTime,
  isReportStale,
  type ClubPruneReport,
} from "./clubPurge";

function makeReport(overrides: Partial<ClubPruneReport> = {}): ClubPruneReport {
  return {
    club_id: "club-1",
    members_archived: 120,
    dry_run: false,
    ran_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    run_id: 1,
    ...overrides,
  };
}

describe("formatPruneSummary", () => {
  it("returns the standard summary string for a multi-member purge", () => {
    const r = makeReport({ members_archived: 120 });
    expect(formatPruneSummary(r)).toBe(
      "We pruned 120 inactive members from your roster to improve your engagement metrics.",
    );
  });

  it("uses singular 'member' when exactly 1 was archived", () => {
    const r = makeReport({ members_archived: 1 });
    expect(formatPruneSummary(r)).toBe(
      "We pruned 1 inactive member from your roster to improve your engagement metrics.",
    );
  });

  it("returns the empty-state message when 0 were archived", () => {
    const r = makeReport({ members_archived: 0 });
    expect(formatPruneSummary(r)).toBe(
      "No inactive members were pruned in the latest run.",
    );
  });
});

describe("formatRelativeRunTime", () => {
  const NOW = new Date("2026-06-01T12:00:00.000Z");

  it("returns 'never' for null / undefined / invalid timestamps", () => {
    expect(formatRelativeRunTime(null, NOW)).toBe("never");
    expect(formatRelativeRunTime(undefined, NOW)).toBe("never");
    expect(formatRelativeRunTime("not-a-date", NOW)).toBe("never");
  });

  it("returns 'just now' for a timestamp less than 1 minute ago", () => {
    const ts = new Date(NOW.getTime() - 30_000).toISOString();
    expect(formatRelativeRunTime(ts, NOW)).toBe("just now");
  });

  it("returns 'ran N minutes ago' for sub-hour timestamps", () => {
    const ts = new Date(NOW.getTime() - 5 * 60_000).toISOString();
    expect(formatRelativeRunTime(ts, NOW)).toBe("ran 5 minutes ago");
  });

  it("uses singular 'minute' when exactly 1 minute ago", () => {
    const ts = new Date(NOW.getTime() - 60_000).toISOString();
    expect(formatRelativeRunTime(ts, NOW)).toBe("ran 1 minute ago");
  });

  it("returns 'ran N hours ago' for sub-day timestamps", () => {
    const ts = new Date(NOW.getTime() - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeRunTime(ts, NOW)).toBe("ran 3 hours ago");
  });

  it("returns 'ran yesterday' for a 24-48h gap", () => {
    const ts = new Date(NOW.getTime() - 25 * 60 * 60_000).toISOString();
    expect(formatRelativeRunTime(ts, NOW)).toBe("ran yesterday");
  });

  it("returns 'ran N days ago' for sub-month gaps", () => {
    const ts = new Date(NOW.getTime() - 5 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeRunTime(ts, NOW)).toBe("ran 5 days ago");
  });

  it("returns 'ran N months ago' for >30-day gaps", () => {
    const ts = new Date(NOW.getTime() - 60 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeRunTime(ts, NOW)).toBe("ran 2 months ago");
  });

  it("returns 'just now' for a future timestamp (clock skew)", () => {
    const ts = new Date(NOW.getTime() + 5_000).toISOString();
    expect(formatRelativeRunTime(ts, NOW)).toBe("just now");
  });
});

describe("isReportStale", () => {
  const NOW = new Date("2026-06-01T12:00:00.000Z");

  it("returns true when the report is null", () => {
    expect(isReportStale(null, NOW)).toBe(true);
  });

  it("returns true when ran_at is missing", () => {
    const r = makeReport({ ran_at: "" });
    expect(isReportStale(r, NOW)).toBe(true);
  });

  it("returns true when ran_at is invalid", () => {
    const r = makeReport({ ran_at: "not-a-date" });
    expect(isReportStale(r, NOW)).toBe(true);
  });

  it("returns true when the run is older than 36 hours", () => {
    const r = makeReport({
      ran_at: new Date(NOW.getTime() - 40 * 60 * 60_000).toISOString(),
    });
    expect(isReportStale(r, NOW)).toBe(true);
  });

  it("returns false when the run is exactly 36 hours old (boundary, strict >)", () => {
    const r = makeReport({
      ran_at: new Date(NOW.getTime() - 36 * 60 * 60_000).toISOString(),
    });
    expect(isReportStale(r, NOW)).toBe(false);
  });

  it("returns false when the run is less than 36 hours old", () => {
    const r = makeReport({
      ran_at: new Date(NOW.getTime() - 12 * 60 * 60_000).toISOString(),
    });
    expect(isReportStale(r, NOW)).toBe(false);
  });

  it("returns false when the run is fresh (2 hours ago)", () => {
    const r = makeReport({
      ran_at: new Date(NOW.getTime() - 2 * 60 * 60_000).toISOString(),
    });
    expect(isReportStale(r, NOW)).toBe(false);
  });
});
