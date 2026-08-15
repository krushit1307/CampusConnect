// src/components/__tests__/ClubAffiliationBadges.test.tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClubAffiliationBadges } from "../ClubAffiliationBadges";
import { ClubAffiliation } from "@/types/clubAffiliation";

vi.mock("@/hooks/useClubAffiliations", () => ({
  useClubAffiliations: () => ({
    affiliations: [],
    isLoading: false,
  }),
}));

describe("ClubAffiliationBadges Component", () => {
  const mockAffiliations: ClubAffiliation[] = [
    { club_id: "c1", club_name: "CS Society", role_name: "President" },
    { club_id: "c2", club_name: "Robotics Club", role_name: "Vice President" },
    { club_id: "c3", club_name: "Chess Club", role_name: "Treasurer" },
    { club_id: "c4", club_name: "AI Lab", role_name: "Lead Researcher" },
  ];

  it("renders nothing if displayBadges is false", () => {
    const { container } = render(
      <ClubAffiliationBadges displayBadges={false} affiliations={mockAffiliations} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders maximum 2 primary badges and +N more pill when > 2 affiliations", () => {
    render(<ClubAffiliationBadges displayBadges={true} affiliations={mockAffiliations} maxDisplay={2} />);

    expect(screen.getByText("CS Society")).toBeInTheDocument();
    expect(screen.getByText("Robotics Club")).toBeInTheDocument();
    expect(screen.queryByText("Chess Club")).not.toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("renders all badges if <= 2 affiliations", () => {
    render(<ClubAffiliationBadges displayBadges={true} affiliations={mockAffiliations.slice(0, 2)} />);

    expect(screen.getByText("CS Society")).toBeInTheDocument();
    expect(screen.getByText("Robotics Club")).toBeInTheDocument();
    expect(screen.queryByText(/\+.*more/)).not.toBeInTheDocument();
  });
});
