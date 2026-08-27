import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { WaitlistProbabilityBadge } from "./WaitlistProbabilityBadge";

describe("WaitlistProbabilityBadge Component (#2980)", () => {
  it("renders waitlist position and high probability badge for top waitlist position", () => {
    render(<WaitlistProbabilityBadge position={2} capacity={100} isFree={true} pastEventsCount={5} historicalDropoutRate={0.25} />);

    expect(screen.getByTestId("waitlist-probability-card")).toBeInTheDocument();
    expect(screen.getByText(/Waitlist Position/i)).toBeInTheDocument();
    expect(screen.getByText(/#2/i)).toBeInTheDocument();
    expect(screen.getByText(/High/i)).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName.toLowerCase() === "p" && !!el.textContent?.includes("25% historical dropout rate"))).toBeInTheDocument();
  });

  it("renders legal disclaimer text to safely set expectations", () => {
    render(<WaitlistProbabilityBadge position={45} capacity={100} />);

    expect(screen.getByText(/Estimated Probability based on historical attendance patterns — actual admission is not guaranteed/i)).toBeInTheDocument();
  });
});
