import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { SharedClubsSection } from "./SharedClubsSection";

describe("SharedClubsSection Component (#1564)", () => {
  const mockClubs = [
    {
      id: "club-1",
      name: "Robotics Club",
      slug: "robotics",
      logo_url: "https://example.com/logo.png",
      category: "STEM",
    },
    {
      id: "club-2",
      name: "Debate Society",
      slug: "debate",
      logo_url: null,
      category: "Humanities",
    },
  ];

  it("renders empty state message when no shared clubs exist", () => {
    render(
      <BrowserRouter>
        <SharedClubsSection clubs={[]} targetUserName="Alex" />
      </BrowserRouter>,
    );

    expect(screen.getByText("Clubs in Common")).toBeInTheDocument();
    expect(screen.getByText(/You and Alex don't share any clubs yet\./i)).toBeInTheDocument();
  });

  it("renders loading skeleton when isLoading=true", () => {
    render(
      <BrowserRouter>
        <SharedClubsSection clubs={[]} isLoading={true} />
      </BrowserRouter>,
    );

    expect(screen.getByText("Clubs in Common")).toBeInTheDocument();
    expect(screen.queryByText(/don't share any clubs/i)).not.toBeInTheDocument();
  });

  it("renders list of shared clubs with links and count badge", () => {
    render(
      <BrowserRouter>
        <SharedClubsSection clubs={mockClubs} targetUserName="Alex" />
      </BrowserRouter>,
    );

    expect(screen.getByText("Clubs in Common")).toBeInTheDocument();
    expect(screen.getByText("2 Clubs")).toBeInTheDocument();
    expect(screen.getByText("Robotics Club")).toBeInTheDocument();
    expect(screen.getByText("Debate Society")).toBeInTheDocument();

    const roboticsLink = screen.getByText("Robotics Club").closest("a");
    expect(roboticsLink).toHaveAttribute("href", "/clubs/robotics");

    const debateLink = screen.getByText("Debate Society").closest("a");
    expect(debateLink).toHaveAttribute("href", "/clubs/debate");
  });
});
