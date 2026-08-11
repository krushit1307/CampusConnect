import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { HistoryTimeline, TimelineItem } from "./HistoryTimeline";

const mockItems: TimelineItem[] = [
  {
    id: "club-1",
    type: "club_join",
    date: "2026-08-01T10:00:00Z",
    title: "Joined Coding Club",
    description: "Became a member of Coding Club.",
    link: "/clubs/coding-club",
  },
  {
    id: "rsvp-1",
    type: "rsvp",
    date: "2026-07-28T12:00:00Z",
    title: "RSVP'd to Hackathon",
    description: "Registered to attend the main hackathon.",
    link: "/events/hackathon",
  },
  {
    id: "post-1",
    type: "post",
    date: "2026-07-25T14:00:00Z",
    title: "Posted in Design Club",
    description: "Check out this new Figma file.",
    link: "/clubs/design-club",
  },
];

describe("HistoryTimeline Component", () => {
  it("renders empty state message when no items are provided", () => {
    render(<HistoryTimeline items={[]} />);
    expect(screen.getByText("No activity history recorded yet.")).toBeInTheDocument();
  });

  it("renders chronological timeline events correctly", () => {
    render(
      <MemoryRouter>
        <HistoryTimeline items={mockItems} />
      </MemoryRouter>
    );

    expect(screen.getByText("Joined Coding Club")).toBeInTheDocument();
    expect(screen.getByText("RSVP'd to Hackathon")).toBeInTheDocument();
    expect(screen.getByText("Posted in Design Club")).toBeInTheDocument();

    expect(screen.getByText("Became a member of Coding Club.")).toBeInTheDocument();
    expect(screen.getByText("Registered to attend the main hackathon.")).toBeInTheDocument();
    expect(screen.getByText("Check out this new Figma file.")).toBeInTheDocument();

    expect(screen.getByText("Aug 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("Jul 28, 2026")).toBeInTheDocument();
    expect(screen.getByText("Jul 25, 2026")).toBeInTheDocument();

    expect(screen.getByText("club join")).toBeInTheDocument();
    expect(screen.getByText("rsvp")).toBeInTheDocument();
    expect(screen.getByText("post")).toBeInTheDocument();

    const detailLinks = screen.getAllByText("View Details");
    expect(detailLinks).toHaveLength(3);
    expect(detailLinks[0].closest("a")).toHaveAttribute("href", "/clubs/coding-club");
    expect(detailLinks[1].closest("a")).toHaveAttribute("href", "/events/hackathon");
    expect(detailLinks[2].closest("a")).toHaveAttribute("href", "/clubs/design-club");
  });
});
