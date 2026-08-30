// =============================================================================
// Component Tests: DroneArSetupGuideCard
// Issue: #5132 - Dynamic "Hardware Resource" Drone Maintenance Augmented Reality Guide
// Description: RTL component tests for AR camera viewfinder, model detection banner,
// step-by-step camera pose verification, and flight controller unlocked banner.
// =============================================================================

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DroneArSetupGuideCard } from "../DroneArSetupGuideCard";
import { globalDroneArSetupService } from "@/services/droneArSetupService";

describe("DroneArSetupGuideCard Component (#5132)", () => {
  const assetId = "drone-asset-77";

  beforeEach(() => {
    vi.useFakeTimers();
    globalDroneArSetupService.clearAll();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalDroneArSetupService.clearAll();
  });

  it("renders AR guide card header, camera viewfinder, and model recognition banner", () => {
    render(<DroneArSetupGuideCard assetId={assetId} />);

    expect(screen.getByTestId("drone-ar-setup-guide-card")).toBeInTheDocument();
    expect(screen.getByText(/Hardware Setup & Maintenance Guide/i)).toBeInTheDocument();
    expect(screen.getByText(/Skydio X2 Autonomous Quadcopter/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Unfold Arms & Propellers/i).length).toBeGreaterThan(0);

    expect(screen.getByTestId("verify-step-btn")).toBeInTheDocument();
  });

  it("handles step-by-step camera pose verification and renders unlocked flight controller banner upon full completion", async () => {
    render(<DroneArSetupGuideCard assetId={assetId} />);

    // Step 1 Verification (Unfold Arms)
    const verifyBtn = screen.getByTestId("verify-step-btn");
    fireEvent.click(verifyBtn);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Step 2 Verification (Insert Battery)
    expect(screen.getAllByText(/Insert Intelligent Flight Battery/i).length).toBeGreaterThan(0);
    const verifyBtn2 = screen.getByTestId("verify-step-btn");
    fireEvent.click(verifyBtn2);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Step 3 Verification (Compass Calibration)
    expect(screen.getAllByText(/Perform Compass Calibration/i).length).toBeGreaterThan(0);
    const verifyBtn3 = screen.getByTestId("verify-step-btn");
    fireEvent.click(verifyBtn3);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Flight Controller Unlocked Banner should now be displayed!
    expect(screen.getByTestId("flight-controller-unlocked-banner")).toBeInTheDocument();
    expect(screen.getByText(/Flight-Controller Software Unlocked/i)).toBeInTheDocument();
    expect(screen.getByTestId("status-unlocked-badge")).toBeInTheDocument();
  });
});
