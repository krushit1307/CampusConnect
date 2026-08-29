import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ProbationBanner from "../ProbationBanner";
import type { Club } from "@/types/club";

describe("ProbationBanner", () => {
  const mockProbationClub: Club = {
    id: "club-1",
    name: "Party Club",
    description: "Social club",
    status: "probation",
    probation_reason: "Unauthorized massive party without permit",
    probation_end_date: "2026-11-25T00:00:00Z",
    compliance_acknowledged: false,
  } as unknown as Club;

  const mockActiveClub: Club = {
    id: "club-2",
    name: "Chess Club",
    description: "Chess club",
    status: "active",
    compliance_acknowledged: true,
  } as unknown as Club;

  it("renders frozen point accumulation warning for clubs on probation", () => {
    render(<ProbationBanner club={mockProbationClub} />);

    expect(screen.getByText("Your club is on Probation")).toBeInTheDocument();
    expect(
      screen.getByText("Point Accumulation is FROZEN due to active Disciplinary Probation."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Unauthorized massive party without permit/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Complete Compliance Acknowledgment/i }),
    ).toBeInTheDocument();
  });

  it("returns null and does not render when club status is active", () => {
    const { container } = render(<ProbationBanner club={mockActiveClub} />);
    expect(container.firstChild).toBeNull();
  });
});
