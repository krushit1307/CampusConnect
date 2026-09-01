import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DMCATakedownPipeline } from "../components/admin/DMCATakedownPipeline";
import { DMCATakedownService } from "../services/dmcaTakedownService";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => mockToastError(msg),
    success: (msg: string) => mockToastSuccess(msg),
    info: (msg: string) => mockToastInfo(msg),
  },
}));

// Mock DMCATakedownService
vi.mock("../services/dmcaTakedownService", () => {
  return {
    DMCATakedownService: {
      fetchDMCALogs: vi.fn(),
      triggerDMCAQuarantine: vi.fn(),
      exportComplianceCSV: vi.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("DMCATakedownPipeline Component", () => {
  const dummyLogs = [
    {
      id: "log-1",
      photo_id: "photo-1",
      student_id: "student-1",
      song_title: "Shake It Off",
      artist_name: "Taylor Swift",
      match_confidence: 98.50,
      acr_response: {},
      quarantined_at: new Date().toISOString(),
      profiles: {
        full_name: "Student One",
      },
      event_photos: {
        url: "https://s3.amazonaws.com/event-galleries/party.mp4",
        event_id: "event-1",
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DMCATakedownService.fetchDMCALogs).mockResolvedValue(dummyLogs);
  });

  it("renders DMCA logs, matches, confidence ratings, and simulation form", async () => {
    render(<DMCATakedownPipeline />);

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByTestId("dmca-pipeline-card")).toBeInTheDocument();
    });

    expect(screen.getByText("Student One")).toBeInTheDocument();
    expect(screen.getByText("Shake It Off")).toBeInTheDocument();
    expect(screen.getByText("98.5%")).toBeInTheDocument();
  });

  it("allows admins to export compliance logs to CSV", async () => {
    render(<DMCATakedownPipeline />);

    await waitFor(() => {
      expect(screen.getByTestId("dmca-pipeline-card")).toBeInTheDocument();
    });

    const exportBtn = screen.getByTestId("export-compliance-btn");
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(DMCATakedownService.exportComplianceCSV).toHaveBeenCalledWith(dummyLogs);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("compliance report exported successfully")
      );
    });
  });

  it("triggers simulated copyright scanning and quarantine events", async () => {
    vi.mocked(DMCATakedownService.triggerDMCAQuarantine).mockResolvedValue({
      success: true,
      status: "QUARANTINED",
      song_title: "Shake It Off",
      artist_name: "Taylor Swift",
      match_confidence: 98.5,
    });

    render(<DMCATakedownPipeline />);

    await waitFor(() => {
      expect(screen.getByTestId("dmca-pipeline-card")).toBeInTheDocument();
    });

    const photoInput = screen.getByTestId("mock-photo-id-input");
    fireEvent.change(photoInput, { target: { value: "photo-1" } });

    const runBtn = screen.getByTestId("run-quarantine-btn");
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(DMCATakedownService.triggerDMCAQuarantine).toHaveBeenCalledWith(
        "photo-1",
        "Shake It Off",
        "Taylor Swift",
        98.5,
        expect.any(Object)
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("DMCA Quarantine applied successfully")
      );
    });
  });
});
