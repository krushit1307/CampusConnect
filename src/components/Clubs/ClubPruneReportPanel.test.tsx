// src/components/Clubs/ClubPruneReportPanel.test.tsx
// -----------------------------------------------------------------------------
// Component tests for src/components/Clubs/ClubPruneReportPanel.tsx
// (Issue #3682).
// -----------------------------------------------------------------------------

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ClubPruneReportPanel } from "./ClubPruneReportPanel";
import type { ClubPruneReport, PurgeSummary } from "@/lib/clubPurge";

const mockUseClubPruneReport = vi.fn();
vi.mock("@/hooks/useClubPruneReport", () => ({
  useClubPruneReport: (...args: unknown[]) => mockUseClubPruneReport(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

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

describe("ClubPruneReportPanel", () => {
  beforeEach(() => {
    mockUseClubPruneReport.mockReset();
  });

  it("renders a loading state initially", () => {
    mockUseClubPruneReport.mockReturnValue({
      report: null,
      isLoading: true,
      error: null,
      isDryRunLoading: false,
      triggerDryRun: vi.fn(),
      refresh: vi.fn(),
    });
    render(<ClubPruneReportPanel clubId="club-1" />);
    expect(screen.getByTestId("club-prune-report-loading")).toBeTruthy();
  });

  it("renders an error state when the fetch fails", () => {
    mockUseClubPruneReport.mockReturnValue({
      report: null,
      isLoading: false,
      error: "RPC exploded",
      isDryRunLoading: false,
      triggerDryRun: vi.fn(),
      refresh: vi.fn(),
    });
    render(<ClubPruneReportPanel clubId="club-1" />);
    expect(screen.getByTestId("club-prune-report-error")).toBeTruthy();
    expect(screen.getByTestId("club-prune-report-error").textContent).toContain(
      "RPC exploded",
    );
  });

  it("renders the summary text + last-run time after data loads", () => {
    mockUseClubPruneReport.mockReturnValue({
      report: makeReport({ members_archived: 120 }),
      isLoading: false,
      error: null,
      isDryRunLoading: false,
      triggerDryRun: vi.fn(),
      refresh: vi.fn(),
    });
    render(<ClubPruneReportPanel clubId="club-1" />);
    expect(screen.getByTestId("club-prune-report-panel")).toBeTruthy();
    expect(screen.getByTestId("prune-report-summary").textContent).toContain(
      "We pruned 120 inactive members",
    );
    expect(screen.getByTestId("prune-report-last-run").textContent).toContain(
      "Last run:",
    );
  });

  it("uses singular 'member' when exactly 1 was archived", () => {
    mockUseClubPruneReport.mockReturnValue({
      report: makeReport({ members_archived: 1 }),
      isLoading: false,
      error: null,
      isDryRunLoading: false,
      triggerDryRun: vi.fn(),
      refresh: vi.fn(),
    });
    render(<ClubPruneReportPanel clubId="club-1" />);
    expect(screen.getByTestId("prune-report-summary").textContent).toContain(
      "We pruned 1 inactive member",
    );
  });

  it("shows the empty-state message when 0 were archived", () => {
    mockUseClubPruneReport.mockReturnValue({
      report: makeReport({ members_archived: 0 }),
      isLoading: false,
      error: null,
      isDryRunLoading: false,
      triggerDryRun: vi.fn(),
      refresh: vi.fn(),
    });
    render(<ClubPruneReportPanel clubId="club-1" />);
    expect(screen.getByTestId("prune-report-summary").textContent).toContain(
      "No inactive members were pruned",
    );
  });

  it("shows the stale warning when the report is older than 36 hours", () => {
    mockUseClubPruneReport.mockReturnValue({
      report: makeReport({
        ran_at: new Date(Date.now() - 40 * 60 * 60_000).toISOString(),
      }),
      isLoading: false,
      error: null,
      isDryRunLoading: false,
      triggerDryRun: vi.fn(),
      refresh: vi.fn(),
    });
    render(<ClubPruneReportPanel clubId="club-1" />);
    expect(screen.getByTestId("prune-report-stale-warning")).toBeTruthy();
  });

  it("does not show the stale warning for a fresh report", () => {
    mockUseClubPruneReport.mockReturnValue({
      report: makeReport({
        ran_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      }),
      isLoading: false,
      error: null,
      isDryRunLoading: false,
      triggerDryRun: vi.fn(),
      refresh: vi.fn(),
    });
    render(<ClubPruneReportPanel clubId="club-1" />);
    expect(screen.queryByTestId("prune-report-stale-warning")).toBeNull();
  });

  it("calls triggerDryRun when the dry-run button is clicked", async () => {
    const triggerDryRun = vi.fn().mockResolvedValue({
      dry_run: true,
      inactivity_threshold_months: 18,
      cutoff: new Date().toISOString(),
      total_archived: 50,
      clubs_touched: 1,
      per_club: [
        { club_id: "club-1", club_name: "Chess Club", members_archived: 50 },
      ],
    } as PurgeSummary);
    mockUseClubPruneReport.mockReturnValue({
      report: makeReport(),
      isLoading: false,
      error: null,
      isDryRunLoading: false,
      triggerDryRun,
      refresh: vi.fn(),
    });
    render(<ClubPruneReportPanel clubId="club-1" />);
    fireEvent.click(screen.getByTestId("prune-report-dry-run-btn"));
    await waitFor(() => expect(triggerDryRun).toHaveBeenCalled());
  });

  it("disables the dry-run button while a dry-run is in flight", () => {
    mockUseClubPruneReport.mockReturnValue({
      report: makeReport(),
      isLoading: false,
      error: null,
      isDryRunLoading: true,
      triggerDryRun: vi.fn(),
      refresh: vi.fn(),
    });
    render(<ClubPruneReportPanel clubId="club-1" />);
    const btn = screen.getByTestId(
      "prune-report-dry-run-btn",
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain("Running preview");
  });

  it("renders the effects list explaining what 'archived' means", () => {
    mockUseClubPruneReport.mockReturnValue({
      report: makeReport(),
      isLoading: false,
      error: null,
      isDryRunLoading: false,
      triggerDryRun: vi.fn(),
      refresh: vi.fn(),
    });
    render(<ClubPruneReportPanel clubId="club-1" />);
    const effects = screen.getByTestId("prune-report-effects");
    expect(effects.textContent).toContain("Total Members");
    expect(effects.textContent).toContain("push notifications");
    expect(effects.textContent).toContain("weekly digest");
  });

  it("calls refresh when the refresh button is clicked", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    mockUseClubPruneReport.mockReturnValue({
      report: makeReport(),
      isLoading: false,
      error: null,
      isDryRunLoading: false,
      triggerDryRun: vi.fn(),
      refresh,
    });
    render(<ClubPruneReportPanel clubId="club-1" />);
    fireEvent.click(screen.getByTestId("prune-report-refresh"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
