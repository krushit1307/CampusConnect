import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConstitutionTimeline } from "./ConstitutionTimeline";
import type { ArchivedConstitution } from "@/lib/constitutionTimeline";

const mockVersions: ArchivedConstitution[] = [
  {
    id: "v1-id",
    version_number: 1,
    raw_text: "Article I — Name. The club shall be called the Chess Club.",
    file_url: null,
    published_by: null,
    change_summary: "Original constitution",
    effective_from: "2018-09-01T00:00:00.000Z",
    effective_to: "2022-09-01T00:00:00.000Z",
    created_at: "2018-09-01T00:00:00.000Z",
    is_current: false,
  },
  {
    id: "v2-id",
    version_number: 2,
    raw_text:
      "Article I — Name. The club shall be called the Chess & Go Club.\nArticle IV — Veto. The President may veto any vote.",
    file_url: "club-1/v2.pdf",
    published_by: null,
    change_summary: "Added presidential veto clause",
    effective_from: "2022-09-01T00:00:00.000Z",
    effective_to: "2026-01-01T00:00:00.000Z",
    created_at: "2022-09-01T00:00:00.000Z",
    is_current: false,
  },
  {
    id: "v3-id",
    version_number: 3,
    raw_text:
      "Article I — Name. The club shall be called the Chess & Go Club.\nArticle IV — Veto. The President may not veto any vote.",
    file_url: "club-1/v3.pdf",
    published_by: null,
    change_summary: "Removed presidential veto clause",
    effective_from: "2026-01-01T00:00:00.000Z",
    effective_to: null,
    created_at: "2026-01-01T00:00:00.000Z",
    is_current: true,
  },
];

const rpcMock = vi.fn().mockImplementation((fnName: string) => {
  if (fnName === "get_constitution_timeline") {
    return Promise.resolve({ data: mockVersions, error: null });
  }
  return Promise.resolve({ data: null, error: null });
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: rpcMock,
    storage: {
      from: () => ({
        download: () =>
          Promise.resolve({ data: new Blob(["pdf"]), error: null }),
      }),
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("ConstitutionTimeline", () => {
  beforeEach(() => {
    rpcMock.mockClear();
  });

  it("renders a loading state initially", async () => {
    render(<ConstitutionTimeline clubId="club-1" clubName="Chess Club" />);
    expect(screen.getByTestId("constitution-timeline-loading")).toBeTruthy();
  });

  it("renders the slider and the current version after data loads", async () => {
    render(<ConstitutionTimeline clubId="club-1" clubName="Chess Club" />);
    await waitFor(() => {
      expect(screen.getByTestId("constitution-timeline")).toBeTruthy();
    });
    expect(screen.getByTestId("constitution-timeline-slider")).toBeTruthy();
    expect(screen.getByText(/Version 3/i)).toBeTruthy();
    expect(screen.getByText(/CURRENT/i)).toBeTruthy();
    expect(
      screen.getByTestId("constitution-text-pane").textContent,
    ).toContain("The President may not veto any vote");
  });

  it("does not show the 'Compare to Current' button when already on the current version", async () => {
    render(<ConstitutionTimeline clubId="club-1" />);
    await waitFor(() =>
      expect(screen.getByTestId("constitution-timeline")).toBeTruthy(),
    );
    expect(screen.queryByTestId("compare-to-current-btn")).toBeNull();
  });

  it("jumps to an older version when its year label is clicked", async () => {
    render(<ConstitutionTimeline clubId="club-1" clubName="Chess Club" />);
    await waitFor(() =>
      expect(screen.getByTestId("constitution-timeline")).toBeTruthy(),
    );
    fireEvent.click(screen.getByLabelText("Jump to Sep 2022"));
    expect(
      screen.getByTestId("constitution-text-pane").textContent,
    ).toContain("The President may veto any vote");
    expect(screen.getByTestId("compare-to-current-btn")).toBeTruthy();
  });

  it("opens the diff modal when 'Compare to Current' is clicked", async () => {
    render(<ConstitutionTimeline clubId="club-1" clubName="Chess Club" />);
    await waitFor(() =>
      expect(screen.getByTestId("constitution-timeline")).toBeTruthy(),
    );
    fireEvent.click(screen.getByLabelText("Jump to Sep 2022"));
    fireEvent.click(screen.getByTestId("compare-to-current-btn"));
    const modal = await screen.findByTestId("constitution-diff-modal");
    expect(modal).toBeTruthy();
    expect(screen.getByText("Version 2 · Sep 2022")).toBeTruthy();
    expect(screen.getByText("Version 3 · Jan 2026 (current)")).toBeTruthy();
  });

  it("closes the diff modal when the close button is clicked", async () => {
    render(<ConstitutionTimeline clubId="club-1" />);
    await waitFor(() =>
      expect(screen.getByTestId("constitution-timeline")).toBeTruthy(),
    );
    fireEvent.click(screen.getByLabelText("Jump to Sep 2022"));
    fireEvent.click(screen.getByTestId("compare-to-current-btn"));
    const closeBtn = await screen.findByTestId("diff-modal-close");
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByTestId("constitution-diff-modal")).toBeNull();
    });
  });

  it("renders an empty state when the club has no archived versions", async () => {
    rpcMock.mockImplementationOnce(() =>
      Promise.resolve({ data: [], error: null }),
    );
    render(<ConstitutionTimeline clubId="club-empty" />);
    await waitFor(() =>
      expect(screen.getByTestId("constitution-timeline-empty")).toBeTruthy(),
    );
  });

  it("renders an error state when the RPC fails", async () => {
    rpcMock.mockImplementationOnce(() =>
      Promise.resolve({ data: null, error: { message: "RPC exploded" } }),
    );
    render(<ConstitutionTimeline clubId="club-broken" />);
    await waitFor(() =>
      expect(screen.getByTestId("constitution-timeline-error")).toBeTruthy(),
    );
    expect(
      screen.getByTestId("constitution-timeline-error").textContent,
    ).toContain("RPC exploded");
  });

  it("renders the change_summary under the version header when present", async () => {
    render(<ConstitutionTimeline clubId="club-1" clubName="Chess Club" />);
    await waitFor(() =>
      expect(screen.getByTestId("constitution-timeline")).toBeTruthy(),
    );
    expect(
      screen.getByText("Removed presidential veto clause"),
    ).toBeTruthy();
  });
});
