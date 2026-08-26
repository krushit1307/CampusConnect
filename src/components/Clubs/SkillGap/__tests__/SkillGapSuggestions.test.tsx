import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SkillGapSuggestions } from "../SkillGapSuggestions";
import { BrowserRouter } from "react-router-dom";

vi.mock("lucide-react/dist/esm/icons/alert-triangle", () => ({
  default: () => <div data-testid="icon-alert" />,
}));

vi.mock("lucide-react/dist/esm/icons/check-circle", () => ({
  default: () => <div data-testid="icon-check" />,
}));

vi.mock("lucide-react/dist/esm/icons/search", () => ({
  default: () => <div data-testid="icon-search" />,
}));

vi.mock("lucide-react/dist/esm/icons/info", () => ({
  default: () => <div data-testid="icon-info" />,
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("SkillGapSuggestions", () => {
  it("renders healthy board state when no gaps exist", () => {
    const excellentSkills = [
      { skill: "Finance", count: 2 },
      { skill: "Graphic Design", count: 1 },
      { skill: "Logistics", count: 3 },
      { skill: "Marketing", count: 1 },
      { skill: "Communications", count: 1 },
    ];

    renderWithRouter(<SkillGapSuggestions clubId="123" currentSkills={excellentSkills} />);

    expect(screen.getByTestId("icon-check")).toBeInTheDocument();
    expect(screen.getByText("Healthy Leadership Board")).toBeInTheDocument();
    expect(
      screen.getByText(/meets all recommended 'Healthy Board' requirements/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("icon-alert")).not.toBeInTheDocument();
  });

  it("renders skill gaps when present", () => {
    // Missing Communications and Graphic Design
    const missingSkills = [
      { skill: "Finance", count: 2 },
      { skill: "Logistics", count: 3 },
      { skill: "Marketing", count: 1 },
    ];

    renderWithRouter(<SkillGapSuggestions clubId="123" currentSkills={missingSkills} />);

    expect(screen.getByTestId("icon-alert")).toBeInTheDocument();
    expect(screen.getByText("Skill Gaps Detected")).toBeInTheDocument();

    // Check specific gaps
    expect(screen.getByText("Communications")).toBeInTheDocument();
    expect(screen.getByText("Graphic Design")).toBeInTheDocument();

    // Check gap counts formatting
    expect(
      screen.getByText("You have 0 of the recommended 1 active members with this skill."),
    ).toBeInTheDocument();

    // Check calls to action links
    const recruitCommunication = screen.getByRole("link", {
      name: /Recruit Communications Talent/i,
    });
    expect(recruitCommunication).toHaveAttribute("href", "/directory?skill=Communications");
  });

  it("respects a custom heuristic matrix", () => {
    const customHeuristic = {
      Python: 2,
    };

    const someSkills = [
      { skill: "Python", count: 1 }, // Gap of 1
    ];

    renderWithRouter(
      <SkillGapSuggestions clubId="123" currentSkills={someSkills} heuristic={customHeuristic} />,
    );

    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText(/You have 1 of the recommended 2/i)).toBeInTheDocument();
  });
});
