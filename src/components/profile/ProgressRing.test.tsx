import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ProgressRing, calculateProfileCompleteness } from "./ProgressRing";
import { OnboardingProfileCard } from "./OnboardingProfileCard";

describe("ProgressRing & Onboarding Profile Completeness (#1971)", () => {
  it("calculates profile completeness correctly", () => {
    expect(
      calculateProfileCompleteness({
        hasAvatar: true,
        hasBio: false,
        hasMajor: false,
        hasInterests: false,
      }),
    ).toBe(25);

    expect(
      calculateProfileCompleteness({
        hasAvatar: true,
        hasBio: true,
        hasMajor: true,
        hasInterests: true,
      }),
    ).toBe(100);

    expect(calculateProfileCompleteness(undefined)).toBe(0);
  });

  it("renders ProgressRing with badge and child avatar content", async () => {
    render(
      <ProgressRing percentage={50} showBadge={true}>
        <div data-testid="avatar-content">Avatar</div>
      </ProgressRing>,
    );

    expect(screen.getByTestId("avatar-content")).toBeInTheDocument();

    // Fast-forward animation timeout
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("updates completeness percentage on interactive profile checklist click", async () => {
    render(
      <OnboardingProfileCard
        initialData={{ hasAvatar: true, hasBio: true, hasMajor: false, hasInterests: false }}
      />,
    );

    // Initial state: 50%
    expect(screen.getByText("50%")).toBeInTheDocument();

    // Click to add Major (adds 25% -> 75%)
    const majorBtn = screen.getByText(/Select Academic Major/i);
    fireEvent.click(majorBtn);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(screen.getAllByText("75%").length).toBeGreaterThan(0);
  });
});
