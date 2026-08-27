import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  ClubPitchAnalyticsDashboard,
  MOCK_TELEMETRY_PINGS,
} from "./ClubPitchAnalyticsDashboard";

describe("ClubPitchAnalyticsDashboard Component (#4271)", () => {
  it("renders Club Pitch Analytics header, metrics overview, and retention curve visualizer", () => {
    render(
      <ClubPitchAnalyticsDashboard
        clubName="Computer Science Society"
        initialTelemetry={MOCK_TELEMETRY_PINGS}
      />
    );

    expect(screen.getByText(/Interactive "Club Pitch" Audio Sandbox Analytics — Computer Science Society/i)).toBeInTheDocument();
    expect(screen.getByText("Total Listens")).toBeInTheDocument();
    expect(screen.getByText("Completion Rate")).toBeInTheDocument();
    expect(screen.getByText("Highest Audience Drop-Off")).toBeInTheDocument();
    expect(screen.getByText(/60-Second Audio Retention Curve/i)).toBeInTheDocument();
  });

  it("displays retention insight and peak drop-off marker", () => {
    render(
      <ClubPitchAnalyticsDashboard
        clubName="Computer Science Society"
        initialTelemetry={MOCK_TELEMETRY_PINGS}
      />
    );

    expect(screen.getByText(/Retention Insight:/i)).toBeInTheDocument();
    expect(screen.getByText(/Biggest audience drop-off occurs at/i)).toBeInTheDocument();
  });

  it("handles audio play simulation and sends telemetry ping on Swipe Away", () => {
    const handlePingSent = vi.fn();
    render(
      <ClubPitchAnalyticsDashboard
        clubName="Computer Science Society"
        initialTelemetry={MOCK_TELEMETRY_PINGS}
        onPingSent={handlePingSent}
      />
    );

    const playBtn = screen.getByRole("button", { name: /Play Pitch/i });
    fireEvent.click(playBtn);

    const swipeBtn = screen.getByRole("button", { name: /Swipe Away/i });
    fireEvent.click(swipeBtn);

    expect(handlePingSent).toHaveBeenCalled();
  });
});
