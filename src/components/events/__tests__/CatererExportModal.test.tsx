import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CatererExportModal } from "../CatererExportModal";
import * as catererExportService from "@/services/catererExportService";

vi.mock("@/services/catererExportService", async () => {
  const actual = await vi.importActual<typeof catererExportService>("@/services/catererExportService");
  return {
    ...actual,
    fetchEventDietaryExportData: vi.fn(),
  };
});

describe("CatererExportModal Component", () => {
  const mockManifest: catererExportService.CatererExportManifest = {
    eventId: "evt-123",
    eventTitle: "Annual Gala 2026",
    totalRsvps: 50,
    totalDietaryRequirementsCount: 15,
    summaryCounts: [
      { tag: "Vegetarian", count: 10, percentage: 20 },
      { tag: "Gluten-Free", count: 5, percentage: 10 },
    ],
    severeAllergies: [
      {
        attendeeLabel: "Attendee #1",
        severity: "SEVERE",
        dietaryTag: "Peanut Severe",
        note: "Requires dedicated prep area",
      },
    ],
    anonymizedNotes: ["Anonymous Request: No cilantro"],
    exportedAt: "2026-08-26T00:00:00.000Z",
    privacyGuarantee: "STRICTLY_ANONYMIZED_ZERO_PII",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(catererExportService.fetchEventDietaryExportData).mockResolvedValue(mockManifest);
  });

  it("does not render when isOpen is false", () => {
    render(<CatererExportModal isOpen={false} onClose={vi.fn()} eventId="evt-123" />);
    expect(screen.queryByTestId("caterer-export-modal")).toBeNull();
  });

  it("renders modal and loads aggregated dietary data when open", async () => {
    render(<CatererExportModal isOpen={true} onClose={vi.fn()} eventId="evt-123" eventTitle="Annual Gala 2026" />);

    expect(screen.getByTestId("caterer-export-modal")).toBeDefined();
    expect(screen.getByTestId("caterer-export-privacy-badge")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("Annual Gala 2026")).toBeDefined();
      expect(screen.getByText("Vegetarian")).toBeDefined();
      expect(screen.getByText("10")).toBeDefined();
      expect(screen.getByText("Attendee #1")).toBeDefined();
      expect(screen.getByText("Anonymous Request: No cilantro")).toBeDefined();
    });
  });

  it("calls onClose when close button is clicked", async () => {
    const handleClose = vi.fn();
    render(<CatererExportModal isOpen={true} onClose={handleClose} eventId="evt-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("caterer-export-close-button")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("caterer-export-close-button"));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("has action buttons for CSV, JSON, and Kitchen Summary copy", async () => {
    render(<CatererExportModal isOpen={true} onClose={vi.fn()} eventId="evt-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("caterer-export-download-csv")).toBeDefined();
      expect(screen.getByTestId("caterer-export-download-json")).toBeDefined();
      expect(screen.getByTestId("caterer-export-copy-button")).toBeDefined();
    });
  });
});
