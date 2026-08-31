import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AcousticDensityTelemetry } from "../components/facility/AcousticDensityTelemetry";
import { AcousticDensityService } from "../services/acousticDensityService";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: () => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      }),
    }),
    removeChannel: vi.fn(),
  }),
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

// Mock AcousticDensityService
vi.mock("../services/acousticDensityService", () => {
  return {
    AcousticDensityService: {
      fetchMicrophonesForVenue: vi.fn(),
      fetchLatestTelemetry: vi.fn(),
      ingestAcousticDensity: vi.fn(),
      flashModelToMicrophone: vi.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("AcousticDensityTelemetry Component", () => {
  const dummyMicrophones = [
    {
      id: "mic-1",
      venue_id: "venue-1",
      room_number: "Room 101",
      firmware_version: "v1.0.0",
      is_model_flashed: false,
      created_at: new Date().toISOString(),
    },
  ];

  const dummyTelemetry = [
    {
      id: "tel-1",
      microphone_id: "mic-1",
      density_score: 50,
      mqtt_topic: "campus/science/101/density",
      recorded_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AcousticDensityService.fetchMicrophonesForVenue).mockResolvedValue(dummyMicrophones);
    vi.mocked(AcousticDensityService.fetchLatestTelemetry).mockResolvedValue(dummyTelemetry);
  });

  it("renders micro-device inventory, firmware state, and telemetry score logs", async () => {
    render(<AcousticDensityTelemetry venueId="venue-1" />);

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByTestId("acoustic-telemetry-panel")).toBeInTheDocument();
    });

    expect(screen.getByText("Room 101")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("allows flashing TensorFlow Lite models onto arrays with confirmation toast", async () => {
    vi.mocked(AcousticDensityService.flashModelToMicrophone).mockResolvedValue(true);

    render(<AcousticDensityTelemetry venueId="venue-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("acoustic-telemetry-panel")).toBeInTheDocument();
    });

    const flashBtn = screen.getByText("Flash ML Binary");
    fireEvent.click(flashBtn);

    await waitFor(() => {
      expect(AcousticDensityService.flashModelToMicrophone).toHaveBeenCalledWith("mic-1");
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Firmware flashed successfully")
      );
    });
  });

  it("publishes simulated MQTT telemetry and handles overcrowding alert triggers", async () => {
    vi.mocked(AcousticDensityService.ingestAcousticDensity).mockResolvedValue({
      success: true,
      alert_triggered: true,
      density_score: 90,
      alert_id: "alert-1",
    });

    render(<AcousticDensityTelemetry venueId="venue-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("acoustic-telemetry-panel")).toBeInTheDocument();
    });

    // Adjust slider (density score to 90)
    const slider = screen.getByTestId("sim-score-slider");
    fireEvent.change(slider, { target: { value: 90 } });

    // Click publish MQTT trigger
    const publishBtn = screen.getByTestId("publish-telemetry-btn");
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(AcousticDensityService.ingestAcousticDensity).toHaveBeenCalledWith(
        "mic-1",
        90,
        "campus/venues/room/density"
      );
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining("OVERCROWDING DETECTED")
      );
    });
  });
});
