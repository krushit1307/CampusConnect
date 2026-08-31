import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SubtleMentalHealthSupportBanner } from "./SubtleMentalHealthSupportBanner";
import { MentalHealthTriggerResult } from "@/lib/peerChatMentalHealthScanner";

describe("SubtleMentalHealthSupportBanner Component (#4503)", () => {
  const triggeredResult: MentalHealthTriggerResult = {
    isTriggered: true,
    category: "academic_stress",
    detectedKeywords: ["stressed", "finals"],
    supportBannerText: "Finals got you stressed? The Campus Counseling Center has free walk-in hours today.",
    counselingResourceUrl: "/wellness/counseling-walk-in",
    privacyGuardVerified: true,
  };

  const cleanResult: MentalHealthTriggerResult = {
    isTriggered: false,
    category: "none",
    detectedKeywords: [],
    supportBannerText: "",
    counselingResourceUrl: "",
    privacyGuardVerified: true,
  };

  it("renders private support banner when high stress is detected", () => {
    render(<SubtleMentalHealthSupportBanner triggerResult={triggeredResult} />);

    expect(screen.getByTestId("subtle-mental-health-banner")).toBeInTheDocument();
    expect(screen.getByText(/Private Support Prompt • Visible ONLY to You/i)).toBeInTheDocument();
    expect(screen.getByText(/Finals got you stressed\? The Campus Counseling Center has free walk-in hours today\./i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Book Free Walk-In Hours/i })).toBeInTheDocument();
  });

  it("does NOT render when no stress keywords are triggered", () => {
    render(<SubtleMentalHealthSupportBanner triggerResult={cleanResult} />);

    expect(screen.queryByTestId("subtle-mental-health-banner")).toBeNull();
  });

  it("dismisses banner on close button click", () => {
    const handleDismiss = vi.fn();
    render(
      <SubtleMentalHealthSupportBanner
        triggerResult={triggeredResult}
        onDismiss={handleDismiss}
      />
    );

    const closeBtn = screen.getByRole("button", { name: /Dismiss support prompt/i });
    fireEvent.click(closeBtn);

    expect(handleDismiss).toHaveBeenCalled();
    expect(screen.queryByTestId("subtle-mental-health-banner")).toBeNull();
  });
});
