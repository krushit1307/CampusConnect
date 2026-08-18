import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemberTierProgressBar } from "./MemberTierProgressBar";
import { MemberTierAvatar } from "./MemberTierAvatar";

describe("MemberTierProgressBar & MemberTierAvatar Components (#3461)", () => {
  it("renders member tier progress card with points countdown for 1450 points", () => {
    render(<MemberTierProgressBar points={1450} userName="Alex Rivera" />);

    expect(screen.getByTestId("member-tier-progress-card")).toBeInTheDocument();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("Silver Member 🥈")).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName.toLowerCase() === "p" && !!el?.textContent?.includes("away from unlocking Gold Tier"))).toBeInTheDocument();
  });

  it("renders highest Platinum tier unlocked state for 4000 points", () => {
    render(<MemberTierProgressBar points={4000} userName="Alex Rivera" />);

    expect(screen.getByText("Platinum Member 💎")).toBeInTheDocument();
    expect(screen.getByText(/Highest Tier Unlocked!/i)).toBeInTheDocument();
  });

  it("renders MemberTierAvatar with shiny Gold tier CSS classes for 1600 points", () => {
    render(<MemberTierAvatar points={1600} alt="Gold User" showBadgeOverlay />);

    const wrapper = screen.getByTestId("member-tier-avatar-wrapper");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.innerHTML).toContain("border-amber-400");
  });
});
