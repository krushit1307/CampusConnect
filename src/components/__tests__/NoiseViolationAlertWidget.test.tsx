import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NoiseViolationAlertWidget } from "../events/NoiseViolationAlertWidget";
import { getEventNoiseViolations } from "@/services/noiseViolationService";

vi.mock("@/services/noiseViolationService", () => ({
  getEventNoiseViolations: vi.fn(),
  processIoTNoiseAlert: vi.fn(),
}));

describe("NoiseViolationAlertWidget Component (#3684)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders critical noise alert warning banner and liability audit logs", async () => {
    (getEventNoiseViolations as any).mockResolvedValue([
      {
        id: "log-1",
        event_id: "event-concert-1",
        venue_id: "venue-union",
        venue_name: "Student Union Hall",
        decibels: 94,
        duration_minutes: 5,
        warning_level: "WARNING",
        warning_count: 1,
        alert_message:
          "WARNING: Noise levels have exceeded 94dB for 5 minutes (Warning #1). Lower the volume immediately to avoid security intervention.",
        created_at: new Date().toISOString(),
      },
    ]);

    render(<NoiseViolationAlertWidget eventId="event-concert-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("noise-violation-widget")).toBeInTheDocument();
      expect(screen.getByTestId("critical-noise-alert-banner")).toBeInTheDocument();
      expect(screen.getByText(/NOISE ORDINANCE VIOLATION ALERT/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Noise levels have exceeded 94dB for 5 minutes/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Institutional Liability Audit Log/i)).toBeInTheDocument();
    });
  });
});
